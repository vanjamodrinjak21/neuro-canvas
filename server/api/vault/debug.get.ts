import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'

/**
 * Debug endpoint: shows credential state without exposing secrets.
 */
export default defineEventHandler(async (event) => {
  const { userId, email } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:debug:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const credentials = await prisma.credential.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      label: true,
      encryptionVersion: true,
      keyHash: true,
      lastUsed: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    userId,
    email,
    yourCredentials: credentials,
  }
})
