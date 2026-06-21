// ---------------------------------------------------------------------------
// POST /api/documents/[id]/attach  (Document RAG — link an existing doc to a map)
// ---------------------------------------------------------------------------
//
// Creates a user-initiated ATTACHED link between an already-ingested document
// and a map the caller owns, so the map's RAG context can draw on that
// document's chunks. Mirrors the auth → rate-limit → ownership → prisma shape
// of search/semantic.post.ts and documents/[id]/confirm.post.ts.
//
// linkType ATTACHED is the only kind this endpoint mints. GENERATED links are
// provenance written by the map-generation flow and are NOT user-creatable
// here. The @@unique([documentId, mapId, linkType]) constraint lets a GENERATED
// and an ATTACHED link co-exist for the same (document, map) pair, and makes a
// duplicate ATTACHED a no-op: a P2002 collision is treated as success so the
// endpoint is idempotent (repeat attaches return the same { ok: true }).
//
// Ownership is verified on BOTH sides independently — the document AND the map
// must each be the caller's own, non-deleted row, else 404 (we never disclose
// existence of resources the caller doesn't own).
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../../utils/syncHelpers'
import { validateBody, documentAttachSchema, cuidStrict } from '../../../utils/validation'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'

// Postgres/Prisma unique-violation code — a duplicate ATTACHED link for this
// (documentId, mapId) pair. Caught and treated as idempotent success.
const PG_UNIQUE_VIOLATION = 'P2002'

export default defineEventHandler(async (event) => {
  // Feature gate — mirrors the rest of the document flow.
  if (!useRuntimeConfig().documentsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`doc:attach:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attach requests' })
  }

  // Document id is in the path; validate its shape (cuidStrict — we minted it).
  const idResult = cuidStrict.safeParse(getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid document id' })
  }
  const documentId = idResult.data

  const { mapId } = validateBody(documentAttachSchema, await readBody(event))

  // Ownership on BOTH sides — each must be the caller's own, non-deleted row.
  // Run the two existence checks concurrently; a missing/foreign either side
  // is a 404 (no resource disclosure).
  const [document, map] = await Promise.all([
    prisma.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.map.findFirst({
      where: { id: mapId, userId, deletedAt: null },
      select: { id: true },
    }),
  ])
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // Create the ATTACHED link. A unique-constraint collision means the link
  // already exists → idempotent success. Any other error propagates.
  try {
    await prisma.documentMapLink.create({
      data: { documentId, mapId, linkType: 'ATTACHED', userId },
    })
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== PG_UNIQUE_VIOLATION) {
      throw err
    }
  }

  return { ok: true }
})
