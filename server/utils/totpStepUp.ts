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

import { createHash, randomBytes } from 'node:crypto'
import { cache } from './redis'

const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60 // keep in sync with auth session.maxAge

const stepUpKey = (userId: string, iat: number) => `totp-stepup:${userId}:${iat}`

export async function markTotpStepUp(userId: string, iat: number): Promise<void> {
  await cache.set(stepUpKey(userId, iat), true, SESSION_MAX_AGE_SEC)
}

export async function hasTotpStepUp(userId: string, iat: number): Promise<boolean> {
  return (await cache.get<boolean>(stepUpKey(userId, iat))) === true
}

// ─── Remember-device (14 days) ───────────────────────────────────────
// The step-up mark dies with the session (keyed on iat). "Remember this
// device" survives re-sign-ins via an httpOnly cookie holding a random
// token; Redis stores only its SHA-256, keyed per user, so a leaked Redis
// dump can't mint cookies and one user's cookie can't unlock another's
// account. server/middleware/totp-remember.ts redeems it on session
// fetches and marks the fresh session, so remembered devices never see
// the /auth/2fa prompt.

export const TOTP_REMEMBER_COOKIE = 'nc-2fa-remember'
export const TOTP_REMEMBER_TTL_SEC = 14 * 24 * 60 * 60

const rememberKey = (userId: string, tokenHash: string) => `totp-remember:${userId}:${tokenHash}`

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex')

/** Issue a device token: stores the hash, returns the raw value for the cookie. */
export async function issueTotpRememberToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('hex')
  await cache.set(rememberKey(userId, hashToken(raw)), true, TOTP_REMEMBER_TTL_SEC)
  return raw
}

/** True when the presented cookie value matches a live remember-token for this user. */
export async function redeemTotpRememberToken(userId: string, raw: string): Promise<boolean> {
  if (!raw || raw.length > 128) return false
  return (await cache.get<boolean>(rememberKey(userId, hashToken(raw)))) === true
}
