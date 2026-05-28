import { getToken } from '#auth'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or less')
    .trim()
    .optional(),
  bio: z
    .string()
    .max(280, 'Bio must be 280 characters or less')
    .trim()
    .optional()
    .nullable(),
  image: z
    .url('Invalid image URL')
    .refine(
      (url) => url.startsWith('https://'),
      'Image URL must use HTTPS'
    )
    .optional()
    .nullable()
}).strict() // Reject unknown fields (mass assignment protection)

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const { allowed } = await checkRateLimit(`user:profile:${token.email as string}`, 20, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many profile updates' })
  }

  const body = await readBody(event)
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || 'Invalid input'
    })
  }

  const { name, bio, image } = parsed.data

  const user = await prisma.user.update({
    where: { email: token.email as string },
    data: {
      ...(name !== undefined && { name }),
      ...(bio !== undefined && { bio: bio || null }),
      ...(image !== undefined && { image: image || null })
    },
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      image: true,
      updatedAt: true
    }
  })

  return user
})
