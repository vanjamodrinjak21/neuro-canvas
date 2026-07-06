import { prisma } from './prisma'
import { serverFullDecrypt } from './encryption'

/**
 * Resolve an API key from the vault.
 * - If credentialId provided: fetch that specific credential
 * - Otherwise: find user's most recent credential (provider-scoped when the
 *   caller states one, so an anthropic request never resolves an openai key)
 * Always decrypts server-side. Self-heals rotated keys.
 *
 * AER-79: when `opts.provider` is given, a STALE credentialId (row deleted +
 * re-added on another device while this client was running) falls back to the
 * user's most recent credential for that provider instead of hard-failing
 * until the client reloads. Callers that must be id-strict — the /reveal
 * endpoint — pass no provider and keep exact-row 404 semantics.
 */
export async function resolveCredential(
  userId: string,
  credentialId?: string,
  opts?: { provider?: string }
): Promise<{ apiKey: string; provider: string; credentialId: string }> {
  const select = { id: true, provider: true, encryptedValue: true, encryptionVersion: true }
  const byProvider = opts?.provider
    ? {
        where: { userId, provider: opts.provider },
        orderBy: { updatedAt: 'desc' as const },
        select
      }
    : null

  let credential = credentialId
    ? await prisma.credential.findFirst({
        where: { id: credentialId, userId },
        select
      })
    : await prisma.credential.findFirst(
        byProvider ?? {
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          select
        }
      )

  if (!credential && credentialId && byProvider) {
    credential = await prisma.credential.findFirst(byProvider)
  }

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
