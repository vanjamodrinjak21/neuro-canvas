// ---------------------------------------------------------------------------
// GET /api/maps/options  (Document RAG — attach-to-map picker)
// ---------------------------------------------------------------------------
//
// Lightweight {id, title} list of the caller's non-deleted maps, newest first,
// for the upload modal's "attach to map" selector. Deliberately tiny: no node
// counts, no content — just enough to populate a dropdown. Mirrors the auth →
// rate-limit → prisma shape of search/semantic.post.ts.
//
// Capped at 50 rows (the selector is a picker, not a browser) and ordered by
// updatedAt so the maps a user is actively working on surface first. The
// (userId, updatedAt) index on Map backs this scan directly.
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // 60/min/user — a picker that may re-fetch as the modal opens; generous but
  // bounded. The key is passed VERBATIM to checkRateLimit (own bucket).
  const { allowed } = await checkRateLimit(`maps:options:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  return prisma.map.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, title: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })
})
