import { restoreVersion, VersionError } from '../../../../../utils/versionsService'
import { requireAuthSession } from '../../../../../utils/syncHelpers'
import { broadcastRestoreToRoom } from '../../../../../utils/collabReload'
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
    // Reconcile the live PartyKit room *before* returning so the owner's
    // post-restore reload reconnects to already-restored room state instead of
    // merging back to the stale in-memory doc. Best-effort: Map.ydoc/data are
    // already persisted, so a PartyKit hiccup doesn't fail the restore.
    await broadcastRestoreToRoom(mapId, result.snapshot).catch((e) =>
      console.warn('[collab] restore reconcile failed', e)
    )
    return {
      ok: true,
      id: result.id,
      ydocVersion: result.ydocVersion,
      syncVersion: result.syncVersion,
      restoredFromVersion: result.restoredFromVersion
    }
  } catch (err) {
    if (err instanceof VersionError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
