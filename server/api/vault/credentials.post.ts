import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { serverEncrypt, hashKeyPrefix } from '../../utils/encryption'
import { validateBody, vaultStoreSchema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = await readBody(event)

  // Support rawValue (server-only encryption v4) or encryptedValue (double-encrypted v2)
  const rawValue = body.rawValue as string | undefined
  let encryptedForStorage: string
  let version: number
  let keyHash: string

  if (rawValue) {
    // Server-only encryption: encrypt the raw API key directly
    encryptedForStorage = serverEncrypt(rawValue)
    version = 4
    keyHash = rawValue.length >= 8 ? hashKeyPrefix(rawValue) : ''
  } else {
    // Legacy double-encryption: validate and wrap client-encrypted value
    const validated = validateBody(vaultStoreSchema, body)
    encryptedForStorage = serverEncrypt(validated.encryptedValue)
    version = validated.encryptionVersion
    keyHash = validated.keyPrefix ? hashKeyPrefix(validated.keyPrefix) : ''
  }

  const provider = body.provider as string
  const label = (body.label as string) || ''

  const credential = await prisma.credential.upsert({
    where: {
      userId_provider_label: {
        userId,
        provider,
        label,
      }
    },
    create: {
      userId,
      provider,
      label: label || null,
      encryptedValue: encryptedForStorage,
      keyHash,
      encryptionVersion: version,
    },
    update: {
      encryptedValue: encryptedForStorage,
      keyHash,
      encryptionVersion: version,
    },
    select: { id: true, provider: true, label: true, keyHash: true, encryptionVersion: true, createdAt: true }
  })

  return { ok: true, credential }
})
