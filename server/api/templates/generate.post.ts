import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'
import { resolveCredential } from '../../utils/resolveCredential'
import { validateOutboundUrl, safeFetch } from '../../utils/ssrf'
import { validateBody, templateGenerateSchema } from '../../utils/validation'
import { openaiTokenParams } from '../../utils/openaiChatBody'

/**
 * Server-side AI template generation.
 * Uses centralized resolveCredential for consistent credential handling.
 */
export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`ai:gen:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Rate limit exceeded' })
  }

  const { topic, depth, style, domain } = validateBody(templateGenerateSchema, await readBody(event))

  // Resolve credential from vault (consistent with AI endpoints)
  const cred = await resolveCredential(userId)
  const apiKey = cred.apiKey

  // Determine provider type and base URL
  const provider = cred.provider
  const urlCheck = validateOutboundUrl(undefined, provider)
  if (!urlCheck.safe) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid provider configuration' })
  }
  const baseUrl = urlCheck.resolvedUrl

  // Build the prompt
  const branchCount = depth === 'shallow' ? 3 : depth === 'deep' ? 7 : 5
  const maxDepth = depth === 'shallow' ? 1 : depth === 'deep' ? 3 : 2
  // Dynamic budget: deeper maps emit a much larger JSON document. A flat 4000
  // cap truncated it and produced near-empty maps. Stay <=16000 (non-streamed).
  const maxTokens = depth === 'shallow' ? 6000 : depth === 'deep' ? 16000 : 12000

  const systemPrompt = `You are a world-class mind-map architect. Turn the topic into a rich, multi-level map and return it as STRICT JSON only.

The response must be valid JSON with this exact structure (keys in English):
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

REQUIREMENTS:
- Exactly ${branchCount} main branches, each a DISTINCT facet of the topic (no overlap, no synonyms).
- EVERY main branch must have 2-4 children; go up to ${maxDepth} level(s) deep where it adds value. A root with childless branches is a FAILURE.
- Vary the shape — some branches wider, some deeper. Aim for ${branchCount * 4}-${branchCount * 6} total nodes.
- Use varied "category" values: concept, fact, question, example, definition, process. Include at least one genuine question and one concrete real-world example.
- Titles are specific (2-8 words). Never use generic labels like "Types of X", "Benefits of X", "Overview", or "Other".
- Each "summary" teaches something (mechanism, significance, or a surprising fact) — never just restates the title.
Style: ${style}.${domain ? ` Domain: ${domain}.` : ''}
RESPOND WITH ONLY VALID JSON, NO MARKDOWN.`

  const userPrompt = `Create a mind map structure for: "${topic}"`

  try {
    let content: string

    if (provider === 'anthropic') {
      const response = await safeFetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: maxTokens,
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
      const model = provider === 'openrouter' ? 'openai/gpt-5.4-mini' : 'gpt-5.4-mini'
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://neuro-canvas.com'
        headers['X-Title'] = 'NeuroCanvas'
      }

      const response = await safeFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          ...openaiTokenParams(provider, model, maxTokens, 0.7),
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
    // Log the real failure for triage but return a generic message.
    // Upstream / parse errors can include prompt fragments and provider
    // request IDs that we don't want surfaced to the client.
    console.error('template generation failed', {
      name: (e as Error)?.name,
      code: (e as { code?: string })?.code,
    })
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to generate template',
    })
  }
})
