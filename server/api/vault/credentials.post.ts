import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { serverEncrypt, hashKeyPrefix } from '../../utils/encryption'
import { validateBody, vaultStoreSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = validateBody(vaultStoreSchema, await readBody(event))

  const doubleEncrypted = serverEncrypt(body.encryptedValue)
  const keyHash = body.keyPrefix ? hashKeyPrefix(body.keyPrefix) : ''

  const credential = await prisma.credential.upsert({
    where: {
      userId_provider_label: {
        userId,
        provider: body.provider,
        label: body.label || ''
      }
    },
    create: {
      userId,
      provider: body.provider,
      label: body.label || null,
      encryptedValue: doubleEncrypted,
      keyHash,
      encryptionVersion: body.encryptionVersion
    },
    update: {
      encryptedValue: doubleEncrypted,
      keyHash,
      encryptionVersion: body.encryptionVersion
    },
    select: { id: true, provider: true, label: true, keyHash: true, encryptionVersion: true, createdAt: true }
  })

  return { ok: true, credential }
})
