import { updateShare, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'

interface PatchBody {
  role?: 'viewer' | 'editor'
  label?: string | null
  expiresAt?: string | null
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const shareId = getRouterParam(event, 'shareId')
  if (!mapId || !shareId) throw createError({ statusCode: 400, statusMessage: 'Map id and share id required' })
  const body = await readBody<PatchBody>(event)
  const patch: { role?: 'viewer' | 'editor'; label?: string | null; expiresAt?: Date | null } = {}
  if (body?.role !== undefined) patch.role = body.role
  if (body?.label !== undefined) patch.label = body.label?.toString().slice(0, 64) ?? null
  if (body?.expiresAt !== undefined) patch.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
  try {
    return await updateShare(mapId, userId, shareId, patch)
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
