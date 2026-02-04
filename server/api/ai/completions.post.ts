/**
 * AI Completions Proxy API
 * Proxies requests to AI providers (OpenAI, Anthropic, etc.) to avoid CORS issues
 * API keys are sent from the client (encrypted in IndexedDB) and used server-side
 */

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { provider, apiKey, model, messages, systemPrompt, maxTokens = 500, temperature = 0.7 } = body

  if (!provider || !apiKey) {
    throw createError({
      statusCode: 400,
      message: 'Missing provider or apiKey'
    })
  }

  try {
    switch (provider) {
      case 'openai':
      case 'openrouter': {
        const baseUrl = body.baseUrl || (provider === 'openrouter'
          ? 'https://openrouter.ai/api/v1'
          : 'https://api.openai.com/v1')

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...(provider === 'openrouter' && {
              'HTTP-Referer': 'https://neuro-canvas.com',
              'X-Title': 'NeuroCanvas'
            })
          },
          body: JSON.stringify({
            model: model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
            messages: systemPrompt
              ? [{ role: 'system', content: systemPrompt }, ...messages]
              : messages,
            temperature,
            max_tokens: maxTokens
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw createError({
            statusCode: response.status,
            message: err.error?.message || `API error: ${response.status}`
          })
        }

        const data = await response.json()
        return {
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage
        }
      }

      case 'anthropic': {
        const baseUrl = body.baseUrl || 'https://api.anthropic.com/v1'

        const response = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model || 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: messages
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw createError({
            statusCode: response.status,
            message: err.error?.message || `API error: ${response.status}`
          })
        }

        const data = await response.json()
        return {
          content: data.content?.[0]?.text || '',
          usage: data.usage
        }
      }

      case 'ollama': {
        const baseUrl = body.baseUrl || 'http://localhost:11434'

        const response = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model || 'llama3.2',
            messages: systemPrompt
              ? [{ role: 'system', content: systemPrompt }, ...messages]
              : messages,
            stream: false
          })
        })

        if (!response.ok) {
          throw createError({
            statusCode: response.status,
            message: `Ollama error: ${response.status}`
          })
        }

        const data = await response.json()
        return {
          content: data.message?.content || '',
          usage: null
        }
      }

      case 'custom': {
        if (!body.baseUrl) {
          throw createError({
            statusCode: 400,
            message: 'Custom provider requires baseUrl'
          })
        }

        // Assume OpenAI-compatible API for custom providers
        const response = await fetch(`${body.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'default',
            messages: systemPrompt
              ? [{ role: 'system', content: systemPrompt }, ...messages]
              : messages,
            temperature,
            max_tokens: maxTokens
          })
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw createError({
            statusCode: response.status,
            message: err.error?.message || `API error: ${response.status}`
          })
        }

        const data = await response.json()
        return {
          content: data.choices?.[0]?.message?.content || '',
          usage: data.usage
        }
      }

      default:
        throw createError({
          statusCode: 400,
          message: `Unsupported provider: ${provider}`
        })
    }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) {
      throw e
    }
    throw createError({
      statusCode: 500,
      message: e instanceof Error ? e.message : 'AI request failed'
    })
  }
})
