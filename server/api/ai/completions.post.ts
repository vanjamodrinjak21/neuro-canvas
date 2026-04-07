import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'
import { validateBody, aiCompletionSchema } from '../../utils/validation'
import { validateOutboundUrl, safeFetch } from '../../utils/ssrf'
import { resolveCredential } from '../../utils/resolveCredential'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed, remaining } = await checkRateLimit(`ai:${userId}`, 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'AI rate limit exceeded. Try again later.' })
  }
  setResponseHeader(event, 'X-RateLimit-Remaining', String(remaining))

  const body = validateBody(aiCompletionSchema, await readBody(event))

  // Resolve API key from vault (never from request body)
  let apiKey: string | null = null
  if (body.provider !== 'ollama') {
    const cred = await resolveCredential(userId, body.credentialId)
    apiKey = cred.apiKey
  }

  const urlCheck = validateOutboundUrl(body.baseUrl, body.provider)
  if (!urlCheck.safe) {
    throw createError({ statusCode: 400, statusMessage: urlCheck.error || 'Invalid base URL' })
  }
  const baseUrl = urlCheck.resolvedUrl

  try {
    switch (body.provider) {
      case 'openai':
      case 'openrouter': {
        const response = await safeFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...(body.provider === 'openrouter' && {
              'HTTP-Referer': 'https://neuro-canvas.com',
              'X-Title': 'NeuroCanvas'
            })
          },
          body: JSON.stringify({
            model: body.model || (body.provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
            messages: body.systemPrompt
              ? [{ role: 'system', content: body.systemPrompt }, ...body.messages]
              : body.messages,
            temperature: body.temperature,
            max_tokens: body.maxTokens
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw createError({
            statusCode: response.status,
            message: (err as any).error?.message || `API error: ${response.status}`
          })
        }

        const data = await response.json() as any
        return {
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage
        }
      }

      case 'anthropic': {
        const response = await safeFetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey!,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: body.model || 'claude-sonnet-4-20250514',
            max_tokens: body.maxTokens,
            system: body.systemPrompt,
            messages: body.messages
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw createError({
            statusCode: response.status,
            message: (err as any).error?.message || `API error: ${response.status}`
          })
        }

        const data = await response.json() as any
        return {
          content: data.content?.[0]?.text || '',
          usage: data.usage
        }
      }

      case 'ollama': {
        const response = await safeFetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: body.model || 'llama3.2',
            messages: body.systemPrompt
              ? [{ role: 'system', content: body.systemPrompt }, ...body.messages]
              : body.messages,
            stream: false
          })
        })

        if (!response.ok) {
          throw createError({
            statusCode: response.status,
            message: `Ollama error: ${response.status}`
          })
        }

        const data = await response.json() as any
        return {
          content: data.message?.content || '',
          usage: null
        }
      }

      case 'custom': {
        const response = await safeFetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: body.model || 'default',
            messages: body.systemPrompt
              ? [{ role: 'system', content: body.systemPrompt }, ...body.messages]
              : body.messages,
            temperature: body.temperature,
            max_tokens: body.maxTokens
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw createError({
            statusCode: response.status,
            message: (err as any).error?.message || `API error: ${response.status}`
          })
        }

        const data = await response.json() as any
        return {
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage
        }
      }

      default:
        throw createError({ statusCode: 400, message: `Unsupported provider: ${body.provider}` })
    }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({
      statusCode: 502,
      message: e instanceof Error ? e.message : 'AI request failed'
    })
  }
})
