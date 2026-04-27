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

export default defineEventHandler(async (event) => {
  // Rate-limit by IP first so an attacker who somehow steals the cookie
  // cannot pull the JWT thousands of times to bypass MFA workflows quickly.
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`mobile-token:${ip}`, 20, 600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  // Verify there's a live, non-expired session before echoing the cookie back.
  const verified = await getToken({ event })
  if (!verified || (verified as Record<string, unknown>).expired) {
    throw createError({ statusCode: 401, statusMessage: 'No session' })
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
