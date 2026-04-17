import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

/**
 * Public endpoint — no auth required.
 * Returns map data for a valid share token.
 * Rate-limited by IP to prevent token enumeration.
 */
export default defineEventHandler(async (event) => {
  // Rate limit by IP: 30 requests per minute
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`share:${ip}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again later.' })
  }

  const token = getRouterParam(event, 'token')

  if (!token || token.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid token' })
  }

  const share = await prisma.mapShare.findUnique({
    where: { token },
  })

  if (!share) {
    throw createError({ statusCode: 404, statusMessage: 'Share link not found' })
  }

  // Check expiration
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'Share link has expired' })
  }

  // Fetch map data
  const map = await prisma.map.findFirst({
    where: { id: share.mapId, deletedAt: null },
    select: {
      id: true,
      title: true,
      data: true,
      preview: true,
      updatedAt: true,
    },
  })

  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map no longer exists' })
  }

  return {
    id: map.id,
    title: map.title,
    data: map.data,
    preview: map.preview,
    updatedAt: map.updatedAt,
  }
})
