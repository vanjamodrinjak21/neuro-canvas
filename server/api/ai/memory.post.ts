import { cache } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, aiMemoryPostSchema } from '../../utils/validation'

const MEMORY_TTL = 30 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = validateBody(aiMemoryPostSchema, await readBody(event))

  await cache.set(`ai:memory:${userId}`, body.data, MEMORY_TTL)

  return { success: true }
})
