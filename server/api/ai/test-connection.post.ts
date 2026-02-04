/**
 * AI Connection Test Proxy API
 * Tests connections to AI providers server-side to avoid CORS issues
 */

interface AIModel {
  id: string
  name: string
  contextLength?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { provider, apiKey, baseUrl } = body

  if (!provider) {
    throw createError({
      statusCode: 400,
      message: 'Missing provider'
    })
  }

  try {
    switch (provider) {
      case 'ollama': {
        // Test Ollama connection and fetch models
        const ollamaUrl = baseUrl || 'http://localhost:11434'
        const response = await fetch(`${ollamaUrl}/api/tags`)
        if (!response.ok) {
          return { success: false, message: 'Failed to connect to Ollama server' }
        }
        const data = await response.json()
        const models: AIModel[] = (data.models || []).map((m: { name: string }) => ({
          id: m.name,
          name: m.name
        }))
        return { success: true, message: 'Connected successfully', models }
      }

      case 'openai': {
        if (!apiKey) {
          return { success: false, message: 'API key not set' }
        }
        const openaiUrl = baseUrl || 'https://api.openai.com/v1'
        const response = await fetch(`${openaiUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })
        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          return {
            success: false,
            message: error.error?.message || 'Invalid API key'
          }
        }
        return { success: true, message: 'API key verified' }
      }

      case 'anthropic': {
        if (!apiKey) {
          return { success: false, message: 'API key not set' }
        }
        const anthropicUrl = baseUrl || 'https://api.anthropic.com/v1'
        // Anthropic doesn't have a models endpoint, so we do a simple test
        const response = await fetch(`${anthropicUrl}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })
        // 200 or 429 (rate limit) both mean the key is valid
        if (response.ok || response.status === 429) {
          return { success: true, message: 'API key verified' }
        }
        const error = await response.json().catch(() => ({}))
        return {
          success: false,
          message: error.error?.message || 'Invalid API key'
        }
      }

      case 'openrouter': {
        if (!apiKey) {
          return { success: false, message: 'API key not set' }
        }
        const openrouterUrl = baseUrl || 'https://openrouter.ai/api/v1'
        const response = await fetch(`${openrouterUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })
        if (!response.ok) {
          return { success: false, message: 'Invalid API key' }
        }
        const data = await response.json()
        const models: AIModel[] = (data.data || []).slice(0, 50).map((m: { id: string; name?: string; context_length?: number }) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length
        }))
        return { success: true, message: 'Connected successfully', models }
      }

      case 'custom': {
        if (!baseUrl) {
          return { success: false, message: 'Custom provider requires baseUrl' }
        }
        // For custom providers, just check if the URL is reachable
        const response = await fetch(baseUrl, {
          method: 'HEAD'
        }).catch(() => null)
        if (response?.ok) {
          return { success: true, message: 'Endpoint reachable' }
        }
        return { success: false, message: 'Could not reach endpoint' }
      }

      default:
        return { success: false, message: `Unknown provider type: ${provider}` }
    }
  } catch (e) {
    return {
      success: false,
      message: e instanceof Error ? e.message : 'Connection failed'
    }
  }
})
