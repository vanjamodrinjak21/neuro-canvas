import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function computeLevelCount(nodes: Record<string, any>, edges: Record<string, any>): number {
  // Build adjacency from edges
  const children = new Map<string, string[]>()
  for (const edge of Object.values(edges)) {
    const list = children.get(edge.sourceId) || []
    list.push(edge.targetId)
    children.set(edge.sourceId, list)
  }

  // Find root nodes (no incoming edges)
  const hasParent = new Set(Object.values(edges).map((e: any) => e.targetId))
  const roots = Object.keys(nodes).filter(id => !hasParent.has(id))

  // BFS to find max depth
  let maxDepth = 0
  const queue: Array<{ id: string; depth: number }> = roots.map(id => ({ id, depth: 0 }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    maxDepth = Math.max(maxDepth, depth)
    for (const childId of (children.get(id) || [])) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, depth: depth + 1 })
      }
    }
  }

  return maxDepth + 1
}

function generatePreviewData(nodes: Record<string, any>): any {
  const nodeList = Object.values(nodes)
  if (nodeList.length === 0) return { shapes: [], width: 270, height: 140 }

  // Find bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodeList) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + (n.size?.width || 120))
    maxY = Math.max(maxY, n.position.y + (n.size?.height || 40))
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const previewW = 270
  const previewH = 140
  const padding = 20

  const shapes = nodeList.slice(0, 12).map(n => {
    const relX = (n.position.x - minX) / rangeX
    const relY = (n.position.y - minY) / rangeY
    const isRoot = n.isRoot === true
    return {
      x: padding + relX * (previewW - padding * 2 - 40),
      y: padding + relY * (previewH - padding * 2 - 20),
      width: isRoot ? 48 : 28,
      height: isRoot ? 20 : 16,
      color: n.style?.fillColor || '#1A1A1E',
      borderColor: n.style?.borderColor || '#2A2A30',
      borderRadius: n.style?.shape === 'circle' ? 50 : n.style?.shape === 'diamond' ? 2 : 4,
      label: isRoot ? n.content?.slice(0, 8) : undefined,
      fontSize: isRoot ? 7 : undefined,
    }
  })

  return { shapes, width: previewW, height: previewH }
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = await readBody(event)

  if (!body.sourceMapId || !body.title || !body.category) {
    throw createError({ statusCode: 400, statusMessage: 'sourceMapId, title, and category are required' })
  }

  // Fetch the source map
  const map = await prisma.map.findFirst({
    where: { id: body.sourceMapId, userId, deletedAt: null },
  })

  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Source map not found' })
  }

  const mapData = map.data as any
  const nodes = mapData.nodes || {}
  const edges = mapData.edges || {}

  // Strip positions to make template layout-agnostic? No — keep positions for preview
  const baseSlug = slugify(body.title)
  let slug = baseSlug
  let suffix = 1
  while (await prisma.template.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`
  }

  const template = await prisma.template.create({
    data: {
      slug,
      title: body.title,
      description: body.description || null,
      category: body.category,
      tags: body.tags || [],
      nodes,
      edges,
      settings: mapData.settings || null,
      nodeCount: Object.keys(nodes).length,
      levelCount: computeLevelCount(nodes, edges),
      previewData: generatePreviewData(nodes),
      aiEnhanced: body.aiEnhanced ?? false,
      isPublic: true,
      authorId: userId,
    },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  return template
})
