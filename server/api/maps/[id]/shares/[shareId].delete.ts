import { revokeShare, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'
import { kickShareFromRoom } from '../../../../utils/collabKick'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const shareId = getRouterParam(event, 'shareId')
  if (!mapId || !shareId) throw createError({ statusCode: 400, statusMessage: 'Map id and share id required' })
  try {
    const share = await revokeShare(mapId, userId, shareId)
    // Best-effort kick — failures are logged but don't block the revoke.
    kickShareFromRoom(mapId, share.token).catch((e) => console.warn('[collab] kick failed', e))
    return { ok: true, share }
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
