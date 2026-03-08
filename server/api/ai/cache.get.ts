/**
 * AI Response Cache — GET
 * Retrieves cached AI response by prompt hash
 */
import { cache, cacheKeys } from '../../utils/redis'

interface CachedResponse {
  response: string
  usage?: unknown
  cachedAt: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const hash = query.hash as string

  if (!hash) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing hash parameter'
    })
  }

  const cached = await cache.get<CachedResponse>(cacheKeys.aiResponse(hash))

  if (!cached) {
    return { hit: false, response: null, usage: null }
  }

  return {
    hit: true,
    response: cached.response,
    usage: cached.usage,
    cachedAt: cached.cachedAt
  }
})
