import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'mapId')

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing mapId' })
  }

  // Verify map ownership
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // Delete from pgvector
  await prisma.$executeRawUnsafe(
    `DELETE FROM "NodeEmbedding" WHERE "mapId" = $1`,
    mapId
  )

  // Clear Redis cache
  await cache.delPattern(cacheKeys.embeddingsByMap(mapId))

  return { success: true }
})
