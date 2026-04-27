import { reopenThread, CommentError } from '../../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../../utils/commentActor'

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  const threadId = getRouterParam(event, 'threadId')
  if (!mapId || !threadId) throw createError({ statusCode: 400, statusMessage: 'mapId and threadId required' })
  try {
    const actor = await resolveCommentActor(event, mapId)
    return await reopenThread(mapId, actor, threadId)
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
