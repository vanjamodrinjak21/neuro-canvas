import { getServerSession, getToken } from '#auth'
import { parseCookies } from 'h3'

// Temporary debug endpoint — remove after auth is fixed
export default defineEventHandler(async (event) => {
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

  // Check if cookie looks like a JWT (has 3 dot-separated parts)
  const isJWT = rawCookie ? rawCookie.split('.').length === 3 : false

  // Try to decode JWT payload (base64, no verification) to see what's inside
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
