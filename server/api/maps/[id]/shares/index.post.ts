import { createShare, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'
import { validateBody, shareCreateSchema } from '../../../../utils/validation'
import { checkRateLimit } from '../../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })

  // Cap to 30 share-creations per user per hour. Cheap defense against
  // a compromised account being used to flood share links into the wild.
  const { allowed } = await checkRateLimit(`share-create:${userId}`, 30, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many share links created. Try again later.' })
  }

  const body = validateBody(shareCreateSchema, await readBody(event))
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'expiresAt must be a valid ISO 8601 date' })
  }
  try {
    return await createShare(mapId, userId, {
      role: body.role === 'commenter' ? 'viewer' : body.role,
      label: body.label ?? null,
      expiresAt,
    })
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
