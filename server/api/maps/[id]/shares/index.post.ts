import { createShare, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'

interface CreateBody {
  role?: 'viewer' | 'editor'
  label?: string | null
  expiresAt?: string | null
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })
  const body = await readBody<CreateBody>(event)
  const role = body?.role ?? 'viewer'
  const label = (body?.label ?? null)?.toString().slice(0, 64) ?? null
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null
  try {
    return await createShare(mapId, userId, { role, label, expiresAt })
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
