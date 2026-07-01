import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'
import { deleteDocPrefix } from '../../utils/r2'
import { requireAuthSession } from '../../utils/syncHelpers'

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT', {
    message: 'Please type "DELETE MY ACCOUNT" to confirm'
  })
}).strict()

export default defineEventHandler(async (event) => {
  // Full session validation (existence + password-change + disabled +
  // session-invalidation epoch), not just a raw getToken() decode.
  const { email } = await requireAuthSession(event)

  // Rate limit: 3 attempts per hour
  const { allowed } = await checkRateLimit(
    `delete-account:${email}`,
    3,
    3600
  )
  if (!allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Please try again later.'
    })
  }

  const body = await readBody(event)
  const parsed = deleteAccountSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || 'Invalid confirmation'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // Delete user (cascades to sessions, accounts, and Document rows — whose
  // DocumentChunk rows cascade in turn — via Prisma relations / DB cascade).
  await prisma.user.delete({
    where: { id: user.id }
  })

  // GDPR erasure: also remove the user's uploaded document blobs from R2.
  // Postgres rows (Document + its chunk cascade) are already gone above; R2
  // objects live outside the DB and must be swept separately. Best-effort:
  // an R2 failure must NOT block account deletion (the account is already
  // deleted and that is the user's right), but we log the prefix so it can be
  // cleaned up manually. All keys are scoped to docs/{userId}/.
  try {
    await deleteDocPrefix(`docs/${user.id}/`)
  } catch (err) {
    console.error(
      `[account.delete] R2 cleanup failed for prefix "docs/${user.id}/" — ` +
        'account row deletion succeeded; these objects need manual cleanup.',
      err
    )
  }

  return {
    success: true,
    message: 'Account deleted successfully'
  }
})
