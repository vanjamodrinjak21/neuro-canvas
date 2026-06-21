// ---------------------------------------------------------------------------
// POST /api/documents/presign  (Document RAG — step 1 of the upload flow)
// ---------------------------------------------------------------------------
//
// Mints a presigned R2 PUT URL the browser uploads bytes directly to, and
// creates the owning Document row in status=PENDING. Mirrors the auth →
// rate-limit → validate → ownership → prisma shape of search/semantic.post.ts.
//
// Why a presigned PUT (not POST): R2 does not support POST policies /
// content-length-range, so the declared `sizeBytes` here is advisory. The
// authoritative size gate is the HeadObject-after-upload check in the matching
// `confirm` endpoint. We sign Content-Type into the URL so R2 returns 403 on a
// MIME mismatch. See r2.ts + plan §0(a)/§2/§4.
//
// id / r2Key: r2Key embeds the document id, but Prisma mints the cuid id
// engine-side at INSERT — so the id is not known before the row exists. We
// create the row (Prisma generates a native cuid, which satisfies cuidStrict),
// then set r2Key = makeDocKey(userId, id, filename) in the same transaction.
// The first INSERT carries a unique temporary r2Key sentinel so the NOT NULL +
// UNIQUE r2Key constraint is satisfied for the instant before the update lands.
//
// sha256 is the RAW-FILE hash and can only be computed once the bytes exist in
// R2 — i.e. at ingestion (P4), not here. The column is NOT NULL CHAR(64) with a
// partial unique index (userId, sha256) WHERE deletedAt IS NULL, so a shared
// constant placeholder would collide across concurrent PENDING rows. We seed a
// per-document UNIQUE 64-hex sentinel derived from the row id; the ingestion
// worker overwrites it with the real raw-bytes hash and dedups at that point.
// Dedup is intentionally NOT attempted here (the hash is not yet known).
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import { nanoid } from 'nanoid'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, documentPresignSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'
import { makeDocKey, createPresignedUpload } from '../../utils/r2'

// Per-user storage caps (plan §2). Over either cap → 413.
const MAX_DOCS_PER_USER = 100
const MAX_BYTES_PER_USER = 500 * 1024 * 1024 // 500 MB

// Presigned PUT TTL — short window; the client must start the upload promptly.
const PRESIGN_TTL_SEC = 300

export default defineEventHandler(async (event) => {
  // Feature gate — when documents are disabled there is no R2 to sign against.
  if (!useRuntimeConfig().documentsEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const { userId } = await requireAuthSession(event)

  // 30/min/user — generous for an upload session, blocks bot loops. The key is
  // passed VERBATIM to checkRateLimit (each purpose gets its own bucket).
  const { allowed } = await checkRateLimit(`doc:presign:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many upload requests' })
  }

  const { filename, declaredMime, sizeBytes, intent, attachToMapId } =
    validateBody(documentPresignSchema, await readBody(event))

  // attach_source must target a map the caller owns. Verify BEFORE creating any
  // row so a forged/foreign mapId is rejected up front.
  if (intent === 'attach_source') {
    if (!attachToMapId) {
      throw createError({ statusCode: 400, statusMessage: 'attachToMapId is required for attach_source' })
    }
    const ownedMap = await prisma.map.findFirst({
      where: { id: attachToMapId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!ownedMap) {
      throw createError({ statusCode: 404, statusMessage: 'Map not found' })
    }
  }

  // Per-user quota: COUNT + SUM(byteSize) over the user's non-deleted docs.
  // The new doc's own declared size counts toward the byte cap. Reject 413 over
  // either ceiling so a user can't exhaust storage. PENDING rows count too —
  // they reserve a slot until the retention sweep reclaims abandoned uploads.
  const [docCount, sizeAgg] = await Promise.all([
    prisma.document.count({ where: { userId, deletedAt: null } }),
    prisma.document.aggregate({
      where: { userId, deletedAt: null },
      _sum: { byteSize: true },
    }),
  ])
  const usedBytes = sizeAgg._sum.byteSize ?? 0

  if (docCount >= MAX_DOCS_PER_USER) {
    throw createError({ statusCode: 413, statusMessage: 'Document count quota exceeded' })
  }
  if (usedBytes + sizeBytes > MAX_BYTES_PER_USER) {
    throw createError({ statusCode: 413, statusMessage: 'Storage quota exceeded' })
  }

  // Create the row so Prisma mints the cuid id, then derive r2Key + the unique
  // sha256 sentinel from that id. A unique temporary r2Key/sha256 placeholder
  // keeps the NOT NULL + UNIQUE constraints satisfied across the two steps; the
  // transaction ensures the bogus values are never observable post-commit.
  const tempToken = nanoid(24)
  const document = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        userId,
        filename,
        mimeType: declaredMime,
        byteSize: sizeBytes,
        // Temporary unique placeholders — overwritten in the same transaction.
        sha256: createHash('sha256').update(tempToken).digest('hex'),
        r2Key: `pending/${userId}/${tempToken}`,
        status: 'PENDING',
        source: 'UPLOAD',
      },
      select: { id: true },
    })
    return tx.document.update({
      where: { id: created.id },
      data: {
        r2Key: makeDocKey(userId, created.id, filename),
        // Unique per-document sha256 sentinel (NOT a shared constant) so the
        // partial unique (userId, sha256) index can never collide across
        // concurrent PENDING rows. The P4 worker replaces it with the real
        // raw-file hash.
        sha256: createHash('sha256').update(created.id).digest('hex'),
      },
      select: { id: true, r2Key: true },
    })
  })

  // Sign Content-Type into the PUT URL → R2 403s on a MIME mismatch.
  const uploadUrl = await createPresignedUpload(document.r2Key, declaredMime, PRESIGN_TTL_SEC)

  // r2Key is server-internal and intentionally NOT returned to the client.
  return { documentId: document.id, uploadUrl }
})
