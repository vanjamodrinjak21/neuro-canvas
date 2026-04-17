import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const category = query.category as string | undefined
  const search = (query.search as string | undefined)?.slice(0, 200)
  const sortBy = (query.sortBy as string) || 'popular'
  const page = Number.parseInt(query.page as string) || 1
  const limit = Math.min(Number.parseInt(query.limit as string) || 20, 50)

  const where: any = { isPublic: true }

  if (category && category !== 'all') {
    where.category = category
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { tags: { hasSome: [search.toLowerCase()] } },
    ]
  }

  const orderBy: any = sortBy === 'newest'
    ? { createdAt: 'desc' }
    : sortBy === 'alphabetical'
      ? { title: 'asc' }
      : { usageCount: 'desc' }

  const [templates, total] = await Promise.all([
    prisma.template.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        tags: true,
        nodeCount: true,
        levelCount: true,
        previewData: true,
        aiEnhanced: true,
        isSystem: true,
        isPublic: true,
        usageCount: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    }),
    prisma.template.count({ where }),
  ])

  return { templates, total, page, limit }
})
