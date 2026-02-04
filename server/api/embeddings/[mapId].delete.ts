import { getServerSession } from '#auth'
import { cache, cacheKeys } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const mapId = getRouterParam(event, 'mapId')

  if (!mapId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing mapId parameter'
    })
  }

  // Delete all embeddings for this map using pattern matching
  await cache.delPattern(cacheKeys.embeddingsByMap(mapId))

  return {
    success: true,
    mapId
  }
})
