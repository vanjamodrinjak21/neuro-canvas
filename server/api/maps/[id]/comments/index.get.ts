import { listComments, CommentError } from '../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../utils/commentActor'

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })
  try {
    const actor = await resolveCommentActor(event, mapId)
    return await listComments(mapId, actor)
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
