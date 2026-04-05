import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const templates = await prisma.template.findMany({
    where: { authorId: userId },
    orderBy: { updatedAt: 'desc' },
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
  })

  return { templates }
})
