import { getToken } from '#auth'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'
import { checkBreachedPassword } from '../../utils/hibp'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .regex(/[A-Z]/, 'Password must include an uppercase letter')
    .regex(/[a-z]/, 'Password must include a lowercase letter')
    .regex(/\d/, 'Password must include a number')
})

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Rate limit: 5 attempts per 15 minutes
  const { allowed } = await checkRateLimit(
    `change-password:${token.email as string}`,
    5,
    900
  )
  if (!allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many attempts. Please try again later.'
    })
  }

  const body = await readBody(event)
  const parsed = changePasswordSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message || 'Invalid input'
    })
  }

  const { currentPassword, newPassword } = parsed.data

  // Prevent setting same password
  if (currentPassword === newPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'New password must be different from current password'
    })
  }

  // Check against known breached passwords
  const breachCount = await checkBreachedPassword(newPassword)
  if (breachCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `This password has appeared in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: token.email as string },
    select: { id: true, password: true }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  // OAuth-only users have no password
  if (!user.password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot change password for OAuth accounts. Use your OAuth provider instead.'
    })
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Current password is incorrect'
    })
  }

  // Hash and save new password
  const hashedPassword = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date()
    }
  })

  return { success: true }
})
