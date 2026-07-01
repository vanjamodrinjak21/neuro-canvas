import { requireAuthSession } from '../../../../utils/syncHelpers'
import { checkRateLimit } from '../../../../utils/redis'
import { resolveCredential } from '../../../../utils/resolveCredential'
import { prisma } from '../../../../utils/prisma'

/**
 * Owner-scoped BYOK reveal — hands the caller their OWN decrypted vault key
 * back to the signed-in device (AER-61). STRICTLY ADDITIVE.
 *
 * WHY THIS EXISTS
 * Native shells (Capacitor iOS/Android, Tauri desktop) call AI providers
 * DIRECTLY from the device, so a user's BYOK key must physically be on-device
 * for generation to work. Web keeps proxying through /api/ai/* and MUST NEVER
 * receive plaintext — this route is for native's direct-provider architecture
 * only. Unlike server/api/ai/keys/reveal.get.ts (an env-allowlisted fallback
 * key for the App Store reviewer), this returns the CALLER'S OWN vault key —
 * never anyone else's, never a shared/server key.
 *
 * SECURITY POSTURE
 * - Authenticated-only: 401 if unauthenticated (NOT forgiving).
 * - Rate-limited per user (10 / 60s) → 429 on exceed, fails closed on Redis
 *   outage (checkRateLimit returns allowed:false).
 * - IDOR-proof: the credential is fetched with an EXPLICIT { id, userId } scope
 *   (resolveCredential → prisma.findFirst where: { id, userId }). A valid id
 *   owned by another user is indistinguishable from a missing id — both 404,
 *   never 403 (no cross-user existence disclosure).
 * - No key material is ever logged; only a single audit line with
 *   { userId, credentialId, provider }.
 * - Response is Cache-Control: no-store (+ Pragma: no-cache) so the plaintext
 *   key is never persisted by any intermediary or the WKWebView cache. HTTPS is
 *   assumed in prod.
 * - resolveCredential stamps lastUsed on the credential (matches existing
 *   reveal/resolve behaviour); no extra write is added here.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // Per-user rate limit — same shape/limits as ai/keys/reveal (10/60s).
  // Fails closed (allowed:false) on a Redis outage.
  const { allowed } = await checkRateLimit(`vault:reveal:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const credentialId = getRouterParam(event, 'id')
  if (!credentialId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing credential ID' })
  }

  // IDOR-proof ownership pre-check: EXPLICIT { id, userId } scope. A credential
  // that exists but belongs to another user is treated exactly like a missing
  // one — 404, never 403 — so ownership can't be probed across accounts.
  // resolveCredential() below re-applies the same { id, userId } scope; this
  // pre-check lets us 404 with certainty before touching any crypto.
  const owned = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true }
  })
  if (!owned) {
    throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
  }

  // Never cache plaintext key material anywhere in the response path.
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Pragma', 'no-cache')

  // Decrypt via the existing owner-scoped path. resolveCredential re-enforces
  // { id, userId } and stamps lastUsed; on failure it throws a 500 whose body
  // carries a generic message + a code only (no key, no ciphertext).
  const { apiKey, provider } = await resolveCredential(userId, credentialId)

  // Audit: one line, NEVER the key itself. Mirrors the structured server logs
  // used elsewhere; the key material is deliberately absent.
  console.info('[audit] credential_revealed', JSON.stringify({ userId, credentialId, provider }))

  return { provider, apiKey }
})
