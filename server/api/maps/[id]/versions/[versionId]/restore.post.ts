import { restoreVersion, VersionError } from '../../../../../utils/versionsService'
import { requireAuthSession } from '../../../../../utils/syncHelpers'
import { broadcastReloadToRoom } from '../../../../../utils/collabReload'
import { checkRateLimit } from '../../../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const versionId = getRouterParam(event, 'versionId')
  if (!mapId || !versionId) throw createError({ statusCode: 400, statusMessage: 'mapId and versionId required' })

  // Restore rewrites map data + kicks every live editor — expensive AND
  // disruptive. Cap tightly to discourage thrash.
  const { allowed } = await checkRateLimit(`version:restore:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many restore requests' })
  }

  try {
    const result = await restoreVersion(mapId, userId, versionId)
    // Best-effort broadcast — clients reload to pick up the restored ydoc.
    broadcastReloadToRoom(mapId, 'version-restored').catch((e) =>
      console.warn('[collab] reload broadcast failed', e)
    )
    return { ok: true, ...result }
  } catch (err) {
    if (err instanceof VersionError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
