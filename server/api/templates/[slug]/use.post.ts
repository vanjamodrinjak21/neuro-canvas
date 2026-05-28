import { prisma } from '../../../utils/prisma'
import { requireAuthSession, generateChecksum, computeByteSize  } from '../../../utils/syncHelpers'
import { validateBody, templateUseSchema } from '../../../utils/validation'
import { checkRateLimit } from '../../../utils/redis'

// Cap per user to prevent a compromised account from filling the DB by
// looping POST /api/templates/<slug>/use.
const MAX_MAPS_PER_USER = 1000

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug || slug.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Template slug required' })
  }

  // 20 template instantiations per hour per user — generous for normal use,
  // prevents enumeration / DB-fill abuse.
  const { allowed } = await checkRateLimit(`template:use:${userId}`, 20, 3600)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many template uses — try again later' })
  }

  const existingCount = await prisma.map.count({ where: { userId, deletedAt: null } })
  if (existingCount >= MAX_MAPS_PER_USER) {
    throw createError({ statusCode: 409, statusMessage: 'Map limit reached' })
  }

  const body = validateBody(templateUseSchema, (await readBody(event)) ?? {})

  const template = await prisma.template.findUnique({ where: { slug } })

  if (!template || !template.isPublic) {
    throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  }

  const mapId = body.mapId || `map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const title = body.title || template.title

  const mapData = {
    nodes: template.nodes,
    edges: template.edges,
    camera: { x: 0, y: 0, zoom: 1 },
    settings: template.settings || {},
    rootNodeId: null,
  }

  const checksum = generateChecksum(mapData)
  const byteSize = computeByteSize(mapData)

  const [map] = await Promise.all([
    prisma.map.create({
      data: {
        id: mapId,
        userId,
        title,
        data: mapData,
        checksum,
        byteSize,
        tags: template.tags,
      },
    }),
    prisma.template.update({
      where: { slug },
      data: { usageCount: { increment: 1 } },
    }),
  ])

  return { mapId: map.id, title: map.title }
})
