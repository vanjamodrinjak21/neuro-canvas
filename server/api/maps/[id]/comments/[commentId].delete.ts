import { deleteComment, CommentError } from '../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../utils/commentActor'

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  const commentId = getRouterParam(event, 'commentId')
  if (!mapId || !commentId) throw createError({ statusCode: 400, statusMessage: 'mapId and commentId required' })
  try {
    const actor = await resolveCommentActor(event, mapId)
    return { ok: true, ...(await deleteComment(mapId, actor, commentId)) }
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
