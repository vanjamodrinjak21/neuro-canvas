import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:read:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const credentials = await prisma.credential.findMany({
    where: { userId },
    select: {
      id: true,
      provider: true,
      label: true,
      keyHash: true,
      encryptionVersion: true,
      lastUsed: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { updatedAt: 'desc' }
  })

  return { credentials }
})
