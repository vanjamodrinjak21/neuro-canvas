import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Template slug required' })
  }

  const template = await prisma.template.findUnique({
    where: { slug },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  })

  if (!template || (!template.isPublic && !template.isSystem)) {
    throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  }

  return template
})
