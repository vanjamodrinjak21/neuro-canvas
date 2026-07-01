import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  // Full session validation (existence + password-change + disabled +
  // session-invalidation epoch), not just a raw getToken() decode.
  const { email } = await requireAuthSession(event)

  const user = await prisma.user.findUnique({
    where: { email },
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
