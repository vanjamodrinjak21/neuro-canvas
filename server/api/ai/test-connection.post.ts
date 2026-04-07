import { requireAuthSession } from '../../utils/syncHelpers'
import { checkRateLimit } from '../../utils/redis'
import { validateBody, aiTestConnectionSchema } from '../../utils/validation'
import { validateOutboundUrl, safeFetch } from '../../utils/ssrf'
import { resolveCredential } from '../../utils/resolveCredential'

interface AIModel {
  id: string
  name: string
  contextLength?: number
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`ai:test:${userId}`, 10, 60)
  if (!allowed) {
    return { success: false, message: 'Rate limit exceeded. Try again in a minute.' }
  }

  const body = validateBody(aiTestConnectionSchema, await readBody(event))

  let apiKey: string | null = null

  if (body.rawApiKey) {
    // Testing a new key before saving — use it directly
    apiKey = body.rawApiKey
  } else if (body.credentialId || body.provider !== 'ollama') {
    try {
      const cred = await resolveCredential(userId, body.credentialId)
      apiKey = cred.apiKey
    } catch {
      return { success: false, message: 'No API key found. Add one in Settings.' }
    }
  }

  const urlCheck = validateOutboundUrl(body.baseUrl, body.provider)
  if (!urlCheck.safe) {
    return { success: false, message: urlCheck.error || 'Invalid URL' }
  }
  const baseUrl = urlCheck.resolvedUrl

  try {
    switch (body.provider) {
      case 'ollama': {
        const response = await safeFetch(`${baseUrl}/api/tags`)
        if (!response.ok) {
          return { success: false, message: 'Failed to connect to Ollama server' }
        }
        const data = await response.json() as any
        const models: AIModel[] = (data.models || []).map((m: { name: string }) => ({
          id: m.name,
          name: m.name
        }))
        return { success: true, message: 'Connected successfully', models }
      }

      case 'openai': {
        if (!apiKey) return { success: false, message: 'API key not set' }
        const response = await safeFetch(`${baseUrl}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as any
          return { success: false, message: error.error?.message || 'Invalid API key' }
        }
        return { success: true, message: 'API key verified' }
      }

      case 'anthropic': {
        if (!apiKey) return { success: false, message: 'API key not set' }
        const response = await safeFetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })
        if (response.ok || response.status === 429) {
          return { success: true, message: 'API key verified' }
        }
        const error = await response.json().catch(() => ({})) as any
        return { success: false, message: error.error?.message || 'Invalid API key' }
      }

      case 'openrouter': {
        if (!apiKey) return { success: false, message: 'API key not set' }
        const response = await safeFetch(`${baseUrl}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        if (!response.ok) return { success: false, message: 'Invalid API key' }
        const data = await response.json() as any
        const models: AIModel[] = (data.data || []).slice(0, 50).map((m: { id: string; name?: string; context_length?: number }) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length
        }))
        return { success: true, message: 'Connected successfully', models }
      }

      case 'custom': {
        const response = await safeFetch(baseUrl, { method: 'HEAD' }).catch(() => null)
        if (response?.ok) return { success: true, message: 'Endpoint reachable' }
        return { success: false, message: 'Could not reach endpoint' }
      }

      default:
        return { success: false, message: `Unknown provider: ${body.provider}` }
    }
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'Connection failed' }
  }
})
