import { revokeShare, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'
import { kickShareFromRoom } from '../../../../utils/collabKick'
import { checkRateLimit } from '../../../../utils/redis'
import { revokeShareJtis } from '../../../../utils/collabJtiStore'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const shareId = getRouterParam(event, 'shareId')
  if (!mapId || !shareId) throw createError({ statusCode: 400, statusMessage: 'Map id and share id required' })

  const { allowed } = await checkRateLimit(`share:revoke:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many share revocations' })
  }

  try {
    const share = await revokeShare(mapId, userId, shareId)
    // Best-effort: kick live sockets AND drop the jti allowlist entries
    // so any reconnect attempt with the cached JWT fails the check.
    kickShareFromRoom(mapId, share.token).catch(e => console.warn('[collab] kick failed', e))
    revokeShareJtis(share.token).catch(e => console.warn('[collab] revokeShareJtis failed', e))
    return { ok: true, share }
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
