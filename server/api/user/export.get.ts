import { getServerSession } from '#auth'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  // Rate limit: 3 exports per hour
  const { allowed } = await checkRateLimit(
    `export:${session.user.email}`,
    3,
    3600
  )
  if (!allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many export requests. Please try again later.'
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      maps: {
        select: {
          id: true,
          title: true,
          data: true,
          preview: false,
          createdAt: true,
          updatedAt: true,
          versions: {
            select: {
              id: true,
              version: true,
              data: true,
              createdAt: true
            },
            orderBy: { version: 'desc' },
            take: 3
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 500 // Bound to prevent memory exhaustion
      },
      templates: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          data: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true
        },
        take: 200
      },
      credentials: {
        select: {
          id: true,
          provider: true,
          label: true,
          createdAt: true
          // Never export encrypted values or key hashes
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

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    user: {
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    },
    maps: user.maps,
    templates: user.templates,
    credentials: user.credentials.map((c) => ({
      provider: c.provider,
      label: c.label,
      createdAt: c.createdAt
    }))
  }

  // Set headers for JSON download
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename="neurocanvas-export-${new Date().toISOString().slice(0, 10)}.json"`
  )
  // Prevent cross-origin embedding (CORP)
  setResponseHeader(event, 'Cross-Origin-Resource-Policy', 'same-origin')

  return exportData
})
