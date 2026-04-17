import { getToken } from '#auth'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const token = await getToken({ event })

  if (!token?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: token.email as string },
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      image: true,
      emailVerified: true,
      totpEnabled: true,
      createdAt: true,
      updatedAt: true,
      accounts: {
        select: {
          provider: true
        }
      }
    }
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found'
    })
  }

  return {
    ...user,
    providers: user.accounts.map(a => a.provider)
  }
})
