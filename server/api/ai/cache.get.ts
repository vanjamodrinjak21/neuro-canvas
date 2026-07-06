import { cache, cacheKeys, checkRateLimit } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

interface CachedResponse {
  response: string
  usage?: unknown
  cachedAt: number
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // Read-side limit (AER-81) — the write side has had one all along.
  const { allowed } = await checkRateLimit(`ai:cache:read:${userId}`, 240, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many cache reads' })
  }

  const query = getQuery(event)
  const hash = query.hash as string

  if (!hash || hash.length > 256) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid hash parameter' })
  }

  const cached = await cache.get<CachedResponse>(cacheKeys.aiResponse(`${userId}:${hash}`))

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
