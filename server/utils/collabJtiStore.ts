// Redis-backed allowlist for live collab JWT IDs (jti).
//
// JWTs are minted with a `jti` and an `exp`. We persist the jti into
// Redis with TTL=exp so revocation is a simple DEL on collab:jti:<jti>
// — much faster than waiting for natural expiry. PartyKit asks Nitro
// "is this jti still valid?" on connect (via the /api/collab/jti-check
// endpoint), so a token that was revoked between mint and reconnect
// is denied immediately.
//
// We also index by (userId, shareToken) so password-change / share-
// revoke flows can scrub every jti for that identity in one pass.

import { redis } from './redis'

const KEY_PREFIX = 'collab:jti:'
const USER_INDEX_PREFIX = 'collab:user-jtis:'
const SHARE_INDEX_PREFIX = 'collab:share-jtis:'

export interface JtiRecord {
  mapId: string
  role: string
  userId: string | null
  shareToken: string | null
}

/** Persist a freshly-minted jti with TTL matching the JWT expiry. */
export async function registerJti(
  jti: string,
  ttlSeconds: number,
  meta: JtiRecord,
): Promise<void> {
  const key = `${KEY_PREFIX}${jti}`
  try {
    const ops: Promise<unknown>[] = [redis.setex(key, ttlSeconds, JSON.stringify(meta))]
    if (meta.userId) {
      const idx = `${USER_INDEX_PREFIX}${meta.userId}`
      ops.push(redis.sadd(idx, jti))
      ops.push(redis.expire(idx, ttlSeconds + 60))
    }
    if (meta.shareToken) {
      const idx = `${SHARE_INDEX_PREFIX}${meta.shareToken}`
      ops.push(redis.sadd(idx, jti))
      ops.push(redis.expire(idx, ttlSeconds + 60))
    }
    await Promise.all(ops)
  } catch (e) {
    // Don't fail the mint if Redis is unavailable — the jti check on
    // the PartyKit side fails-open in that case (logged). The token
    // is still valid for its natural lifetime.
    console.warn('[collab] registerJti failed', { name: (e as Error)?.name })
  }
}

/** Is this jti currently in the allowlist? */
export async function isJtiValid(jti: string): Promise<boolean> {
  try {
    const exists = await redis.exists(`${KEY_PREFIX}${jti}`)
    return exists === 1
  } catch (e) {
    // Fail open on Redis errors so a brief outage doesn't kick every
    // collaborator. The JWT signature + exp check still apply.
    console.warn('[collab] isJtiValid Redis error — failing open', { name: (e as Error)?.name })
    return true
  }
}

/** Revoke a single jti (e.g. on explicit sign-out). */
export async function revokeJti(jti: string): Promise<void> {
  try { await redis.del(`${KEY_PREFIX}${jti}`) } catch { /* ignore */ }
}

/** Revoke every jti tied to a userId (e.g. on password change). */
export async function revokeUserJtis(userId: string): Promise<void> {
  const idx = `${USER_INDEX_PREFIX}${userId}`
  try {
    const jtis = await redis.smembers(idx)
    if (jtis.length === 0) return
    await Promise.all([
      ...jtis.map(jti => redis.del(`${KEY_PREFIX}${jti}`)),
      redis.del(idx),
    ])
  } catch (e) {
    console.warn('[collab] revokeUserJtis failed', { name: (e as Error)?.name })
  }
}

/** Revoke every jti tied to a share (on share revoke). */
export async function revokeShareJtis(shareToken: string): Promise<void> {
  const idx = `${SHARE_INDEX_PREFIX}${shareToken}`
  try {
    const jtis = await redis.smembers(idx)
    if (jtis.length === 0) return
    await Promise.all([
      ...jtis.map(jti => redis.del(`${KEY_PREFIX}${jti}`)),
      redis.del(idx),
    ])
  } catch (e) {
    console.warn('[collab] revokeShareJtis failed', { name: (e as Error)?.name })
  }
}
