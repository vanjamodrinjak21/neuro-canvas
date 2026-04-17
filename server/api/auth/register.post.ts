import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'
import { validateBody } from '../../utils/validation'
import { checkBreachedPassword } from '../../utils/hibp'

const registerSchema = z.object({
  email: z.string().email().max(255).transform(v => v.toLowerCase()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number'),
  name: z.string().max(100).trim().optional(),
})

export default defineEventHandler(async (event) => {
  // Rate limit by IP to prevent brute-force enumeration and mass account creation
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`register:${ip}`, 5, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many registration attempts. Try again later.' })
  }

  const body = validateBody(registerSchema, await readBody(event))

  // Check against known breached passwords
  const breachCount = await checkBreachedPassword(body.password)
  if (breachCount > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `This password has appeared in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`
    })
  }

  // Hash password BEFORE checking for duplicates to prevent timing side-channel
  // (bcrypt takes ~250ms; without this, duplicate email returns instantly, leaking existence)
  const hashedPassword = await bcrypt.hash(body.password, 12)

  try {
    // Create user — if email exists, Prisma unique constraint will throw
    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        name: body.name || null,
        emailVerified: null
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    })

    return { success: true, user }
  } catch (e: any) {
    // Prisma unique constraint violation — return generic message to prevent email enumeration
    if (e?.code === 'P2002') {
      return { success: true, user: { id: null, email: body.email, name: body.name || null, createdAt: new Date() } }
    }
    throw createError({ statusCode: 500, statusMessage: 'Registration failed. Please try again.' })
  }
})
