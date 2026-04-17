import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, aiCachePostSchema } from '../../utils/validation'

const DEFAULT_TTL = 3600

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const body = validateBody(aiCachePostSchema, await readBody(event))
  const ttl = body.ttlSeconds || DEFAULT_TTL

  await cache.set(
    cacheKeys.aiResponse(`${userId}:${body.hash}`),
    {
      response: body.response,
      usage: body.usage || null,
      cachedAt: Date.now()
    },
    ttl
  )

  return { success: true }
})
