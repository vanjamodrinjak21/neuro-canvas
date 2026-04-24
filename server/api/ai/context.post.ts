import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, ragContextSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { toPgVector } from '../../utils/embeddings'

interface ContextRow {
  nodeId: string
  sourceText: string
  similarity: number
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const body = validateBody(ragContextSchema, await readBody(event))
  const { mapId, queryEmbedding, maxNodes, threshold, includeNeighbors } = body

  // Verify map ownership
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true, data: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  const vectorStr = toPgVector(queryEmbedding)

  // Get most relevant nodes from this map
  const rows = await prisma.$queryRawUnsafe<ContextRow[]>(
    `SELECT "nodeId", "sourceText",
            1 - ("embedding" <=> $1::vector) AS similarity
     FROM "NodeEmbedding"
     WHERE "mapId" = $2
       AND 1 - ("embedding" <=> $1::vector) >= $3
     ORDER BY "embedding" <=> $1::vector
     LIMIT $4`,
    vectorStr,
    mapId,
    threshold,
    maxNodes
  )

  const context: Array<{
    nodeId: string
    text: string
    similarity: number
    isNeighbor: boolean
  }> = rows.map(row => ({
    nodeId: row.nodeId,
    text: row.sourceText,
    similarity: Number(row.similarity),
    isNeighbor: false
  }))

  // Optionally include graph-connected neighbor nodes
  if (includeNeighbors && context.length > 0) {
    const mapData = map.data as { edges?: Record<string, { source: string; target: string }> }
    const edges = mapData.edges ? Object.values(mapData.edges) : []
    const matchedNodeIds = new Set(context.map(c => c.nodeId))
    const neighborIds = new Set<string>()

    for (const edge of edges) {
      if (matchedNodeIds.has(edge.source) && !matchedNodeIds.has(edge.target)) {
        neighborIds.add(edge.target)
      }
      if (matchedNodeIds.has(edge.target) && !matchedNodeIds.has(edge.source)) {
        neighborIds.add(edge.source)
      }
    }

    // Fetch neighbor texts from pgvector
    if (neighborIds.size > 0) {
      const neighborList = Array.from(neighborIds).slice(0, 20)
      const placeholders = neighborList.map((_, i) => `$${i + 2}`).join(', ')
      const neighborRows = await prisma.$queryRawUnsafe<Array<{ nodeId: string; sourceText: string }>>(
        `SELECT "nodeId", "sourceText" FROM "NodeEmbedding"
         WHERE "mapId" = $1 AND "nodeId" IN (${placeholders})`,
        mapId,
        ...neighborList
      )

      for (const row of neighborRows) {
        context.push({
          nodeId: row.nodeId,
          text: row.sourceText,
          similarity: 0,
          isNeighbor: true
        })
      }
    }
  }

  // Estimate token count (~4 chars per token)
  const totalTokensEstimate = context.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0)

  return { context, totalTokensEstimate }
})
