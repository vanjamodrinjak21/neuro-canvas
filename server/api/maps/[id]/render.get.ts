import { prisma } from '../../../utils/prisma'

/**
 * Server-side PNG rendering of a mind map for OG meta images.
 *
 * Uses satori (HTML→SVG) + @resvg/resvg-js (SVG→PNG).
 * This is only used for share link OG images, not the primary export path.
 *
 * TODO: Install satori + @resvg/resvg-js and implement full rendering.
 * For now, returns the stored preview thumbnail if available.
 */
export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID required' })
  }

  // Check if map has a public share link (for OG images on shared links)
  const share = await prisma.mapShare.findFirst({
    where: {
      mapId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    select: { id: true }
  })

  // If no share link, require authentication and ownership
  if (!share) {
    const { getToken } = await import('#auth')
    const token = await getToken({ event })
    if (!token?.email) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    const userId = await prisma.user.findUnique({
      where: { email: token.email as string },
      select: { id: true }
    })
    if (!userId) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    const owned = await prisma.map.findFirst({
      where: { id: mapId, userId: userId.id, deletedAt: null },
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
