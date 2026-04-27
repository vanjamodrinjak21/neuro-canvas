import { updateComment, CommentError } from '../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../utils/commentActor'

interface PatchBody { body: string }

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  const commentId = getRouterParam(event, 'commentId')
  if (!mapId || !commentId) throw createError({ statusCode: 400, statusMessage: 'mapId and commentId required' })
  const body = await readBody<PatchBody>(event)
  if (!body || typeof body.body !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'body required' })
  }
  try {
    const actor = await resolveCommentActor(event, mapId)
    return await updateComment(mapId, actor, commentId, { body: body.body })
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
