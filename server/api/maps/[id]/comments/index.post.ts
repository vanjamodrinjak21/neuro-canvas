import { createComment, CommentError } from '../../../../utils/commentsService'
import { resolveCommentActor } from '../../../../utils/commentActor'

interface CreateBody {
  body: string
  threadId?: string | null
  anchorNodeId?: string | null
  anchorX?: number | null
  anchorY?: number | null
  mentions?: string[]
}

export default defineEventHandler(async (event) => {
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })
  const body = await readBody<CreateBody>(event)
  if (!body || typeof body.body !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'body required' })
  }
  try {
    const actor = await resolveCommentActor(event, mapId)
    return await createComment(mapId, actor, {
      body: body.body,
      threadId: body.threadId ?? null,
      anchorNodeId: body.anchorNodeId ?? null,
      anchorX: typeof body.anchorX === 'number' ? body.anchorX : null,
      anchorY: typeof body.anchorY === 'number' ? body.anchorY : null,
      mentions: Array.isArray(body.mentions) ? body.mentions : []
    })
  } catch (err) {
    if (err instanceof CommentError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
