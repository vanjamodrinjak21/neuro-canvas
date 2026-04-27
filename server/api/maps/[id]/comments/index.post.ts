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
    // share-link bots. Keyed on actor.id so each guest token stays isolated.
    const { allowed } = await checkRateLimit(`comment-create:${actor.id}`, 60, 60)
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
    throw err
  }
})
