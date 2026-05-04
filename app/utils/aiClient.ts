/**
 * Platform-aware AI Client
 *
 * In Tauri (desktop) mode: calls AI providers directly via tauri-plugin-http
 * (routes requests through Rust to bypass WKWebView CORS restrictions).
 * In web mode: calls /api/ai/* server routes as before.
 *
 * Exports the same request/response shapes so downstream code needs zero changes.
 */

interface AICompletionRequest {
  provider: string
  apiKey?: string       // Only used in Tauri mode
  credentialId?: string // Used in web mode
  baseUrl?: string
  model?: string
  systemPrompt?: string
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  temperature?: number
}

interface AICompletionResponse {
  content: string
  usage?: unknown
}

interface AITestConnectionRequest {
  provider: string
  apiKey?: string | null   // Only used in Tauri mode
  credentialId?: string    // Used in web mode
  rawApiKey?: string       // For testing new keys before saving (web)
  baseUrl?: string
}

interface AIModel {
  id: string
  name: string
  contextLength?: number
}

interface AITestConnectionResponse {
  success: boolean
  message: string
  models?: AIModel[]
}

function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

function isCapacitorEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return 'Capacitor' in window && !!(window as any).Capacitor?.isNativePlatform?.()
}

function isNativeShell(): boolean {
  return isTauriEnvironment() || isCapacitorEnvironment()
}

// ─── Tauri-aware fetch ───────────────────────────────────────────────

/**
 * Returns the Tauri plugin-http fetch (bypasses WKWebView CORS) when
 * running inside Tauri, otherwise falls back to the browser's native fetch.
 */
async function getTauriFetch(): Promise<typeof globalThis.fetch> {
  if (isTauriEnvironment()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch
  }
  // On Capacitor: rely on CapacitorHttp.enabled monkey-patching the global
  // fetch — Capacitor's own implementation knows how to encode the JSON body
  // and routes through native NSURLSession, bypassing WKWebView CORS.
  return globalThis.fetch
}

// ─── Ollama model detection ─────────────────────────────────────────

/** Pick the first available Ollama model from the local server. */
let _cachedOllamaModel: string | null = null
async function detectOllamaModel(fetchFn: typeof globalThis.fetch, baseUrl: string): Promise<string> {
  if (_cachedOllamaModel) return _cachedOllamaModel

  try {
    const res = await fetchFn(`${baseUrl}/api/tags`)
    if (res.ok) {
      const data = await res.json()
      const models: string[] = (data.models || []).map((m: { name: string }) => m.name)
      if (models.length > 0) {
        // Use the first installed model — the user knows what they pulled
        _cachedOllamaModel = models[0]!
        return _cachedOllamaModel
      }
    }
  } catch {
    // Ollama not running or unreachable
  }

  return 'llama3.2'
}

// ─── Direct provider calls (Tauri desktop mode) ──────────────────────

async function directComplete(req: AICompletionRequest): Promise<AICompletionResponse> {
  const fetch = await getTauriFetch()
  const { provider, apiKey, model, messages, systemPrompt, maxTokens = 500, temperature = 0.7 } = req

  // Guard: don't send requests with empty API keys (local and ollama don't need keys)
  if (!apiKey && provider !== 'ollama' && provider !== 'local') {
    throw new Error('API key needs to be re-entered for desktop use. Go to Settings > AI Providers and update your API key.')
  }

  switch (provider) {
    case 'openai':
    case 'openrouter': {
      const baseUrl = req.baseUrl || (provider === 'openrouter'
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
        throw new Error(err.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage
      }
    }

    case 'anthropic': {
      const baseUrl = req.baseUrl || 'https://api.anthropic.com/v1'
      const useModel = model || 'claude-haiku-4-5-20251001'

      // Visible in iOS console — confirms which model is actually being requested.
      if (typeof console !== 'undefined') {
        console.info('[anthropic] POST', `${baseUrl}/messages`, 'model:', useModel, 'maxTokens:', maxTokens)
      }

      const response = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Connection': 'close',
          'x-api-key': apiKey || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'User-Agent': 'NeuroCanvas/1.0 (Capacitor)'
        },
        body: JSON.stringify({
          model: useModel,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages
        })
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      return {
        content: data.content?.[0]?.text || '',
        usage: data.usage
      }
    }

    case 'ollama': {
      const baseUrl = req.baseUrl || 'http://localhost:11434'
      // Always auto-detect from local Ollama — ignore stale saved model
      const ollamaModel = await detectOllamaModel(fetch, baseUrl)

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: systemPrompt
            ? [{ role: 'system', content: systemPrompt }, ...messages]
            : messages,
          stream: false
        })
      })

      if (!response.ok) {
        // Model not found — clear cache and retry once with fresh detection
        if (response.status === 404 && _cachedOllamaModel) {
          _cachedOllamaModel = null
          const retryModel = await detectOllamaModel(fetch, baseUrl)
          const retryResponse = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: retryModel,
              messages: systemPrompt
                ? [{ role: 'system', content: systemPrompt }, ...messages]
                : messages,
              stream: false
            })
          })
          if (retryResponse.ok) {
            const retryData = await retryResponse.json()
            return { content: retryData.message?.content || '', usage: null }
          }
        }
        const errText = await response.text().catch(() => '')
        throw new Error(`Ollama error (${response.status}): ${errText || 'No models found'} — Run: ollama list`)
      }

      const data = await response.json()
      return {
        content: data.message?.content || '',
        usage: null
      }
    }

    case 'custom': {
      if (!req.baseUrl) throw new Error('Custom provider requires baseUrl')

      const response = await fetch(`${req.baseUrl}/chat/completions`, {
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
        throw new Error(err.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage
      }
    }

    case 'local': {
      const { useLocalLLM } = await import('~/composables/useLocalLLM')
      const localLLM = useLocalLLM()

      // Build a single prompt string from messages + system prompt
      const userMessages = messages.map(m => m.content).join('\n')
      const result = await localLLM.generate({
        prompt: userMessages,
        systemPrompt,
        maxTokens,
        temperature,
      })

      return {
        content: result.content,
        usage: { total_tokens: result.tokensUsed }
      }
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

async function directTestConnection(req: AITestConnectionRequest): Promise<AITestConnectionResponse> {
  const fetch = await getTauriFetch()
  const { provider, apiKey, baseUrl } = req

  try {
    switch (provider) {
      case 'ollama': {
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
        if (!apiKey) return { success: false, message: 'API key not set' }
        const openaiUrl = baseUrl || 'https://api.openai.com/v1'
        const response = await fetch(`${openaiUrl}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        })
        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          return { success: false, message: error.error?.message || 'Invalid API key' }
        }
        return { success: true, message: 'API key verified' }
      }

      case 'anthropic': {
        if (!apiKey) return { success: false, message: 'API key not set' }
        const anthropicUrl = baseUrl || 'https://api.anthropic.com/v1'
        const response = await fetch(`${anthropicUrl}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json',
            'accept': 'application/json',
            'connection': 'close'
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
        const error = await response.json().catch(() => ({}))
        return { success: false, message: error.error?.message || 'Invalid API key' }
      }

      case 'openrouter': {
        if (!apiKey) return { success: false, message: 'API key not set' }
        const openrouterUrl = baseUrl || 'https://openrouter.ai/api/v1'
        const response = await fetch(`${openrouterUrl}/models`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
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
        if (!baseUrl) return { success: false, message: 'Custom provider requires baseUrl' }
        const response = await fetch(baseUrl, { method: 'HEAD' }).catch(() => null)
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
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Send an AI completion request.
 * In Tauri: calls providers directly.
 * In web: calls /api/ai/completions server route.
 */
export async function aiComplete(req: AICompletionRequest): Promise<AICompletionResponse> {
  if (isNativeShell()) {
    return directComplete(req)
  }

  // Web: only send credentialId — server decrypts from vault
  const { apiKey, credentialId, ...rest } = req
  try {
    const body: Record<string, unknown> = { ...rest }
    if (credentialId) body.credentialId = credentialId
    // Never send apiKey to server
    return await $fetch<AICompletionResponse>('/api/ai/completions', {
      method: 'POST',
      body,
    })
  } catch (e: unknown) {
    const fetchError = e as { data?: { data?: { code?: string } }; statusCode?: number }
    if (fetchError.statusCode === 401) {
      // Convert 401 to plain Error so it shows in the UI instead of
      // triggering the global auth interceptor redirect
      throw new Error('Session expired. Please sign in again to use AI features.')
    }
    if (fetchError.data?.data?.code === 'CREDENTIAL_DECRYPT_FAILED') {
      throw new Error('Failed to decrypt API key. Please re-enter your key in Settings.')
    }
    throw e
  }
}

/**
 * Stream an AI completion via SSE.
 * In Tauri: uses streamCompletion from StreamingPipeline (direct provider call).
 * In web: calls /api/ai/stream SSE endpoint.
 *
 * Returns the streamCompletion function from StreamingPipeline for a unified interface.
 */
export { streamCompletion } from '~/ai/pipeline/StreamingPipeline'

/**
 * Test connection to an AI provider.
 * In Tauri: calls providers directly.
 * In web: calls /api/ai/test-connection server route.
 */
export async function aiTestConnection(req: AITestConnectionRequest): Promise<AITestConnectionResponse> {
  if (isNativeShell()) {
    return directTestConnection(req)
  }

  // Web: send credentialId or rawApiKey for testing new keys
  const { apiKey, credentialId, rawApiKey, ...rest } = req
  const body: Record<string, unknown> = { ...rest }
  if (credentialId) body.credentialId = credentialId
  if (rawApiKey) body.rawApiKey = rawApiKey
  // Never send apiKey to server

  try {
    return await $fetch<AITestConnectionResponse>('/api/ai/test-connection', {
      method: 'POST',
      body
    })
  } catch (e: unknown) {
    const fetchError = e as { statusCode?: number }
    if (fetchError.statusCode === 401) {
      throw new Error('Session expired. Please sign in again to test connections.')
    }
    throw e
  }
}
