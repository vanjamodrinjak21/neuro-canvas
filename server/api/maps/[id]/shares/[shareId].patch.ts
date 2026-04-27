import { updateShare, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'
import { validateBody, shareUpdateSchema } from '../../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const shareId = getRouterParam(event, 'shareId')
  if (!mapId || !shareId) throw createError({ statusCode: 400, statusMessage: 'Map id and share id required' })
  const body = validateBody(shareUpdateSchema, await readBody(event))

  const patch: { role?: 'viewer' | 'editor'; label?: string | null; expiresAt?: Date | null } = {}
  if (body.role !== undefined) patch.role = body.role === 'commenter' ? 'viewer' : body.role
  if (body.label !== undefined) patch.label = body.label ?? null
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null) {
      patch.expiresAt = null
    } else {
      const d = new Date(body.expiresAt)
      if (Number.isNaN(d.getTime())) {
        throw createError({ statusCode: 400, statusMessage: 'expiresAt must be a valid ISO 8601 date' })
      }
      patch.expiresAt = d
    }
  }

  try {
    return await updateShare(mapId, userId, shareId, patch)
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
