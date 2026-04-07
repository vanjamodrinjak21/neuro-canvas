import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { checkRateLimit } from '../../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`vault:delete:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }
  const credentialId = getRouterParam(event, 'id')

  if (!credentialId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing credential ID' })
  }

  const credential = await prisma.credential.findFirst({
    where: { id: credentialId, userId },
    select: { id: true }
  })

  if (!credential) {
    throw createError({ statusCode: 404, statusMessage: 'Credential not found' })
  }

  await prisma.credential.delete({
    where: { id: credentialId }
  })

  return { ok: true }
})
