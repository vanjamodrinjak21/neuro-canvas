/**
 * User AI Memory — GET
 * Retrieves persisted user memory/preferences from Redis
 */
import { cache } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  // Use a session-based or generic key
  const query = getQuery(event)
  const userId = (query.userId as string) || 'default'

  const data = await cache.get<Record<string, unknown>>(`ai:memory:${userId}`)

  return { data }
})
