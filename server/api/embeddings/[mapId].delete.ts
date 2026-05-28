import { cache, cacheKeys, checkRateLimit } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'mapId')

  const { allowed } = await checkRateLimit(`embeddings:delete:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many embedding deletes' })
  }

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

  // Delete from pgvector. Template form auto-parameterizes so a future
  // change can't accidentally interpolate user input into the SQL string.
  await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${mapId}`

  // Clear Redis cache
  await cache.delPattern(cacheKeys.embeddingsByMap(mapId))

  return { success: true }
})
