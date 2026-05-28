import { cache, checkRateLimit } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, aiMemoryPostSchema } from '../../utils/validation'

const MEMORY_TTL = 30 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`ai:memory:write:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many memory writes' })
  }

  const body = validateBody(aiMemoryPostSchema, await readBody(event))

  await cache.set(`ai:memory:${userId}`, body.data, MEMORY_TTL)

  return { success: true }
})
