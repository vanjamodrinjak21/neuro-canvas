import { isJtiValid } from '../../utils/collabJtiStore'
import { verifyFlushSignature } from '../../utils/collabAuth'

/**
 * PartyKit -> Nitro JWT-id validity check. Called from the PartyKit
 * worker on every `onBeforeConnect` so that revoked tokens get denied
 * immediately instead of surviving until natural JWT expiry.
 *
 * Authenticated via the same HMAC scheme as /flush and /kick — the
 * PartyKit worker holds the shared FLUSH secret and signs the request
 * body. Without a valid signature this endpoint returns 401 and reveals
 * nothing about jti existence.
 *
 * Body: { "jti": "..." }
 * Returns: { "valid": true|false }
 */
export default defineEventHandler(async (event) => {
  if (getMethod(event) !== 'POST') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }

  const secret = process.env.PARTYKIT_FLUSH_SECRET
  if (!secret) {
    // Without a configured shared secret this endpoint has no auth.
    // Refuse rather than fail open — the collab feature degrades to
    // "tokens valid until natural exp" until the secret is set.
    throw createError({ statusCode: 503, statusMessage: 'Collab not configured' })
  }

  const raw = await readRawBody(event, 'utf8') ?? ''
  const sig = getRequestHeader(event, 'x-collab-signature') || ''
  if (!verifyFlushSignature(Buffer.from(raw, 'utf8'), sig, secret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  let body: { jti?: unknown }
  try { body = JSON.parse(raw) as { jti?: unknown } }
  catch { throw createError({ statusCode: 400, statusMessage: 'Invalid body' }) }

  if (typeof body.jti !== 'string' || body.jti.length === 0 || body.jti.length > 64) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid jti' })
  }

  const valid = await isJtiValid(body.jti)
  return { valid }
})
