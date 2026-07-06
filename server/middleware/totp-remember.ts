/**
 * Remember-device redemption for 2FA (AER-84).
 *
 * Runs only on session fetches that carry the remember cookie: if the JWT
 * says this 2FA-enabled session hasn't verified a code yet ('pending') but
 * the device holds a live remember-token, mark the session verified — the
 * session callback then reports totpPending=false and the /auth/2fa prompt
 * never appears on this device for the token's 14-day life.
 *
 * Never throws: 2FA UX must not take down session fetches. Redemption
 * failures simply leave the session pending (the prompt shows).
 */

import { getToken } from '#auth'
import {
  TOTP_REMEMBER_COOKIE,
  redeemTotpRememberToken,
  hasTotpStepUp,
  markTotpStepUp,
} from '../utils/totpStepUp'

export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname !== '/api/auth/session') return

  const raw = getCookie(event, TOTP_REMEMBER_COOKIE)
  if (!raw) return

  try {
    const secret = process.env.AUTH_SECRET || process.env.NUXT_AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
    const token = await getToken({
      event,
      ...(secret ? { secret } : {}),
      secureCookie: process.env.NODE_ENV === 'production',
    })
    const userId = token?.id as string | undefined
    const iat = token?.iat as number | undefined
    if (!userId || !iat || (token as Record<string, unknown>)?.totp !== 'pending') return
    if (await hasTotpStepUp(userId, iat)) return

    if (await redeemTotpRememberToken(userId, raw)) {
      await markTotpStepUp(userId, iat)
    }
  } catch {
    // Redis/JWT hiccup — leave the session pending; the 2FA page still works.
  }
})
