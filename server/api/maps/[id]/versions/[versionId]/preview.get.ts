import { previewVersion, VersionError } from '../../../../../utils/versionsService'
import { requireAuthSession } from '../../../../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  const versionId = getRouterParam(event, 'versionId')
  if (!mapId || !versionId) throw createError({ statusCode: 400, statusMessage: 'mapId and versionId required' })

  try {
    const snap = await previewVersion(mapId, userId, versionId)
    return {
      nodes: Object.fromEntries(snap.nodes),
      edges: Object.fromEntries(snap.edges),
      meta: snap.meta
    }
  } catch (err) {
    if (err instanceof VersionError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
