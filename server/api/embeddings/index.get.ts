import { getServerSession } from '#auth'
import { cache, cacheKeys } from '../../utils/redis'

interface CachedEmbedding {
  embedding: number[]
  textHash: string
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const mapId = query.mapId as string
  const nodeIds = query.nodeIds as string

  if (!mapId || !nodeIds) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing mapId or nodeIds query parameter'
    })
  }

  // Parse nodeIds (comma-separated)
  const nodeIdList = nodeIds.split(',').filter(Boolean)

  if (nodeIdList.length === 0) {
    return { embeddings: [] }
  }

  // Fetch embeddings for each node
  const embeddings: Array<{ nodeId: string; embedding: number[] }> = []

  for (const nodeId of nodeIdList) {
    const cached = await cache.get<CachedEmbedding>(
      cacheKeys.embeddingByNode(mapId, nodeId)
    )

    if (cached?.embedding) {
      embeddings.push({
        nodeId,
        embedding: cached.embedding
      })
    }
  }

  return {
    embeddings,
    found: embeddings.length,
    requested: nodeIdList.length
  }
})
