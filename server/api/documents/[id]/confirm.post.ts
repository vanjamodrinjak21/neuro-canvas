// ---------------------------------------------------------------------------
// POST /api/documents/[id]/confirm  (Document RAG — step 3 of the upload flow)
// ---------------------------------------------------------------------------
//
// Called after the browser has PUT the bytes directly to R2. Promotes the
// PENDING row to QUEUED so the (P4) ingestion worker can pick it up. Mirrors
// the auth → rate-limit → ownership → prisma shape of search/semantic.post.ts.
//
// R2 does not enforce content-length on a presigned PUT, so this endpoint is
// the AUTHORITATIVE size + MIME gate: HeadObject the uploaded object and assert
// the recorded size ≈ declared byteSize AND the content type matches what we
// signed. A violation means a tampered/oversized upload → delete the R2 object,
// soft-delete the row, and 422. (Plan §0(a)/§2/§4, council SEC-3.)
//
// Concurrency: reserveIngest claims one of the user's ingestion slots (cap 3)
// atomically before flipping to QUEUED. If the user is at the cap the row stays
// PENDING and we return 429. On ANY error AFTER a successful reserve we MUST
// releaseIngest (finally), or a thrown 5xx would leak the slot.
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../../utils/syncHelpers'
import { validateBody, documentConfirmSchema, cuidStrict } from '../../../utils/validation'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit, reserveIngest, releaseIngest } from '../../../utils/redis'
import { headDocObject, deleteDocObject } from '../../../utils/r2'
import { enqueueIngestion } from '../../../utils/documentIngestion'

// HeadObject-reported size must be within this fraction of the declared size.
// R2 records the exact uploaded length, so the only legitimate slack is none;
// a small tolerance absorbs metadata/encoding rounding without opening a hole.
const SIZE_TOLERANCE = 0.02 // ±2%

// Per-user concurrent-ingestion ceiling (Redis Lua reserve, plan §2).
const INGEST_CONCURRENCY_CAP = 3

export default defineEventHandler(async (event) => {
  // Feature gate — mirrors presign.
  if (!useRuntimeConfig().documentsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`doc:confirm:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many confirm requests' })
  }

  // Document id is in the path; validate its shape (cuidStrict — we minted it).
  const idResult = cuidStrict.safeParse(getRouterParam(event, 'id'))
  if (!idResult.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid document id' })
  }
  const documentId = idResult.data

  // Confirm carries no body, but validate it anyway for parity / strictness.
  validateBody(documentConfirmSchema, await readBody(event).catch(() => ({})))

  // Ownership + state: must be the caller's own, non-deleted, still-PENDING doc.
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, deletedAt: null },
    select: { id: true, r2Key: true, byteSize: true, mimeType: true, status: true },
  })
  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }
  if (document.status !== 'PENDING') {
    // Already confirmed / processing / done — not a re-confirmable state.
    throw createError({ statusCode: 409, statusMessage: 'Document already confirmed' })
  }

  // AUTHORITATIVE size + MIME gate. HeadObject the uploaded object. On any
  // violation (or a missing object → HeadObject throws) delete the R2 object,
  // soft-delete the row, and 422. No reserve has been taken yet, so nothing to
  // release on this path.
  let head: { contentLength: number; contentType: string }
  try {
    head = await headDocObject(document.r2Key)
  } catch {
    // Object absent / unreadable → the upload never landed. Soft-delete so the
    // row can't linger as a phantom PENDING (and free its quota slot).
    await prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), status: 'FAILED', errorMessage: 'Upload not found in storage' },
    })
    throw createError({ statusCode: 422, statusMessage: 'Uploaded object not found' })
  }

  const minBytes = Math.floor(document.byteSize * (1 - SIZE_TOLERANCE))
  const maxBytes = Math.ceil(document.byteSize * (1 + SIZE_TOLERANCE))
  const sizeOk = head.contentLength >= minBytes && head.contentLength <= maxBytes
  const mimeOk = head.contentType === document.mimeType

  if (!sizeOk || !mimeOk) {
    await deleteDocObject(document.r2Key).catch(() => {})
    await prisma.document.update({
      where: { id: documentId },
      data: {
        deletedAt: new Date(),
        status: 'FAILED',
        errorMessage: !sizeOk ? 'Uploaded size mismatch' : 'Uploaded content type mismatch',
      },
    })
    throw createError({ statusCode: 422, statusMessage: 'Uploaded object failed validation' })
  }

  // Claim a concurrency slot atomically. At/over cap → keep PENDING, 429.
  const reserve = await reserveIngest(userId, INGEST_CONCURRENCY_CAP)
  if (!reserve.ok) {
    throw createError({ statusCode: 429, statusMessage: 'Too many documents processing' })
  }

  // From here on a slot is held — release it on EVERY error path.
  try {
    // Flip to QUEUED only from PENDING (guards against a concurrent confirm that
    // already advanced the row). count===0 means another caller won the race.
    const claimed = await prisma.document.updateMany({
      where: { id: documentId, userId, status: 'PENDING', deletedAt: null },
      data: { status: 'QUEUED' },
    })
    if (claimed.count === 0) {
      throw createError({ statusCode: 409, statusMessage: 'Document already confirmed' })
    }

    // Enqueue ingestion (producer seam). The worker is what actually claims
    // QUEUED→PROCESSING and calls releaseIngest when done; this endpoint only
    // reserves the slot and marks the row QUEUED. enqueueIngestion is
    // fire-and-forget and never throws, so it cannot leak the reserve here.
    enqueueIngestion(documentId)
    return { status: 'queued' }
  } catch (err) {
    // Any failure after the reserve leaks the slot unless we release it. The
    // worker has NOT been handed the row (enqueue is the last step), so the
    // reserve is ours to free here.
    await releaseIngest(userId)
    throw err
  }
})
