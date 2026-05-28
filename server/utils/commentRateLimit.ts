import { getRequestIP } from 'h3'
import type { H3Event } from 'h3'
import { checkRateLimit } from './redis'
import type { CommentActor } from './commentsService'

/**
 * Rate-limit a comment mutation by actor identity. Authed users key on
 * actor.id; guests fall back to IP because their actor.id is a
 * per-request nanoid that would otherwise defeat the cap.
 *
 * Throws a 429 createError if the bucket is exhausted.
 */
export async function rateLimitCommentMutation(
  event: H3Event,
  actor: CommentActor,
  bucket: string,
  limit = 60,
  windowSec = 60,
): Promise<void> {
  const isGuest = actor.id.startsWith('guest:')
  const key = isGuest
    ? `comment:${bucket}:guest:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
    : `comment:${bucket}:${actor.id}`
  const { allowed } = await checkRateLimit(key, limit, windowSec)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many comment actions. Slow down.' })
  }
}
