import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { serverDecrypt } from '../../../utils/encryption'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const credentialId = getRouterParam(event, 'id')

  if (!credentialId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing credential ID' })
  }

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true, provider: true, label: true, encryptedValue: true, encryptionVersion: true }
  })

  if (!credential) {
    throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
  }

  // Remove server encryption layer, return client-encrypted value
  const { decrypted: clientEncryptedValue } = serverDecrypt(credential.encryptedValue)

  // Update lastUsed
  await prisma.credential.update({
    where: { id: credentialId },
    data: { lastUsed: new Date() }
  })

  return {
    id: credential.id,
    provider: credential.provider,
    label: credential.label,
    encryptedValue: clientEncryptedValue, // Still KEK-encrypted by client
    encryptionVersion: credential.encryptionVersion
  }
})
