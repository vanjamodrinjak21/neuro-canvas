import { getServerSession } from '#auth'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'

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
    .string()
    .url('Invalid image URL')
    .refine(
      (url) => url.startsWith('https://'),
      'Image URL must use HTTPS'
    )
    .optional()
    .nullable()
}).strict() // Reject unknown fields (mass assignment protection)

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody(event)
  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.errors[0]?.message || 'Invalid input'
    })
  }

  const { name, bio, image } = parsed.data

  const user = await prisma.user.update({
    where: { email: session.user.email },
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
