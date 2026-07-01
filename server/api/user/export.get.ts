import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  // Full session validation (existence + password-change + disabled +
  // session-invalidation epoch), not just a raw getToken() decode.
  const { email } = await requireAuthSession(event)

  // Rate limit: 3 exports per hour
  const { allowed } = await checkRateLimit(
    `export:${email}`,
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
    where: { email },
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
          slug: true,
          title: true,
          description: true,
          category: true,
          tags: true,
          nodes: true,
          edges: true,
          settings: true,
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

  // GDPR Article-20 portability: include the user's document metadata. This is
  // metadata ONLY — never raw bytes, never the r2Key (internal storage path),
  // never chunk text (extracted document contents). deletedAt:null excludes
  // soft-deleted documents pending retention sweep.
  const documents = await prisma.document.findMany({
    where: { userId: user.id, deletedAt: null },
    select: {
      id: true,
      title: true,
      filename: true,
      mimeType: true,
      byteSize: true,
      status: true,
      pageCount: true,
      chunkCount: true,
      createdAt: true,
      links: {
        select: { mapId: true, linkType: true }
      }
    }
  })

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
    })),
    documents
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
