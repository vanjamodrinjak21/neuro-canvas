// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamCompletion } from '~/ai/pipeline/StreamingPipeline'

// The Tauri plugin-http fetch is dynamically imported by aiClient.getTauriFetch().
// Route it to a per-test programmable handler for the Ollama streaming tests.
let tauriFetchHandler: (url: string, init?: any) => Promise<any>
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (url: string, init?: any) => tauriFetchHandler(url, init)
}))

// ---------------------------------------------------------------------------
// streamCompletion — web SSE path (AER-77)
//
// The server proxies providers over an HTTP-200 SSE stream and reports
// provider failures as `data: {type:'error', message}` events. A provider
// failure MUST reject streamCompletion with the provider's message —
// otherwise executeWithRetry sees a successful empty string, the empty
// content gets cached (400 on /api/ai/cache) and the user gets the
// misleading "AI returned an empty response" error.
// ---------------------------------------------------------------------------

const PARAMS = {
  provider: 'anthropic',
  credentialId: 'cred-1',
  model: 'claude-sonnet-4-6',
  systemPrompt: 'sys',
  messages: [{ role: 'user', content: 'topic' }],
  maxTokens: 1024,
  temperature: 0.7
}

/** Build a fetch mock resolving to an HTTP-200 SSE response. Each event is
 *  either an object (JSON-encoded as a `data:` line) or a raw pre-formatted
 *  SSE line (to simulate malformed payloads). */
function sseFetch(events: Array<Record<string, unknown> | string>) {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        const line = typeof event === 'string'
          ? `${event}\n\n`
          : `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    }
  })
  return vi.fn().mockResolvedValue({ ok: true, status: 200, body })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('streamCompletion (web SSE path)', () => {
  it('rejects with the provider message when the server emits an error event', async () => {
    vi.stubGlobal('fetch', sseFetch([
      { type: 'error', message: 'API error: 403' }
    ]))

    await expect(streamCompletion(PARAMS)).rejects.toThrow('API error: 403')
  })

  it('rejects when an error event arrives after partial deltas', async () => {
    vi.stubGlobal('fetch', sseFetch([
      { type: 'delta', content: '{"rootTopic":' },
      { type: 'error', message: 'insufficient credits' }
    ]))

    await expect(streamCompletion(PARAMS)).rejects.toThrow('insufficient credits')
  })

  it('invokes onError with the provider message before rejecting', async () => {
    vi.stubGlobal('fetch', sseFetch([
      { type: 'error', message: 'model overloaded' }
    ]))
    const onError = vi.fn()

    await expect(streamCompletion(PARAMS, { onError })).rejects.toThrow('model overloaded')
    expect(onError).toHaveBeenCalledWith('model overloaded')
  })

  it('carries the upstream statusCode on error events so userFriendlyError can localise', async () => {
    vi.stubGlobal('fetch', sseFetch([
      { type: 'error', message: 'API error: 429', statusCode: 429 }
    ]))

    const failure = await streamCompletion(PARAMS).then(
      () => { throw new Error('expected rejection') },
      (e: Error & { statusCode?: number }) => e
    )
    expect(failure.message).toBe('API error: 429')
    expect(failure.statusCode).toBe(429)
  })

  it('accumulates deltas and resolves on done', async () => {
    vi.stubGlobal('fetch', sseFetch([
      { type: 'delta', content: '{"a":' },
      { type: 'delta', content: '1}' },
      { type: 'done', usage: { total_tokens: 5 } }
    ]))
    const onDelta = vi.fn()
    const onDone = vi.fn()

    await expect(streamCompletion(PARAMS, { onDelta, onDone })).resolves.toBe('{"a":1}')
    expect(onDelta).toHaveBeenCalledTimes(2)
    expect(onDelta).toHaveBeenLastCalledWith('1}', '{"a":1}')
    expect(onDone).toHaveBeenCalledWith('{"a":1}', { total_tokens: 5 })
  })

  it('skips malformed SSE lines without dropping later deltas', async () => {
    vi.stubGlobal('fetch', sseFetch([
      'data: {this is not json',
      { type: 'delta', content: 'ok' },
      { type: 'done' }
    ]))

    await expect(streamCompletion(PARAMS)).resolves.toBe('ok')
  })

  it('surfaces the server detail and statusCode on non-ok HTTP responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ statusMessage: 'Forbidden: CSRF validation failed' })
    }))

    const failure = await streamCompletion(PARAMS).then(
      () => { throw new Error('expected rejection') },
      (e: Error & { statusCode?: number }) => e
    )
    expect(failure.message).toBe('Forbidden: CSRF validation failed')
    expect(failure.statusCode).toBe(403)
  })
})

// ─── AER-81: resource guards — stall timeout + output size cap ───────────────
describe('streamCompletion — resource guards (AER-81)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects when the stream stalls (no data for 90s) instead of hanging forever', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({ start() { /* never enqueues, never closes */ } })
    }))
    vi.useFakeTimers()

    const promise = streamCompletion(PARAMS)
    const assertion = expect(promise).rejects.toThrow(/stalled/)
    await vi.advanceTimersByTimeAsync(90_001)
    await assertion
  })

  it('rejects once the stream exceeds the output size limit', async () => {
    const big = 'x'.repeat(800_000)
    vi.stubGlobal('fetch', sseFetch([
      { type: 'delta', content: big },
      { type: 'delta', content: big },
      { type: 'delta', content: big },
      { type: 'done' }
    ]))

    await expect(streamCompletion(PARAMS)).rejects.toThrow(/exceeded/)
  })
})

// ─── AER-96: real NDJSON token streaming for Ollama under Tauri ──────────────
//
// Under Tauri desktop, Ollama uses a real /api/chat stream:true request that
// emits one JSON object per line ({message:{content},done:false} … done:true).
// These tests mock the plugin-http fetch with a ReadableStream, including lines
// split across chunks, and assert onDelta accumulation, done handling, and the
// fallback-to-simulated path on a non-OK response.

/** Build a plugin-http Response whose body streams the given raw string chunks. */
function ndjsonStreamResponse(status: number, chunks: string[]) {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    }
  })
  return { ok: status >= 200 && status < 300, status, body, text: async () => 'error body' }
}

const OLLAMA_PARAMS = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:latest', // explicit model → no /api/tags auto-detect
  systemPrompt: 'sys',
  messages: [{ role: 'user', content: 'topic' }],
  maxTokens: 1024,
  temperature: 0.7
}

describe('streamCompletion — Ollama NDJSON streaming under Tauri (AER-96)', () => {
  beforeEach(() => {
    ;(window as any).__TAURI__ = {}
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    delete (window as any).__TAURI__
  })

  it('parses NDJSON tokens (lines split across chunks) and accumulates via onDelta', async () => {
    tauriFetchHandler = async (url) => {
      if (url.endsWith('/api/chat')) {
        return ndjsonStreamResponse(200, [
          // A line split across two chunks — the parser must buffer the partial.
          '{"message":{"role":"assistant","content":"Hel',
          'lo"},"done":false}\n',
          '{"message":{"role":"assistant","content":" world"},"done":false}\n',
          // done line carries eval counts → usage
          '{"message":{"role":"assistant","content":"!"},"done":true,"prompt_eval_count":10,"eval_count":3}\n'
        ])
      }
      throw new Error(`unexpected ${url}`)
    }
    const onDelta = vi.fn()
    const onDone = vi.fn()

    const result = await streamCompletion(OLLAMA_PARAMS, { onDelta, onDone })

    expect(result).toBe('Hello world!')
    expect(onDelta).toHaveBeenCalledTimes(3)
    expect(onDelta).toHaveBeenNthCalledWith(1, 'Hello', 'Hello')
    expect(onDelta).toHaveBeenNthCalledWith(2, ' world', 'Hello world')
    expect(onDelta).toHaveBeenNthCalledWith(3, '!', 'Hello world!')
    expect(onDone).toHaveBeenCalledWith('Hello world!', {
      prompt_tokens: 10,
      completion_tokens: 3,
      total_tokens: 13
    })
  })

  it('flushes a final buffered line that lacks a trailing newline', async () => {
    tauriFetchHandler = async (url) => {
      if (url.endsWith('/api/chat')) {
        return ndjsonStreamResponse(200, [
          '{"message":{"content":"only"},"done":false}\n',
          // no trailing newline on the terminal done line
          '{"message":{"content":" token"},"done":true}'
        ])
      }
      throw new Error(`unexpected ${url}`)
    }

    const result = await streamCompletion(OLLAMA_PARAMS)
    expect(result).toBe('only token')
  })

  it('skips malformed NDJSON lines without dropping later tokens', async () => {
    tauriFetchHandler = async (url) => {
      if (url.endsWith('/api/chat')) {
        return ndjsonStreamResponse(200, [
          '{ this is not json\n',
          '{"message":{"content":"ok"},"done":false}\n',
          '{"done":true}\n'
        ])
      }
      throw new Error(`unexpected ${url}`)
    }

    await expect(streamCompletion(OLLAMA_PARAMS)).resolves.toBe('ok')
  })

  it('falls back to the simulated (non-streaming) path on a non-OK response', async () => {
    let chatCalls = 0
    tauriFetchHandler = async (url, init) => {
      if (url.endsWith('/api/chat')) {
        chatCalls++
        if (chatCalls === 1) {
          // Streaming attempt: non-OK → throws → fallback path
          return ndjsonStreamResponse(500, [])
        }
        // Fallback path re-issues a blocking (stream:false) request
        expect(JSON.parse(init.body).stream).toBe(false)
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: { content: 'fallback content' } }),
          text: async () => ''
        }
      }
      throw new Error(`unexpected ${url}`)
    }
    const onDone = vi.fn()

    const result = await streamCompletion(OLLAMA_PARAMS, { onDone })

    expect(result).toBe('fallback content')
    expect(chatCalls).toBe(2) // streaming attempt + simulated fallback
    expect(onDone).toHaveBeenCalledWith('fallback content', null)
  })
})
