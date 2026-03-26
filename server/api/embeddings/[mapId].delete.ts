import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  await requireAuthSession(event)

  const mapId = getRouterParam(event, 'mapId')

  if (!mapId || mapId.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid mapId' })
  }

  await cache.delPattern(cacheKeys.embeddingsByMap(mapId))

  return { success: true, mapId }
})
