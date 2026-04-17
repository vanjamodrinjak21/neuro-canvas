import { getToken } from '#auth'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT', {
    errorMap: () => ({ message: 'Please type "DELETE MY ACCOUNT" to confirm' })
  })
}).strict()

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Rate limit: 3 attempts per hour
  const { allowed } = await checkRateLimit(
    `delete-account:${token.email as string}`,
    3,
    3600
  )
  if (!allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Please try again later.'
    })
  }

  const body = await readBody(event)
  const parsed = deleteAccountSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message || 'Invalid confirmation'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: token.email as string }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // Delete user (cascades to sessions, accounts via Prisma relations)
  await prisma.user.delete({
    where: { id: user.id }
  })

  return {
    success: true,
    message: 'Account deleted successfully'
  }
})
