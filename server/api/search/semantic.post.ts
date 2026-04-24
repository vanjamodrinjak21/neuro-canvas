import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, semanticSearchSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { toPgVector } from '../../utils/embeddings'

interface SearchRow {
  mapId: string
  nodeId: string
  sourceText: string
  similarity: number
  mapTitle: string
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const body = validateBody(semanticSearchSchema, await readBody(event))
  const { queryEmbedding, mapIds, topK, threshold } = body

  const vectorStr = toPgVector(queryEmbedding)

  let rows: SearchRow[]

  if (mapIds && mapIds.length > 0) {
    // Filter to specific maps
    const mapPlaceholders = mapIds.map((_, i) => `$${i + 4}`).join(', ')
    rows = await prisma.$queryRawUnsafe<SearchRow[]>(
      `SELECT ne."mapId", ne."nodeId", ne."sourceText",
              1 - (ne."embedding" <=> $1::vector) AS similarity,
              m."title" AS "mapTitle"
       FROM "NodeEmbedding" ne
       JOIN "Map" m ON m."id" = ne."mapId"
       WHERE m."userId" = $2
         AND m."deletedAt" IS NULL
         AND ne."mapId" IN (${mapPlaceholders})
         AND 1 - (ne."embedding" <=> $1::vector) >= $3
       ORDER BY ne."embedding" <=> $1::vector
       LIMIT ${topK}`,
      vectorStr,
      userId,
      threshold,
      ...mapIds
    )
  } else {
    // Search across all user's maps
    rows = await prisma.$queryRawUnsafe<SearchRow[]>(
      `SELECT ne."mapId", ne."nodeId", ne."sourceText",
              1 - (ne."embedding" <=> $1::vector) AS similarity,
              m."title" AS "mapTitle"
       FROM "NodeEmbedding" ne
       JOIN "Map" m ON m."id" = ne."mapId"
       WHERE m."userId" = $2
         AND m."deletedAt" IS NULL
         AND 1 - (ne."embedding" <=> $1::vector) >= $3
       ORDER BY ne."embedding" <=> $1::vector
       LIMIT ${topK}`,
      vectorStr,
      userId,
      threshold
    )
  }

  return {
    results: rows.map(row => ({
      mapId: row.mapId,
      mapTitle: row.mapTitle,
      nodeId: row.nodeId,
      sourceText: row.sourceText,
      similarity: Number(row.similarity)
    }))
  }
})
