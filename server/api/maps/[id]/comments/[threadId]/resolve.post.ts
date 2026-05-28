import { resolveThread, CommentError } from '../../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../../utils/commentActor'
import { rateLimitCommentMutation } from '../../../../../utils/commentRateLimit'

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  const threadId = getRouterParam(event, 'threadId')
  if (!mapId || !threadId) throw createError({ statusCode: 400, statusMessage: 'mapId and threadId required' })
  try {
    const actor = await resolveCommentActor(event, mapId)
    await rateLimitCommentMutation(event, actor, 'resolve', 60, 60)
    return await resolveThread(mapId, actor, threadId)
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
