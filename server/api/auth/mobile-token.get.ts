/**
 * Mobile Token Endpoint
 *
 * Returns the raw session JWT cookie value for the authenticated user so the
 * native shell can attach it to subsequent CapacitorHttp calls.
 *
 * Hardened:
 *   - Rejects requests where the next-auth session cannot be verified.
 *   - Refuses to return a token whose underlying password-change flag is set
 *     (i.e. one the rest of the app would treat as expired).
 *   - Sets Cache-Control: no-store so the JWT does not end up in any
 *     intermediary or browser cache.
 */
import { getToken } from '#auth'
import { checkRateLimit } from '../../utils/redis'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Rate-limit by IP first so an attacker who somehow steals the cookie
  // cannot pull the JWT thousands of times to bypass MFA workflows quickly.
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`mobile-token:${ip}`, 20, 600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  // Verify there's a live, non-expired session before echoing the cookie back.
  //
  // This endpoint is hit at LOGIN time to mint the mobile session, so we do
  // NOT route through requireAuthSession() (which is tuned for post-login REST
  // calls and resolves the secret explicitly). Instead we keep the bare
  // getToken() cookie-echo path intact and inline the login-safe subset of the
  // hardening checks requireAuthSession applies — user-exists,
  // password-change-vs-iat, and the AER-59 disabled check — so a freshly minted
  // token is accepted but a stale/password-rotated/disabled identity is
  // refused. The `sessionsValidFrom` (logout) epoch is deliberately NOT checked
  // here; it would race the fresh token at login (see below).
  const verified = await getToken({ event })
  if (!verified || (verified as Record<string, unknown>).expired) {
    throw createError({ statusCode: 401, statusMessage: 'No session' })
  }

  const uid = verified.id as string | undefined
  const uemail = verified.email as string | undefined
  const iat = verified.iat as number | undefined
  if (!uid && !uemail) {
    throw createError({ statusCode: 401, statusMessage: 'No session' })
  }

  const user = uid
    ? await prisma.user.findUnique({
        where: { id: uid },
        select: { id: true, passwordChangedAt: true, disabledAt: true },
      })
    : await prisma.user.findUnique({
        where: { email: uemail! },
        select: { id: true, passwordChangedAt: true, disabledAt: true },
      })

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No session' })
  }

  if (user.disabledAt) {
    throw createError({ statusCode: 403, statusMessage: 'Account disabled' })
  }

  // Reject tokens issued before a password change. Null watermark = no
  // constraint, so a normal login is unaffected.
  //
  // We intentionally do NOT apply the `sessionsValidFrom` (logout) epoch here.
  // This endpoint runs at LOGIN time to mint the mobile session: a freshly
  // signed-in user whose new token's `iat` predates their last logout's epoch
  // (clock skew / cookie-propagation race) would be wrongly 401'd and unable to
  // sign back in. The logout epoch belongs on subsequent authenticated REST
  // calls, which mobile routes through requireAuthSession().
  if (iat) {
    if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > iat) {
      throw createError({ statusCode: 401, statusMessage: 'Session expired — please sign in again' })
    }
  }

  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  const token = getCookie(event, cookieName)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'No session' })
  }

  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, private')
  setResponseHeader(event, 'Pragma', 'no-cache')

  return { token, cookieName }
})
