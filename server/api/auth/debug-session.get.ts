import { getServerSession, getToken } from '#auth'
import { parseCookies } from 'h3'

// Debug-only endpoint. Hard-blocked outside development so a forgotten
// deploy doesn't expose JWT payload / AUTH_SECRET length / cookie shape
// to anyone who knows the URL.
export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const cookies = parseCookies(event)
  const secureCookie = cookies['__Secure-next-auth.session-token']
  const devCookie = cookies['next-auth.session-token']
  const rawCookie = secureCookie || devCookie || null

  let session: unknown = null
  let sessionError: string | null = null
  try {
    session = await getServerSession(event)
  } catch (e) {
    sessionError = e instanceof Error ? e.message : String(e)
  }

  let token: unknown = null
  let tokenError: string | null = null
  try {
    token = await getToken({ event })
  } catch (e) {
    tokenError = e instanceof Error ? e.message : String(e)
  }

  const isJWT = rawCookie ? rawCookie.split('.').length === 3 : false

  let jwtPayload: unknown = null
  if (rawCookie && isJWT) {
    try {
      const parts = rawCookie.split('.')
      const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8')
      jwtPayload = JSON.parse(payload)
    } catch {
      jwtPayload = 'failed to decode'
    }
  }

  const secretSet = !!process.env.AUTH_SECRET
  const secretLength = (process.env.AUTH_SECRET || '').length

  return {
    secretSet,
    secretLength,
    hasCookie: !!rawCookie,
    isJWT,
    cookieLength: rawCookie?.length || 0,
    session: session ? 'present' : null,
    sessionUser: (session as any)?.user ? Object.keys((session as any).user) : null,
    sessionError,
    token: token ? 'present' : null,
    tokenError,
    jwtPayload,
    nodeEnv: process.env.NODE_ENV,
  }
})
