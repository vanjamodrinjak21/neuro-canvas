/**
 * Server-side logout — the revocation half of sign-out (AER-59).
 *
 * next-auth's client signOut() clears the web session cookie. That alone does
 * NOT invalidate the underlying JWT: a copy of the token (e.g. a stolen cookie,
 * or the mobile shell's cached JWT in localStorage) stays valid until its
 * natural exp. This endpoint closes that gap by bumping the user's
 * `sessionsValidFrom` watermark to now — after which requireAuthSession()
 * rejects every token minted before this instant — and dropping the user's
 * live-collab jtis from the allowlist.
 *
 * Contract: idempotent and forgiving. It resolves the caller via getToken()
 * (NOT requireAuthSession), so an already-invalid / expired / anonymous session
 * still returns { ok: true } and never 401s. The client calls this immediately
 * before signOut(); a failure here must never block the user from logging out.
 */
import { getToken } from '#auth'
import { prisma } from '../../utils/prisma'
import { revokeUserJtis } from '../../utils/collabJtiStore'

// Resolve the JWT secret the same way the auth handler signs with, so
// getToken() here can never drift from the encoder that minted the cookie.
function getAuthSecret(): string {
  return process.env.AUTH_SECRET
    || process.env.NUXT_AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
}

export default defineEventHandler(async (event) => {
  try {
    const secret = getAuthSecret()
    const token = await getToken({
      event,
      ...(secret ? { secret } : {}),
      secureCookie: process.env.NODE_ENV === 'production',
    })

    const userId = token?.id as string | undefined

    if (userId) {
      // Stamp the invalidation epoch so all tokens issued before now are
      // rejected on the next authenticated request.
      await prisma.user.update({
        where: { id: userId },
        data: { sessionsValidFrom: new Date() },
      })

      // Drop the user's live-collab jtis from the allowlist so an in-flight
      // socket reconnect with the old token can't slip back in.
      await revokeUserJtis(userId)
    }
  } catch (err) {
    // Logout must always succeed from the caller's perspective. Swallow any
    // error (bad/missing session, DB hiccup) and still report ok.
    console.warn('[auth] logout revocation failed (returning ok anyway)', {
      name: (err as Error)?.name,
    })
  }

  return { ok: true }
})
