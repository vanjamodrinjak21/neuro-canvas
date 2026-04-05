import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'

/**
 * Wipe all credentials for the current user.
 * After reset, user must re-add their API keys.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const deleted = await prisma.credential.deleteMany({
    where: { userId },
  })

  return { ok: true, deleted: deleted.count }
})
