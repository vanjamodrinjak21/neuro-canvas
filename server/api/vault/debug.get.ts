import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'

/**
 * Debug endpoint: shows credential state without exposing secrets.
 * Remove after debugging.
 */
export default defineEventHandler(async (event) => {
  const { userId, email } = await requireAuthSession(event)

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

  const totalCredentials = await prisma.credential.count()

  return {
    userId,
    email,
    yourCredentials: credentials,
    totalInDb: totalCredentials,
  }
})
