// Client-side streaming pipeline for SSE consumption

import { aiComplete, getTauriFetch, resolveOllamaModel } from '~/utils/aiClient'

export interface StreamEvent {
  type: 'delta' | 'done' | 'error'
  content?: string
  usage?: unknown
  message?: string
  statusCode?: number
}

export interface StreamOptions {
  onDelta?: (content: string, accumulated: string) => void
  onDone?: (fullContent: string, usage?: unknown) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

// Resource guards (AER-81). Stall: even the slowest Opus full-map runs emit
// deltas far more often than this — 90s of silence means a dead connection.
// Size: mirrors the server-side cap in server/utils/streamBudget.ts.
const STREAM_STALL_MS = 90_000
const MAX_STREAM_BYTES = 2_000_000

function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

function isCapacitorEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return 'Capacitor' in window && !!(window as any).Capacitor?.isNativePlatform?.()
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

  // Native shells (Tauri / Capacitor): call provider directly with the
  // locally-stored API key. The web /api/ai/stream endpoint requires a
  // server-side session that mobile doesn't always have, and would 401.
  if (isTauriEnvironment() || isCapacitorEnvironment()) {
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
      // NEVER throw the raw H3 error envelope ({error,url,statusCode,…}) — that
      // JSON blob leaks straight into the UI (see the dock card). Read the body
      // once, pull out the server's human message, and tag the Error with
      // `statusCode` so userFriendlyError() can localise it downstream.
      const raw = await response.text().catch(() => '')
      let detail = ''
      try {
        const body = JSON.parse(raw) as {
          statusMessage?: string
          message?: string
          data?: { message?: string }
        }
        detail = body?.data?.message || body?.statusMessage || body?.message || ''
      } catch {
        // Non-JSON body (proxy / HTML error page) — don't echo it back verbatim.
        detail = ''
      }
      const err = new Error(
        detail || `Stream request failed: ${response.status}`,
      ) as Error & { statusCode?: number }
      err.statusCode = response.status
      throw err
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body for streaming')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''
    let received = 0

    while (true) {
      // Resource guards (AER-81): a silent connection must surface as an
      // error instead of "generating…" forever, and a runaway stream must
      // not grow unbounded in memory.
      let stallTimer: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          stallTimer = setTimeout(
            () => reject(new Error('AI stream stalled — no data received for 90 seconds. Try again.')),
            STREAM_STALL_MS
          )
        })
      ]).catch(async (err) => {
        await reader.cancel().catch(() => { /* already dead */ })
        throw err
      }).finally(() => clearTimeout(stallTimer))

      const { done, value } = result
      if (done) break

      received += value.byteLength
      if (received > MAX_STREAM_BYTES) {
        await reader.cancel().catch(() => { /* already dead */ })
        throw new Error('AI response exceeded the 2 MB stream limit. Try a smaller generation.')
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        // Only JSON.parse is guarded here. Event handling must stay OUTSIDE
        // the catch: server-reported provider failures arrive as `error`
        // events on an HTTP-200 stream, and swallowing them makes a failed
        // generation look like a successful empty response (AER-77).
        let event: StreamEvent
        try {
          event = JSON.parse(line.slice(6))
        } catch {
          continue // Skip malformed SSE data
        }

        if (event.type === 'delta' && event.content) {
          accumulated += event.content
          onDelta?.(event.content, accumulated)
        } else if (event.type === 'done') {
          onDone?.(accumulated, event.usage)
        } else if (event.type === 'error') {
          const message = event.message || 'Unknown streaming error'
          onError?.(message)
          const err = new Error(message) as Error & { statusCode?: number }
          if (event.statusCode) err.statusCode = event.statusCode
          throw err
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

interface TauriStreamParams {
  provider: string
  apiKey?: string
  credentialId?: string
  baseUrl?: string
  model?: string
  systemPrompt?: string
  messages: Array<{ role: string; content: string }>
  maxTokens?: number
  temperature?: number
}

/**
 * Stream via Tauri plugin-http (bypasses WKWebView CORS).
 *
 * For Ollama running under Tauri desktop we do a REAL NDJSON token stream
 * (AER-96). Every other provider — and the whole Capacitor path — keeps the
 * blocking-then-simulate delivery. Any setup failure of the real stream
 * (fetch throws, no body, non-OK) falls back to the simulated path so
 * behaviour never regresses.
 */
async function streamViaTauri(
  params: TauriStreamParams,
  options: StreamOptions
): Promise<string> {
  if (params.provider === 'ollama' && isTauriEnvironment()) {
    try {
      return await streamOllamaViaTauri(params, options)
    } catch (e) {
      // Genuine aborts must propagate — do NOT fall back to a fresh request.
      if (options.signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        throw e
      }
      // Resource-guard trips (stall / size cap) are real failures the user
      // should see — surface them instead of silently retrying non-streamed.
      const msg = e instanceof Error ? e.message : ''
      if (/stalled|exceeded/.test(msg)) throw e
      // Otherwise the streaming *setup* failed (fetch threw, no body, non-OK
      // without a resource trip). Fall through to the simulated path below.
    }
  }

  return streamViaSimulate(params, options)
}

/**
 * Real NDJSON token streaming for Ollama under Tauri desktop (AER-96).
 *
 * Ollama's /api/chat with `stream:true` emits one JSON object per line:
 *   { "message": { "role": "assistant", "content": "<token>" }, "done": false }
 * terminating with a `"done": true` line carrying eval counts.
 */
async function streamOllamaViaTauri(
  params: TauriStreamParams,
  options: StreamOptions
): Promise<string> {
  const { onDelta, onDone, signal } = options
  const baseUrl = params.baseUrl || 'http://localhost:11434'

  const fetchFn = await getTauriFetch()
  const model = await resolveOllamaModel(fetchFn, baseUrl, params.model)

  const messages = params.systemPrompt
    ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
    : params.messages

  const response = await fetchFn(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal
  })

  if (!response.ok) {
    // Surface the Ollama error text like directComplete does. This throw is
    // caught by streamViaTauri, which then falls back to the simulated path
    // (which re-issues the request and surfaces the same error to the user).
    const errText = await response.text().catch(() => '')
    throw new Error(`Ollama error (${response.status}): ${errText || 'No models found'} — Run: ollama list`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body for Ollama streaming')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''
  let received = 0
  let usage: unknown

  const parseLine = (line: string): boolean => {
    const trimmed = line.trim()
    if (!trimmed) return false
    let obj: {
      message?: { content?: string }
      done?: boolean
      prompt_eval_count?: number
      eval_count?: number
    }
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return false // skip malformed line
    }
    const token = obj.message?.content
    if (token) {
      accumulated += token
      onDelta?.(token, accumulated)
    }
    if (obj.done) {
      const promptTokens = obj.prompt_eval_count
      const completionTokens = obj.eval_count
      if (typeof promptTokens === 'number' || typeof completionTokens === 'number') {
        usage = {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: (promptTokens || 0) + (completionTokens || 0)
        }
      }
      return true
    }
    return false
  }

  try {
    while (true) {
      // Resource guards (AER-81) — mirror the web SSE path: a silent
      // connection surfaces as an error instead of hanging forever, and a
      // runaway stream cannot grow unbounded in memory.
      let stallTimer: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          stallTimer = setTimeout(
            () => reject(new Error('AI stream stalled — no data received for 90 seconds. Try again.')),
            STREAM_STALL_MS
          )
        })
      ]).catch(async (err) => {
        await reader.cancel().catch(() => { /* already dead */ })
        throw err
      }).finally(() => clearTimeout(stallTimer))

      const { done, value } = result
      if (done) break

      received += value.byteLength
      if (received > MAX_STREAM_BYTES) {
        await reader.cancel().catch(() => { /* already dead */ })
        throw new Error('AI response exceeded the 2 MB stream limit. Try a smaller generation.')
      }

      buffer += decoder.decode(value, { stream: true })
      // Ollama delimits objects with newlines. Keep the trailing partial line
      // in the buffer until its newline arrives.
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) parseLine(line)
    }
  } catch (e) {
    if (signal?.aborted) {
      throw new DOMException('Stream aborted', 'AbortError')
    }
    throw e
  }

  // Flush any final buffered line (last object may arrive without a trailing \n).
  if (buffer.trim()) parseLine(buffer)

  onDone?.(accumulated, usage)
  return accumulated
}

/**
 * Non-streaming fallback: block on aiComplete, then simulate chunked delivery
 * for UI consistency. Used for every non-Ollama provider, on Capacitor, and
 * whenever real Ollama streaming setup fails.
 */
async function streamViaSimulate(
  params: TauriStreamParams,
  options: StreamOptions
): Promise<string> {
  // Fallback: use non-streaming and simulate chunked delivery
  // Real streaming via Tauri requires plugin-http streaming support

  // Tell the UI we've started talking to the provider — without this the
  // sheet sits at "Connecting to model…" the entire time the request is
  // in flight (which can be 30–90s for large Opus completions).
  const t0 = Date.now()
  const placeholder = (sec: number) =>
    `Calling ${params.provider}… ${sec}s elapsed (full map can take 30–90s on Opus)`
  options.onDelta?.('', placeholder(0))
  const tick = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000)
    options.onDelta?.('', placeholder(sec))
  }, 1000)

  let response: { content: string; usage?: unknown }
  try {
    response = await aiComplete({
      provider: params.provider,
      apiKey: params.apiKey || '',
      baseUrl: params.baseUrl,
      model: params.model,
      systemPrompt: params.systemPrompt,
      messages: params.messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature
    })
  } finally {
    clearInterval(tick)
  }

  const content = response.content
  // Reset the placeholder before replaying the real content.
  options.onDelta?.('', '')

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

  // Close brackets in reverse order — joined once, not appended per char
  // (per-char appends re-copy the string each time: O(n²) on inputs with
  // many unclosed brackets, see AER-81).
  return result + '}'.repeat(Math.max(0, braces)) + ']'.repeat(Math.max(0, brackets))
}
