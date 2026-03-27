import { nanoid } from 'nanoid'
import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID required' })
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
