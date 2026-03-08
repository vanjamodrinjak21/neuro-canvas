/**
 * User AI Memory — POST
 * Persists user memory/preferences to Redis
 */
import { cache } from '../../utils/redis'

// TTL: 30 days
const MEMORY_TTL = 30 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
  const body = await readBody<{ data: Record<string, unknown>; userId?: string }>(event)

  if (!body.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing data'
    })
  }

  const userId = body.userId || 'default'

  await cache.set(`ai:memory:${userId}`, body.data, MEMORY_TTL)

  return { success: true }
})
