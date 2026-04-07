import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { checkRateLimit } from '../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:read:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }
  const credentialId = getRouterParam(event, 'id')

  if (!credentialId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing credential ID' })
  }

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true, provider: true, label: true, keyHash: true, encryptionVersion: true, lastUsed: true, createdAt: true, updatedAt: true }
  })

  if (!credential) {
    throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
  }

  // Never return decrypted key material to the client.
  // Keys are decrypted server-side only when calling AI providers.
  return {
    id: credential.id,
    provider: credential.provider,
    label: credential.label,
    keyHash: credential.keyHash,
    encryptionVersion: credential.encryptionVersion,
    lastUsed: credential.lastUsed,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt
  }
})
