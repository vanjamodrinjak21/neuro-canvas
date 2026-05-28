import { nanoid } from 'nanoid'
import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { checkRateLimit } from '../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID required' })
  }

  // 30/min per user — generous for normal sharing, blocks enumeration / bot loops.
  const { allowed } = await checkRateLimit(`share:create:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many share requests' })
  }

  // Verify user owns this map
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true },
  })

  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // Check for existing share link
  const existing = await prisma.mapShare.findFirst({
    where: { mapId, createdBy: userId },
  })

  if (existing) {
    return {
      token: existing.token,
      url: `/s/${existing.token}`,
    }
  }

  // Create new share token
  const token = nanoid(16)
  await prisma.mapShare.create({
    data: {
      mapId,
      token,
      createdBy: userId,
    },
  })

  return {
    token,
    url: `/s/${token}`,
  }
})
