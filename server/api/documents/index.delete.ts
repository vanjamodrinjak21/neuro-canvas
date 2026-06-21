// ---------------------------------------------------------------------------
// DELETE /api/documents  (Bulk soft-delete — §8)
// ---------------------------------------------------------------------------
//
// Soft-deletes a batch of the caller's documents by stamping deletedAt. The
// body is { ids: string[] } — each id must be a strict cuid, capped at 100 per
// request to bound the updateMany. Validation is inlined here (the shared
// validation.ts is owned by a concurrent build and must not be touched), but it
// reuses the exported `cuidStrict` schema so the cuid shape stays consistent.
//
// updateMany scopes on { userId, deletedAt: null } so ids belonging to another
// tenant (or already-deleted rows) are silently skipped and never counted — the
// returned `deleted` count reflects only rows actually transitioned.
//
// R2 object + DocumentChunk hard cleanup is deferred to the P10 retention
// sweep; this endpoint only flips the soft-delete flag.
// TODO(P10): retention sweep must purge R2 objects + chunks for soft-deleted docs.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { requireAuthSession } from '../../utils/syncHelpers'
import { cuidStrict } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

const deleteBodySchema = z.object({
  ids: z.array(cuidStrict).min(1).max(100),
})

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`doc:delete:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const parsed = deleteBodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? 'Invalid request body',
    })
  }
  const { ids } = parsed.data

  const { count } = await prisma.document.updateMany({
    where: { id: { in: ids }, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  return { deleted: count }
})
