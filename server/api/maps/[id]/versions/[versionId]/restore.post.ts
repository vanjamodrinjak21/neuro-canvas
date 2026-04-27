import { restoreVersion, VersionError } from '../../../../../utils/versionsService'
import { requireAuthSession } from '../../../../../utils/syncHelpers'
import { broadcastReloadToRoom } from '../../../../../utils/collabReload'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const versionId = getRouterParam(event, 'versionId')
  if (!mapId || !versionId) throw createError({ statusCode: 400, statusMessage: 'mapId and versionId required' })

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
