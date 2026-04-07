import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'
import { serverEncrypt, hashKeyPrefix } from '../../utils/encryption'
import { validateBody, vaultStoreSchema, vaultStoreV4Schema } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:${userId}`, 20, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const body = await readBody(event)

  let encryptedForStorage: string
  let version: number
  let keyHash: string
  let provider: string
  let label: string

  if (body.rawValue) {
    // v4: Server-only encryption — validate all fields via Zod
    const validated = validateBody(vaultStoreV4Schema, body)
    encryptedForStorage = serverEncrypt(validated.rawValue)
    version = 4
    keyHash = validated.rawValue.length >= 8 ? hashKeyPrefix(validated.rawValue) : ''
    provider = validated.provider
    label = validated.label || ''
  } else {
    // Legacy double-encryption: validate and wrap client-encrypted value
    const validated = validateBody(vaultStoreSchema, body)
    encryptedForStorage = serverEncrypt(validated.encryptedValue)
    version = validated.encryptionVersion
    keyHash = validated.keyPrefix ? hashKeyPrefix(validated.keyPrefix) : ''
    provider = validated.provider
    label = validated.label || ''
  }

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
