// ---------------------------------------------------------------------------
// GET /api/maps/:id/documents  (Reverse link — source documents of a map, §8)
// ---------------------------------------------------------------------------
//
// The inverse of the documents library's links field: given a map, return the
// documents linked to it (the GENERATED source it was built from, plus any
// ATTACHED sources). Consumed by the map editor to show "sources" for the
// open map.
//
// Ownership is verified up front against Map (id + userId + deletedAt null) so
// a foreign or deleted mapId 404s before any link query runs. The
// DocumentMapLink query is additionally userId-scoped as defense in depth.
// Storage internals (r2Key/sha256) are never selected.
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../../utils/syncHelpers'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`map:documents:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const mapId = getRouterParam(event, 'id')
  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Map ID required' })
  }

  const ownedMap = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true },
  })
  if (!ownedMap) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  const links = await prisma.documentMapLink.findMany({
    where: { mapId, userId },
    select: {
      linkType: true,
      document: {
        select: { id: true, title: true, filename: true, status: true },
      },
    },
  })

  return {
    documents: links.map((link) => ({
      linkType: link.linkType,
      id: link.document.id,
      title: link.document.title,
      filename: link.document.filename,
      status: link.document.status,
    })),
  }
})
