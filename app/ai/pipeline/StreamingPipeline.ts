// Client-side streaming pipeline for SSE consumption

import { aiComplete } from '~/utils/aiClient'

export interface StreamEvent {
  type: 'delta' | 'done' | 'error'
  content?: string
  usage?: unknown
  message?: string
}

export interface StreamOptions {
  onDelta?: (content: string, accumulated: string) => void
  onDone?: (fullContent: string, usage?: unknown) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

/**
 * Stream an AI completion, calling onDelta as each chunk arrives.
 * Falls back to non-streaming if streaming is not available.
 */
export async function streamCompletion(
  params: {
    provider: string
    apiKey?: string
    credentialId?: string // Server vault credential ID (web only)
    baseUrl?: string
    model?: string
    systemPrompt?: string
    messages: Array<{ role: string; content: string }>
    maxTokens?: number
    temperature?: number
  },
  options: StreamOptions = {}
): Promise<string> {
  const { onDelta, onDone, onError, signal } = options

  // In Tauri, use direct streaming via plugin-http
  if (isTauriEnvironment()) {
    return streamViaTauri(params, options)
  }

  // Web: only send credentialId — server decrypts
  const { apiKey, credentialId, ...rest } = params
  const streamBody: Record<string, unknown> = { ...rest }
  if (credentialId) streamBody.credentialId = credentialId
  // Never send apiKey to server

  // In web, use the SSE endpoint
  try {
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(streamBody),
      signal
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please sign in again to use AI features.')
      }
      const errorText = await response.text()
      throw new Error(errorText || `Stream request failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body for streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: StreamEvent = JSON.parse(line.slice(6))

            if (event.type === 'delta' && event.content) {
              accumulated += event.content
              onDelta?.(event.content, accumulated)
            } else if (event.type === 'done') {
              onDone?.(accumulated, event.usage)
            } else if (event.type === 'error') {
              onError?.(event.message || 'Unknown streaming error')
              throw new Error(event.message || 'Streaming error')
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes('Streaming error')) throw e
            // Skip malformed SSE data
          }
        }
      }
    }

    return accumulated
  } catch (e) {
    if (signal?.aborted) {
      throw new DOMException('Stream aborted', 'AbortError')
    }
    throw e
  }
}

/**
 * Stream via Tauri plugin-http (bypasses WKWebView CORS)
 */
async function streamViaTauri(
  params: {
    provider: string
    apiKey?: string
    credentialId?: string
    baseUrl?: string
    model?: string
    systemPrompt?: string
    messages: Array<{ role: string; content: string }>
    maxTokens?: number
    temperature?: number
  },
  options: StreamOptions
): Promise<string> {
  // Fallback: use non-streaming and simulate chunked delivery
  // Real streaming via Tauri requires plugin-http streaming support
  const response = await aiComplete({
    provider: params.provider,
    apiKey: params.apiKey || '',
    baseUrl: params.baseUrl,
    model: params.model,
    systemPrompt: params.systemPrompt,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature
  })

  const content = response.content
  // Simulate progressive delivery for UI consistency
  const chunkSize = 20
  let accumulated = ''

  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.slice(i, i + chunkSize)
    accumulated += chunk
    options.onDelta?.(chunk, accumulated)
    // Small delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, 10))
  }

  options.onDone?.(content, response.usage)
  return content
}

/**
 * Try to parse partial JSON, auto-closing brackets as needed.
 * Useful for progressive JSON parsing during streaming.
 */
export function tryParsePartialJSON(partial: string): unknown | null {
  // First try direct parse
  try {
    return JSON.parse(partial)
  } catch {
    // Auto-close brackets
    const closed = autoCloseJSON(partial)
    try {
      return JSON.parse(closed)
    } catch {
      return null
    }
  }
}

/**
 * Auto-close unclosed JSON brackets for partial parsing
 */
export function autoCloseJSON(partial: string): string {
  let result = partial.trim()

  // Remove trailing comma
  result = result.replace(/,\s*$/, '')

  // Count unclosed brackets
  let braces = 0
  let brackets = 0
  let inString = false
  let escaped = false

  for (const char of result) {
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue

    if (char === '{') braces++
    else if (char === '}') braces--
    else if (char === '[') brackets++
    else if (char === ']') brackets--
  }

  // Close any unclosed strings
  if (inString) result += '"'

  // Close brackets in reverse order
  while (braces > 0) { result += '}'; braces-- }
  while (brackets > 0) { result += ']'; brackets-- }

  return result
}
