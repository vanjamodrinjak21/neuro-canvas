import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { checkRateLimit } from '../../../utils/redis'
import { serverEncrypt } from '../../../utils/encryption'
import { validateBody, vaultUpdateSchema } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:write:${userId}`, 20, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }
  const credentialId = getRouterParam(event, 'id')

  if (!credentialId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing credential ID' })
  }

  const body = validateBody(vaultUpdateSchema, await readBody(event))

  // Verify ownership
  const existing = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true }
  })

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
  }

  const data: { encryptedValue?: string; encryptionVersion?: number } = {}

  if (body.encryptedValue) {
    data.encryptedValue = serverEncrypt(body.encryptedValue)
  }
  if (body.encryptionVersion) {
    data.encryptionVersion = body.encryptionVersion
  }

  const updated = await prisma.credential.updateMany({
    where: { id: credentialId, userId },
    data,
  })

  if (updated.count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
  }

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true, provider: true, label: true, encryptionVersion: true, updatedAt: true }
  })

  return { ok: true, credential }
})
