// ---------------------------------------------------------------------------
// DELETE /api/documents/[id]/detach?mapId=…  (Document RAG — unlink doc from map)
// ---------------------------------------------------------------------------
//
// Removes a user-initiated ATTACHED link between a document and a map. Mirrors
// the auth → rate-limit → ownership → prisma shape of attach.post.ts.
//
// Only ATTACHED links are user-detachable. GENERATED links are provenance
// written by the map-generation flow and MUST survive detach, so the delete is
// scoped to linkType 'ATTACHED'. The deleteMany is additionally scoped to the
// caller's userId, so one user can never tear down another user's link even if
// they could guess the ids.
//
// Idempotent: if no matching ATTACHED link exists (already detached, never
// existed, GENERATED-only pair) deleteMany affects 0 rows and we still return
// { ok: true } — DELETE is naturally idempotent and we don't leak whether a
// link was present.
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../../utils/syncHelpers'
import { cuidStrict } from '../../../utils/validation'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'

export default defineEventHandler(async (event) => {
  // Feature gate — mirrors the rest of the document flow.
  if (!useRuntimeConfig().documentsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`doc:detach:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many detach requests' })
  }

  // Document id is in the path; validate its shape (cuidStrict — we minted it).
  const idResult = cuidStrict.safeParse(getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid document id' })
  }
  const documentId = idResult.data

  // mapId arrives via querystring (?mapId=…); validate its shape too.
  const mapIdResult = cuidStrict.safeParse(getQuery(event).mapId)
  if (!mapIdResult.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid map id' })
  }
  const mapId = mapIdResult.data

  // Ownership of the document — the caller's own, non-deleted row, else 404.
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, deletedAt: null },
    select: { id: true },
  })
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  // Delete only the user's own ATTACHED link for this (document, map) pair.
  // GENERATED provenance is never touched. 0 affected rows is still success.
  await prisma.documentMapLink.deleteMany({
    where: { documentId, mapId, linkType: 'ATTACHED', userId },
  })

  return { ok: true }
})
