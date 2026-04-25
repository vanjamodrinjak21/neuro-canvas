import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Sign a flush body for the PartyKit -> Nitro flush channel.
 * Returns a hex-encoded HMAC-SHA256.
 */
export function signFlushBody(body: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Constant-time signature verification. Returns false for any malformed
 * input rather than throwing — the endpoint should map this to 401.
 */
export function verifyFlushSignature(body: Buffer, signature: string, secret: string): boolean {
  if (typeof signature !== 'string' || signature.length === 0) return false
  const expected = signFlushBody(body, secret)
  if (expected.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
