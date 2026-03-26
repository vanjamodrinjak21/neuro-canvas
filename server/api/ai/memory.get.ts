import { cache } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const data = await cache.get<Record<string, unknown>>(`ai:memory:${userId}`)

  return { data }
})
