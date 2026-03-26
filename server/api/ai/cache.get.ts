import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

interface CachedResponse {
  response: string
  usage?: unknown
  cachedAt: number
}

export default defineEventHandler(async (event) => {
  await requireAuthSession(event)

  const query = getQuery(event)
  const hash = query.hash as string

  if (!hash || hash.length > 256) {
    throw createError({ statusCode: 400, statusMessage: 'Missing or invalid hash parameter' })
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
