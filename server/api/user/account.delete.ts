import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'

interface DeleteAccountBody {
  confirmation: string
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody<DeleteAccountBody>(event)

  // Require explicit confirmation
  if (body.confirmation !== 'DELETE MY ACCOUNT') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please type "DELETE MY ACCOUNT" to confirm'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
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
