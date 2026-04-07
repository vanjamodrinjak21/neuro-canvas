import { prisma } from './prisma'
import { serverFullDecrypt } from './encryption'

/**
 * Resolve an API key from the vault.
 * - If credentialId provided: fetch that specific credential
 * - Otherwise: find user's most recent credential
 * Always decrypts server-side. Self-heals rotated keys.
 */
export async function resolveCredential(
  userId: string,
  credentialId?: string
): Promise<{ apiKey: string; provider: string; credentialId: string }> {
  const credential = credentialId
    ? await prisma.credential.findFirst({
        where: { id: credentialId, userId },
        select: { id: true, provider: true, encryptedValue: true, encryptionVersion: true }
      })
    : await prisma.credential.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, provider: true, encryptedValue: true, encryptionVersion: true }
      })

  if (!credential) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No API credential found. Add an API key in Settings > AI Providers.'
    })
  }

  try {
    const result = serverFullDecrypt(userId, credential.encryptedValue, credential.encryptionVersion)

    // Self-heal: re-encrypt with current AUTH_SECRET if rotated
    const updateData: { lastUsed: Date; encryptedValue?: string; encryptionVersion?: number } = { lastUsed: new Date() }
    if (result.credentialUpdate) {
      updateData.encryptedValue = result.credentialUpdate.encryptedValue
      updateData.encryptionVersion = result.credentialUpdate.encryptionVersion
    }
    prisma.credential.update({
      where: { id: credential.id },
      data: updateData
    }).catch((err) => console.error('resolveCredential: self-heal update failed:', err))

    return {
      apiKey: result.plaintext,
      provider: credential.provider,
      credentialId: credential.id
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to decrypt API key. Try removing and re-adding your key in Settings.',
      data: { code: 'CREDENTIAL_DECRYPT_FAILED' }
    })
  }
}
