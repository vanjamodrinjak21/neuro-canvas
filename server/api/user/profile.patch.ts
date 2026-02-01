import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'

interface UpdateProfileBody {
  name?: string
  image?: string
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody<UpdateProfileBody>(event)

  // Validate name length if provided
  if (body.name !== undefined) {
    if (body.name.length > 100) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Name must be 100 characters or less'
      })
    }
  }

  // Validate image URL if provided
  if (body.image !== undefined && body.image !== null && body.image !== '') {
    try {
      new URL(body.image)
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid image URL'
      })
    }
  }

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data: {
      ...(body.name !== undefined && { name: body.name || null }),
      ...(body.image !== undefined && { image: body.image || null })
    },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      updatedAt: true
    }
  })

  return user
})
