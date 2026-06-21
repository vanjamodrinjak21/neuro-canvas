// ---------------------------------------------------------------------------
// GET /api/documents/[id]/status  (Document RAG — upload modal status poll)
// ---------------------------------------------------------------------------
//
// Returns the live ingestion state of one of the caller's documents so the
// upload modal can poll PENDING → QUEUED → PROCESSING → READY/FAILED and show
// progress (chunkCount / pageCount) or a sanitized errorMessage. Mirrors the
// auth → rate-limit → validate → ownership → prisma shape of the confirm
// endpoint alongside it.
//
// errorMessage is the sanitized column (never carries r2Key/stack) so it is
// safe to surface to the client. chunkCount/pageCount may be 0/null until the
// worker has made progress. A foreign or soft-deleted doc 404s — ownership is
// scoped by userId + deletedAt IS NULL in the query itself.
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../../utils/syncHelpers'
import { cuidStrict } from '../../../utils/validation'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // 120/min/user — polling-friendly (a poll every ~1-2s while a doc ingests).
  // The key is passed VERBATIM to checkRateLimit (own bucket).
  const { allowed } = await checkRateLimit(`doc:status:${userId}`, 120, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many status requests' })
  }

  // Document id is in the path; validate its shape (cuidStrict — we minted it).
  const idResult = cuidStrict.safeParse(getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid document id' })
  }
  const documentId = idResult.data

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, deletedAt: null },
    select: {
      id: true,
      status: true,
      chunkCount: true,
      pageCount: true,
      errorMessage: true,
    },
  })
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  return document
})
