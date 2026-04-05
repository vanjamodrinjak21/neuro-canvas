import { prisma } from '../../utils/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { serverFullDecrypt } from '../../utils/encryption'
import { validateOutboundUrl } from '../../utils/ssrf'

/**
 * Server-side AI template generation.
 * Bypasses client-side vault chain — fetches credential directly from DB.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const body = await readBody(event)

  const topic = body.topic?.trim()
  if (!topic) {
    throw createError({ statusCode: 400, statusMessage: 'Topic is required' })
  }

  const depth = body.depth || 'medium'
  const style = body.style || 'detailed'
  const domain = body.domain || null

  // Find the user's most recently used credential
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

  // Decrypt server-side
  let apiKey: string
  try {
    const result = serverFullDecrypt(userId, credential.encryptedValue, credential.encryptionVersion)
    apiKey = result.plaintext
    // Self-heal if needed
    if (result.credentialUpdate) {
      prisma.credential.update({
        where: { id: credential.id },
        data: {
          ...result.credentialUpdate,
          lastUsed: new Date(),
        },
      }).catch(() => {})
    } else {
      prisma.credential.update({
        where: { id: credential.id },
        data: { lastUsed: new Date() },
      }).catch(() => {})
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to decrypt API key. Try removing and re-adding your key in Settings.',
    })
  }

  // Determine provider type and base URL
  const provider = credential.provider
  const urlCheck = validateOutboundUrl(undefined, provider)
  if (!urlCheck.safe) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid provider configuration' })
  }
  const baseUrl = urlCheck.resolvedUrl

  // Build the prompt
  const branchCount = depth === 'shallow' ? 3 : depth === 'deep' ? 7 : 5
  const maxDepth = depth === 'shallow' ? 1 : depth === 'deep' ? 3 : 2

  const systemPrompt = `You are a mind map structure generator. Generate a hierarchical mind map structure as JSON.
The response must be valid JSON with this exact structure:
{
  "rootTopic": "string",
  "rootDescription": { "summary": "string", "keywords": ["string"] },
  "branches": [
    {
      "title": "string",
      "description": { "summary": "string", "keywords": ["string"] },
      "category": "concept",
      "children": [
        {
          "title": "string",
          "description": { "summary": "string" },
          "category": "concept",
          "children": [],
          "depth": 1
        }
      ],
      "depth": 0
    }
  ]
}
Style: ${style}. ${domain ? `Domain: ${domain}.` : ''}
Generate ${branchCount} main branches with up to ${maxDepth} levels of children.
Each branch should have 2-4 children. Be specific and actionable.
RESPOND WITH ONLY VALID JSON, NO MARKDOWN.`

  const userPrompt = `Create a mind map structure for: "${topic}"`

  try {
    let content: string

    if (provider === 'anthropic') {
      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as any
        throw new Error(err.error?.message || `Anthropic API error: ${response.status}`)
      }

      const data = await response.json() as any
      content = data.content?.[0]?.text || ''
    } else if (provider === 'openai' || provider === 'openrouter') {
      const model = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://neuro-canvas.com'
        headers['X-Title'] = 'NeuroCanvas'
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as any
        throw new Error(err.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json() as any
      content = data.choices?.[0]?.message?.content || ''
    } else {
      throw new Error(`Unsupported provider: ${provider}`)
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
    const jsonStr = (jsonMatch[1] || content).trim()
    const structure = JSON.parse(jsonStr)

    return { structure }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({
      statusCode: 502,
      statusMessage: e instanceof Error ? e.message : 'AI generation failed',
    })
  }
})
