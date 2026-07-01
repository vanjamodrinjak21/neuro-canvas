import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'
import { requireAuthSession } from '../../../utils/syncHelpers'

/**
 * Server-side PNG rendering of a mind map for OG meta images.
 *
 * Uses satori (HTML→SVG) + @resvg/resvg-js (SVG→PNG).
 * This is only used for share link OG images, not the primary export path.
 *
 * Access: either a valid share token presented via `?via=` (what share-page
 * OG scrapers get), or an authenticated owner session. The mere existence of
 * a share link does NOT open the preview to anyone holding the map id.
 *
 * TODO: Install satori + @resvg/resvg-js and implement full rendering.
 * For now, returns the stored preview thumbnail if available.
 */
export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID required' })
  }

  // Same policy as /api/share/[token]: this route validates share tokens, so
  // it must not become a token-enumeration oracle.
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`render:${ip}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Try again later.' })
  }

  // Share-link consumers must present the token; revoked/expired shares must
  // NOT satisfy this — a revoked link would otherwise continue to serve the
  // cached PNG preview indefinitely.
  const via = getQuery(event).via
  let authorized = false
  if (typeof via === 'string' && via.length > 0 && via.length <= 128) {
    const share = await prisma.mapShare.findFirst({
      where: {
        token: via,
        mapId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: { id: true }
    })
    authorized = Boolean(share)
  }

  // No valid share token — require an authenticated owner. requireAuthSession
  // (not raw getToken) so sessionsValidFrom/disabledAt revocation applies here
  // like every other authenticated route.
  if (!authorized) {
    const { userId } = await requireAuthSession(event)
    const owned = await prisma.map.findFirst({
      where: { id: mapId, userId, deletedAt: null },
      select: { id: true }
    })
    if (!owned) {
      throw createError({ statusCode: 404, statusMessage: 'Map not found' })
    }
  }

  const map = await prisma.map.findFirst({
    where: { id: mapId, deletedAt: null },
    select: { preview: true, title: true },
  })

  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // Return stored preview if available
  if (map.preview) {
    // preview is base64 PNG
    const buffer = Buffer.from(map.preview.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    setResponseHeader(event, 'Content-Type', 'image/png')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
    return buffer
  }

  // No preview available — return a 1x1 transparent PNG
  const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
  setResponseHeader(event, 'Content-Type', 'image/png')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return transparentPng
})
