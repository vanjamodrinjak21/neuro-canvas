import { createHash } from 'node:crypto'
import { getToken } from '#auth'
import type { H3Event } from 'h3'
import { prisma } from './prisma'

/**
 * Generate SHA-256 checksum from data
 */
export function generateChecksum(data: unknown): string {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  return createHash('sha256').update(json).digest('hex')
}

/**
 * Compute byte size of data
 */
export function computeByteSize(data: unknown): number {
  const json = typeof data === 'string' ? data : JSON.stringify(data)
  return Buffer.byteLength(json, 'utf8')
}

/**
 * Require authenticated session — returns userId + email or throws 401
 *
 * Uses getToken() instead of getServerSession() because sidebase/nuxt-auth's
 * getServerSession has a bug where it returns null despite valid JWE cookies.
 * getToken() directly decrypts the JWT from the cookie and works reliably.
 *
 * Since getToken() bypasses the jwt/session callbacks, we replicate the
 * password-change invalidation check here to maintain security parity.
 */
// Resolve the JWT secret the SAME way the auth handler signs with
// (server/api/auth/[...].ts → getSecret). If getToken() resolved a different
// secret than the encoder used, every authenticated API call would 401 with a
// valid cookie — pass it explicitly so the two can never drift.
function getAuthSecret(): string {
  return process.env.AUTH_SECRET
    || process.env.NUXT_AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
}

export async function requireAuthSession(event: H3Event): Promise<{ userId: string; email: string }> {
  const secret = getAuthSecret()
  const token = await getToken({
    event,
    ...(secret ? { secret } : {}),
    secureCookie: process.env.NODE_ENV === 'production',
  })

  const id = token?.id as string | undefined
  const email = token?.email as string | undefined
  const iat = token?.iat as number | undefined

  if (!id && !email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Reject tokens explicitly marked expired by the jwt callback
  if ((token as Record<string, unknown>)?.expired) {
    throw createError({ statusCode: 401, statusMessage: 'Session expired' })
  }

  // DB lookup — also verifies user still exists
  const user = id
    ? await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, passwordChangedAt: true, sessionsValidFrom: true, disabledAt: true },
      })
    : await prisma.user.findUnique({
        where: { email: email! },
        select: { id: true, email: true, passwordChangedAt: true, sessionsValidFrom: true, disabledAt: true },
      })

  if (!user || !user.email) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' })
  }

  // Password-change invalidation: reject tokens issued before password change
  if (user.passwordChangedAt && iat) {
    const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000)
    if (changedAtSec > iat) {
      throw createError({ statusCode: 401, statusMessage: 'Password changed — please sign in again' })
    }
  }

  // Account disabled: hard-block regardless of token validity (AER-59).
  // Null disabledAt = active, so existing users are unaffected.
  if (user.disabledAt) {
    throw createError({ statusCode: 403, statusMessage: 'Account disabled' })
  }

  // Per-user session invalidation epoch (AER-59): reject any token minted
  // before the user's sessionsValidFrom watermark (bumped only by logout;
  // password change is enforced separately above via passwordChangedAt). Null
  // watermark = no constraint, so nobody is logged out on deploy.
  if (user.sessionsValidFrom && iat) {
    const validFromSec = Math.floor(user.sessionsValidFrom.getTime() / 1000)
    if (validFromSec > iat) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired — please sign in again' })
    }
  }

  return { userId: user.id, email: user.email }
}
