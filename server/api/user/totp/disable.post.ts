import { getServerSession } from '#auth'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { checkRateLimit } from '../../../utils/redis'

const disableSchema = z.object({
  password: z.string().min(1, 'Password is required')
}).strict()

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Rate limit: 5 attempts per hour
  const { allowed } = await checkRateLimit(`totp-disable:${session.user.email}`, 5, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts. Try again later.' })
  }

  const body = await readBody(event)
  const parsed = disableSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.errors[0]?.message || 'Invalid input' })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, password: true, totpEnabled: true }
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (!user.totpEnabled) {
    throw createError({ statusCode: 400, statusMessage: '2FA is not enabled' })
  }

  // Require password re-authentication to disable 2FA
  if (!user.password) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot verify identity for OAuth accounts' })
  }

  const isValid = await bcrypt.compare(parsed.data.password, user.password)
  if (!isValid) {
    throw createError({ statusCode: 403, statusMessage: 'Password is incorrect' })
  }

  // Disable 2FA and clear secrets
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      backupCodes: []
    }
  })

  return { success: true }
})
