import { listShares, ShareError } from '../../../../utils/sharesService'
import { requireAuthSession } from '../../../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, statusMessage: 'Map id required' })
  try {
    return await listShares(mapId, userId)
  } catch (err) {
    if (err instanceof ShareError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }
})
