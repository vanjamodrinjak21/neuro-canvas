import { requireAuthSession } from '../../../utils/syncHelpers'
import { checkRateLimit } from '../../../utils/redis'

/**
 * Review/owner-only API key reveal — STRICTLY ADDITIVE + ENV-GATED.
 *
 * Native builds (Capacitor iOS/Android, Tauri desktop) call AI providers
 * DIRECTLY from the device, so the key has to physically be on-device for
 * generation to work. This endpoint hands a server-configured key to the
 * signed-in device ONLY when the authenticated account is on an explicit
 * allowlist (APP_REVIEW_EMAILS) and a fallback key is configured
 * (APP_REVIEW_AI_KEY).
 *
 * Why this exists: the App Store reviewer signs in with the demo account and
 * has no key — without this, AI map generation (the core feature) fails during
 * review. Putting the key in an env var (not the app binary / not git) means
 * the secret never ships inside the build Apple distributes; only an
 * authenticated, allowlisted device can pull it.
 *
 * Fails closed: if the feature isn't configured, or the caller isn't on the
 * allowlist, it 404s and nothing else about the system changes. It does NOT
 * read the vault and does NOT alter any existing flow.
 */
export default defineEventHandler(async (event) => {
  const { userId, email } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`ai:reveal:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const apiKey = (process.env.APP_REVIEW_AI_KEY || '').trim()
  const allowRaw = (process.env.APP_REVIEW_EMAILS || '').trim()

  // Feature off (no key or no allowlist) → behave as if the route doesn't exist.
  if (!apiKey || !allowRaw) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const allowlist = allowRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  if (!allowlist.includes(email.toLowerCase())) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return {
    provider: (process.env.APP_REVIEW_AI_PROVIDER || 'anthropic').trim(),
    apiKey,
    model: (process.env.APP_REVIEW_AI_MODEL || '').trim() || undefined,
    baseUrl: (process.env.APP_REVIEW_AI_BASE_URL || '').trim() || undefined,
  }
})
