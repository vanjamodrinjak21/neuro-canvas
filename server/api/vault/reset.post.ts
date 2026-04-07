import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'

/**
 * Wipe all credentials for the current user.
 * After reset, user must re-add their API keys.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:reset:${userId}`, 3, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const deleted = await prisma.credential.deleteMany({
    where: { userId },
  })

  return { ok: true, deleted: deleted.count }
})
