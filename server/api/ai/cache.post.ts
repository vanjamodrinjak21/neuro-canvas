/**
 * AI Response Cache — POST
 * Stores an AI response in Redis with TTL
 */
import { cache, cacheKeys } from '../../utils/redis'

interface CacheRequestBody {
  hash: string
  response: string
  usage?: unknown
  ttlSeconds?: number
}

// Default TTL: 1 hour
const DEFAULT_TTL = 3600

export default defineEventHandler(async (event) => {
  const body = await readBody<CacheRequestBody>(event)

  if (!body.hash || !body.response) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing hash or response'
    })
  }

  const ttl = body.ttlSeconds || DEFAULT_TTL

  await cache.set(
    cacheKeys.aiResponse(body.hash),
    {
      response: body.response,
      usage: body.usage || null,
      cachedAt: Date.now()
    },
    ttl
  )

  return { success: true }
})
