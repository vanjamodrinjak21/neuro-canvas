import { getRequestIP } from 'h3'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  // Public endpoint backed by ILIKE + tag array scans — cheap for an
  // attacker to abuse for DB pressure. Rate-limit per IP. Cloudflare
  // WAF helps but app-level cap is the second backstop.
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const { allowed } = await checkRateLimit(`templates:list:${ip}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const query = getQuery(event)
  const category = query.category as string | undefined
  // Drop pathological 1-char searches that turn into near-full-table ILIKE scans.
  const rawSearch = (query.search as string | undefined)?.slice(0, 200)
  const search = rawSearch && rawSearch.trim().length >= 2 ? rawSearch.trim() : undefined
  const sortBy = (query.sortBy as string) || 'popular'
  // Cap page to prevent attacker from forcing a huge `skip` that scans
  // half the table on every request.
  const page = Math.max(1, Math.min(Number.parseInt(query.page as string) || 1, 1000))
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
