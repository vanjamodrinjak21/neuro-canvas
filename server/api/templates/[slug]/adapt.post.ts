import { prisma } from '../../../utils/prisma'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { validateBody, templateAdaptSchema } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const slug = getRouterParam(event, 'slug')

  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Template slug required' })
  }

  const body = validateBody(templateAdaptSchema, await readBody(event))

  const template = await prisma.template.findUnique({ where: { slug } })

  if (!template || !template.isPublic) {
    throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  }

  // Get user's AI credential
  const credential = await prisma.credential.findFirst({
    where: { userId },
    orderBy: { lastUsed: 'desc' },
  })

  if (!credential) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No AI provider configured. Add an API key in Settings > AI Providers.',
    })
  }

  // For now, return template data with adapted title
  // Full AI adaptation will use the BYOK key to call the LLM
  // The client-side AI composable will handle the actual generation
  return {
    templateId: template.id,
    templateSlug: template.slug,
    topic: body.topic,
    depth: body.depth || 'medium',
    style: body.style || 'concise',
    domain: body.domain || null,
    nodes: template.nodes,
    edges: template.edges,
    settings: template.settings,
    hasCredential: true,
    provider: credential.provider,
  }
})
