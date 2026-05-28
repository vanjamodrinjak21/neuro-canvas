import { getRequestIP } from 'h3'
import { createComment, CommentError } from '../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../utils/commentActor'
import { validateBody, commentCreateSchema } from '../../../../utils/validation'
import { checkRateLimit } from '../../../../utils/redis'

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })
  const body = validateBody(commentCreateSchema, await readBody(event))
  try {
    const actor = await resolveCommentActor(event, mapId)
    // Rate-limit to discourage comment spam from compromised accounts or
    // share-link bots. For authed users key on actor.id; for guests key
    // on IP — the previous per-request random nanoid in actor.id meant
    // every guest got a fresh limit bucket, effectively disabling the cap.
    const isGuest = actor.id.startsWith('guest:')
    const rlKey = isGuest
      ? `comment-create:guest:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`
      : `comment-create:${actor.id}`
    const { allowed } = await checkRateLimit(rlKey, 60, 60)
    if (!allowed) {
      throw createError({ statusCode: 429, statusMessage: 'Too many comments. Slow down.' })
    }
    return await createComment(mapId, actor, {
      body: body.body,
      threadId: body.threadId ?? null,
      anchorNodeId: body.anchorNodeId ?? null,
      anchorX: typeof body.anchorX === 'number' ? body.anchorX : null,
      anchorY: typeof body.anchorY === 'number' ? body.anchorY : null,
      mentions: body.mentions ?? [],
    })
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    // Don't surface raw service-layer errors — they can contain DB /
    // framework details that fingerprint the schema.
    console.error('comment create failed', { mapId, code: (err as { code?: string })?.code })
    throw createError({ statusCode: 500, statusMessage: 'Could not create comment' })
  }
})
