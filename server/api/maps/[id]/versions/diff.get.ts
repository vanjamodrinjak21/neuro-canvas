import { diffVersions, VersionError } from '../../../../utils/versionsService'
import { requireAuthSession } from '../../../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })

  const query = getQuery(event)
  const from = query.from as string | undefined
  const to = query.to as string | undefined
  if (!from || !to) throw createError({ statusCode: 400, statusMessage: 'from and to query params required' })

  try {
    return await diffVersions(mapId, userId, from, to)
  } catch (err) {
    if (err instanceof VersionError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
