// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { streamCompletion } from '~/ai/pipeline/StreamingPipeline'

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
