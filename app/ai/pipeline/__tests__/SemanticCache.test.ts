// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SemanticCache } from '~/ai/pipeline/SemanticCache'

// ---------------------------------------------------------------------------
// SemanticCache — empty-response guard (AER-77)
//
// aiCachePostSchema requires `response` to be a non-empty string, so POSTing
// an empty response is a guaranteed 400. Worse, a cached empty string would
// be replayed as a "hit" and fail parsing forever. Empty content must never
// be cached — not in Redis, not locally.
// ---------------------------------------------------------------------------

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ hit: false, response: null, usage: null })
  vi.stubGlobal('$fetch', fetchMock)
})

describe('SemanticCache.set', () => {
  it('does not POST an empty response to /api/ai/cache', async () => {
    const cache = new SemanticCache()
    await cache.set('sys', 'user', '', null, 'generate')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not POST a whitespace-only response', async () => {
    const cache = new SemanticCache()
    await cache.set('sys', 'user', '  \n\t ', null, 'generate')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not store empty responses in the local cache either', async () => {
    const cache = new SemanticCache()
    await cache.set('sys', 'user', '', null, 'generate')

    await expect(cache.get('sys', 'user')).resolves.toBeNull()
  })

  it('POSTs non-empty responses with hash and ttl', async () => {
    const cache = new SemanticCache()
    await cache.set('sys', 'user', '{"rootTopic":"x"}', { total_tokens: 9 }, 'generate')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, { method: string; body: Record<string, unknown> }]
    expect(url).toBe('/api/ai/cache')
    expect(opts.method).toBe('POST')
    expect(opts.body).toMatchObject({ response: '{"rootTopic":"x"}', ttlSeconds: 1800 })
  })
})
