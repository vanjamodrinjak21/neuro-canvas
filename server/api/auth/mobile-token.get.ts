/**
 * Mobile Token Endpoint
 *
 * Returns the raw session JWT cookie value for the authenticated user.
 * Used by the mobile-callback page to pass the token to the native app
 * so it can set it in CapacitorHttp's cookie jar for authenticated sync.
 */
export default defineEventHandler(async (event) => {
  // Read the session cookie directly from the request
  const cookieName = process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'

  const token = getCookie(event, cookieName)

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'No session' })
  }

  return { token, cookieName }
})
