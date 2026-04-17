import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'

interface CachedEmbedding {
  embedding: number[]
  textHash: string
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const query = getQuery(event)
  const mapId = query.mapId as string
  const nodeIds = query.nodeIds as string

  if (!mapId || !nodeIds) {
    throw createError({ statusCode: 400, statusMessage: 'Missing mapId or nodeIds query parameter' })
  }

  // Verify map ownership to prevent IDOR
  const map = await prisma.map.findFirst({ where: { id: mapId, userId, deletedAt: null }, select: { id: true } })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  const nodeIdList = nodeIds.split(',').filter(Boolean).slice(0, 500)

  if (nodeIdList.length === 0) {
    return { embeddings: [] }
  }

  const embeddings: Array<{ nodeId: string; embedding: number[] }> = []

  for (const nodeId of nodeIdList) {
    const cached = await cache.get<CachedEmbedding>(
      cacheKeys.embeddingByNode(mapId, nodeId)
    )

    if (cached?.embedding) {
      embeddings.push({ nodeId, embedding: cached.embedding })
    }
  }

  return {
    embeddings,
    found: embeddings.length,
    requested: nodeIdList.length
  }
})
