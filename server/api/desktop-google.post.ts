/**
 * Desktop OAuth — Google sign-in for the Tauri shell.
 *
 * Flow:
 *   1. Tauri opens an in-app WebviewWindow pointed at Google's auth URL with PKCE.
 *   2. Google redirects to our `redirect_uri` with `?code=...`.
 *   3. The Tauri composable POSTs `{ code, codeVerifier, redirectUri }` here.
 *   4. We exchange the code for tokens server-side (the secret never ships in
 *      the desktop binary), verify the ID token, upsert the user, and mint a
 *      next-auth-compatible session JWT.
 *   5. We set the session cookie on the response so the same origin (e.g.
 *      neuro-canvas.com) is signed in for the WebviewWindow that called us.
 *      The composable then reads the cookie via document.cookie or via the
 *      shared session and propagates it into the main Tauri window.
 */
import { encode as encodeJwt } from 'next-auth/jwt'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { checkRateLimit } from '../utils/redis'

// Two shapes accepted:
//   1. Desktop (Tauri) PKCE flow → { code, codeVerifier, redirectUri }
//   2. Native (Android / iOS) flow → { idToken } from the platform's
//      Google Sign-In SDK; we just validate audience and trust Google's signature
//      after a fresh JWKS check happens implicitly via tokeninfo (defense in depth).
const Body = z.union([
  z.object({
    code: z.string().min(10).max(2048),
    codeVerifier: z.string().min(43).max(128),
    redirectUri: z.string().url(),
  }),
  z.object({
    idToken: z.string().min(40).max(4096),
    platform: z.enum(['android', 'ios']).optional(),
  }),
])

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  expires_in: number
  scope: string
  token_type: string
}

interface GoogleIdToken {
  iss: string
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  aud: string
}

function decodeJwtPayload(token: string): GoogleIdToken {
  const [, payload] = token.split('.')
  if (!payload) throw createError({ statusCode: 400, statusMessage: 'Malformed ID token' })
  // Node's atob handles base64url after a small replace.
  const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  return JSON.parse(json) as GoogleIdToken
}

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`desktop-oauth:${ip}`, 10, 600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const desktopClientId = process.env.GOOGLE_DESKTOP_CLIENT_ID
  const desktopClientSecret = process.env.GOOGLE_DESKTOP_CLIENT_SECRET
  const androidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID
  const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID

  // Audiences allowed to authenticate via this endpoint. We refuse anything
  // signed for a different OAuth client to avoid token replay across apps.
  const allowedAudiences = new Set<string>(
    [desktopClientId, androidClientId, iosClientId].filter((v): v is string => Boolean(v)),
  )
  if (allowedAudiences.size === 0) {
    throw createError({ statusCode: 500, statusMessage: 'Native Google sign-in not configured' })
  }

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }

  let idToken: string

  if ('code' in parsed.data) {
    // Desktop / Tauri — PKCE code exchange.
    if (!desktopClientId || !desktopClientSecret) {
      throw createError({ statusCode: 500, statusMessage: 'Desktop OAuth not configured' })
    }
    const { code, codeVerifier, redirectUri } = parsed.data
    const tokenRes = await $fetch<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: desktopClientId,
        client_secret: desktopClientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    }).catch((err) => {
      console.warn('[desktop-google] token exchange failed:', err?.data || err?.message)
      throw createError({ statusCode: 401, statusMessage: 'OAuth code exchange failed' })
    })
    idToken = tokenRes.id_token
  } else {
    // Native (Android / iOS) — ID token from the Google Sign-In SDK on device.
    idToken = parsed.data.idToken

    // Defense in depth: bounce the token off Google's tokeninfo endpoint to
    // confirm signature + freshness before we trust the unverified payload.
    const tokenInfo = await $fetch<{ aud?: string; email?: string; email_verified?: string }>(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    ).catch(() => null)
    if (!tokenInfo || !tokenInfo.aud || tokenInfo.email_verified !== 'true') {
      throw createError({ statusCode: 401, statusMessage: 'Google ID token rejected' })
    }
    if (!allowedAudiences.has(tokenInfo.aud)) {
      throw createError({ statusCode: 401, statusMessage: 'ID token audience not allowed' })
    }
  }

  const idClaims = decodeJwtPayload(idToken)
  if (!allowedAudiences.has(idClaims.aud)) {
    throw createError({ statusCode: 401, statusMessage: 'ID token audience mismatch' })
  }
  if (!idClaims.email || !idClaims.email_verified) {
    throw createError({ statusCode: 401, statusMessage: 'Email not verified by Google' })
  }

  // 3. Upsert the user record.
  const user = await prisma.user.upsert({
    where: { email: idClaims.email.toLowerCase() },
    create: {
      email: idClaims.email.toLowerCase(),
      name: idClaims.name ?? idClaims.email.split('@')[0],
      image: idClaims.picture ?? null,
      emailVerified: new Date(),
    },
    update: {
      name: idClaims.name ?? undefined,
      image: idClaims.picture ?? undefined,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, name: true, image: true },
  })

  // 4. Mint a session JWT compatible with @sidebase/nuxt-auth.
  const isProduction = process.env.NODE_ENV === 'production'
  const maxAgeSeconds = 6 * 60 * 60 // mirror server/api/auth/[...].ts
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'AUTH_SECRET missing' })
  }

  const sessionToken = await encodeJwt({
    token: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.image ?? undefined,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    maxAge: maxAgeSeconds,
  })

  const cookieName = isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
  setCookie(event, cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: maxAgeSeconds,
  })

  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    ok: true,
    user,
    cookieName,
    sessionToken,
  }
})
