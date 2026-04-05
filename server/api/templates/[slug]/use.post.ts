import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { generateChecksum, computeByteSize } from '../../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const slug = getRouterParam(event, 'slug')
  const body = await readBody(event)

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Template slug required' })
  }

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
