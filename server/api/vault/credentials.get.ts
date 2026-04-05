import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

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
