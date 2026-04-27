import { listVersions, VersionError } from '../../../../utils/versionsService'
import { requireAuthSession } from '../../../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })

  const query = getQuery(event)
  const limit = query.limit ? Number(query.limit) : undefined
  const cursor = (query.cursor as string | undefined) ?? null

  try {
    return await listVersions(mapId, userId, { limit, cursor })
  } catch (err) {
    if (err instanceof VersionError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
