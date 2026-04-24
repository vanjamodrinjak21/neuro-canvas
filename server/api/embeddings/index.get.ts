import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'

const EMBEDDING_CACHE_TTL = 7 * 24 * 60 * 60

interface CachedEmbedding {
  embedding: number[]
  contentHash: string
}

interface PgVectorRow {
  nodeId: string
  contentHash: string
  embedding: string
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const query = getQuery(event)
  const mapId = query.mapId as string
  const nodeIds = query.nodeIds as string

  if (!mapId || !nodeIds) {
    throw createError({ statusCode: 400, statusMessage: 'Missing mapId or nodeIds query parameter' })
  }

  // Verify map ownership
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  const nodeIdList = nodeIds.split(',').filter(Boolean).slice(0, 500)
  if (nodeIdList.length === 0) {
    return { embeddings: [], found: 0, requested: 0, source: 'cache' as const }
  }

  // Try Redis cache first
  const embeddings: Array<{ nodeId: string; embedding: number[] }> = []
  const cacheMisses: string[] = []

  for (const nodeId of nodeIdList) {
    const cached = await cache.get<CachedEmbedding>(cacheKeys.embeddingByNode(mapId, nodeId))
    if (cached?.embedding) {
      embeddings.push({ nodeId, embedding: cached.embedding })
    } else {
      cacheMisses.push(nodeId)
    }
  }

  let source: 'cache' | 'db' = cacheMisses.length === 0 ? 'cache' : 'db'

  // Fallback to pgvector for cache misses
  if (cacheMisses.length > 0) {
    const placeholders = cacheMisses.map((_, i) => `$${i + 2}`).join(', ')
    const rows = await prisma.$queryRawUnsafe<PgVectorRow[]>(
      `SELECT "nodeId", "contentHash", "embedding"::text
       FROM "NodeEmbedding"
       WHERE "mapId" = $1 AND "nodeId" IN (${placeholders})`,
      mapId,
      ...cacheMisses
    )

    for (const row of rows) {
      // Parse pgvector string '[0.1,0.2,...]' back to number[]
      const embedding = row.embedding
        .slice(1, -1)
        .split(',')
        .map(Number)

      embeddings.push({ nodeId: row.nodeId, embedding })

      // Backfill Redis cache
      await cache.set(
        cacheKeys.embeddingByNode(mapId, row.nodeId),
        { embedding, contentHash: row.contentHash },
        EMBEDDING_CACHE_TTL
      )
    }
  }

  return {
    embeddings,
    found: embeddings.length,
    requested: nodeIdList.length,
    source
  }
})
