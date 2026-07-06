/**
 * Post-login TOTP verification state (AER-84).
 *
 * Credentials sign-in verifies TOTP inline in authorize(), but OAuth sign-ins
 * (Google / GitHub / Apple) complete with no second factor. Rather than
 * injecting a TOTP step into next-auth's OAuth flow, the JWT records HOW the
 * session authenticated (`token.totp` claim) and 2FA-enabled OAuth sessions
 * are marked `totpPending` until the user verifies a code once via
 * POST /api/user/totp/verify-session — the auth middleware routes them to
 * /auth/2fa right after sign-in.
 *
 * Verification marks live in Redis keyed on (userId, token.iat): `iat` is
 * minted once per sign-in and survives rolling re-issues, so a mark covers
 * exactly one session. TTL mirrors the session maxAge.
 */

import { cache } from './redis'

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60 // keep in sync with auth session.maxAge

const stepUpKey = (userId: string, iat: number) => `totp-stepup:${userId}:${iat}`

export async function markTotpStepUp(userId: string, iat: number): Promise<void> {
  await cache.set(stepUpKey(userId, iat), true, SESSION_MAX_AGE_SEC)
}

export async function hasTotpStepUp(userId: string, iat: number): Promise<boolean> {
  return (await cache.get<boolean>(stepUpKey(userId, iat))) === true
}
