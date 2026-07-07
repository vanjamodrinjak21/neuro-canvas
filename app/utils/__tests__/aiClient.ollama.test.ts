// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// aiClient — desktop (Tauri) Ollama behaviour (AER-96)
//
//  • per-baseUrl auto-detect cache: two baseUrls never cross-contaminate, and
//    a 404 clears ONLY the offending baseUrl's entry.
//  • req.model passthrough: an explicit user-selected model is sent verbatim
//    and auto-detect (/api/tags) is NOT called.
// ---------------------------------------------------------------------------

// The Tauri plugin-http fetch is dynamically imported by getTauriFetch(). We
// mock it and route it to a per-test programmable handler so we can assert on
// exactly which URLs/bodies were hit.
let fetchHandler: (url: string, init?: any) => Promise<any>
const pluginFetch = vi.fn((url: string, init?: any) => fetchHandler(url, init))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: (url: string, init?: any) => pluginFetch(url, init) }))

function jsonRes(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  }
}

function tagsRes(models: string[]) {
  return jsonRes(200, { models: models.map(name => ({ name })) })
}

function chatRes(content: string) {
  return jsonRes(200, { message: { role: 'assistant', content } })
}

const { aiComplete } = await import('../aiClient')

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).__TAURI__ = {}
  fetchHandler = async () => { throw new Error('unexpected fetch') }
})

afterEach(() => {
  delete (window as any).__TAURI__
})

const baseReq = {
  provider: 'ollama',
  messages: [{ role: 'user', content: 'hi' }]
}

describe('aiClient — Ollama req.model passthrough (AER-96)', () => {
  it('sends the passed model verbatim and does NOT auto-detect via /api/tags', async () => {
    const bodies: any[] = []
    fetchHandler = async (url, init) => {
      if (url.endsWith('/api/tags')) throw new Error('/api/tags must not be called when a model is provided')
      if (url.endsWith('/api/chat')) {
        bodies.push(JSON.parse(init.body))
        return chatRes('pong')
      }
      throw new Error(`unexpected ${url}`)
    }

    const res = await aiComplete({ ...baseReq, model: 'mistral:7b' })

    expect(res.content).toBe('pong')
    expect(bodies).toHaveLength(1)
    expect(bodies[0].model).toBe('mistral:7b')
    // /api/tags was never requested
    expect(pluginFetch.mock.calls.some(c => String(c[0]).endsWith('/api/tags'))).toBe(false)
  })

  it('auto-detects the first installed model when NO model is passed', async () => {
    const bodies: any[] = []
    fetchHandler = async (url, init) => {
      if (url.endsWith('/api/tags')) return tagsRes(['llama3.2:latest', 'qwen2.5'])
      if (url.endsWith('/api/chat')) {
        bodies.push(JSON.parse(init.body))
        return chatRes('detected')
      }
      throw new Error(`unexpected ${url}`)
    }

    const res = await aiComplete({ ...baseReq })

    expect(res.content).toBe('detected')
    expect(bodies[0].model).toBe('llama3.2:latest')
  })
})

describe('aiClient — per-baseUrl Ollama model cache (AER-96)', () => {
  it('does not cross-contaminate the auto-detect cache between two baseUrls', async () => {
    const chatModels: string[] = []
    fetchHandler = async (url, init) => {
      if (url.startsWith('http://a:11434')) {
        if (url.endsWith('/api/tags')) return tagsRes(['model-A'])
        if (url.endsWith('/api/chat')) { chatModels.push(JSON.parse(init.body).model); return chatRes('a') }
      }
      if (url.startsWith('http://b:11434')) {
        if (url.endsWith('/api/tags')) return tagsRes(['model-B'])
        if (url.endsWith('/api/chat')) { chatModels.push(JSON.parse(init.body).model); return chatRes('b') }
      }
      throw new Error(`unexpected ${url}`)
    }

    await aiComplete({ ...baseReq, baseUrl: 'http://a:11434' })
    await aiComplete({ ...baseReq, baseUrl: 'http://b:11434' })

    // Each baseUrl auto-detected its OWN first model — no stale carry-over.
    expect(chatModels).toEqual(['model-A', 'model-B'])
  })

  it('on 404 clears only that baseUrl entry, re-detects, and retries once', async () => {
    let aTagsCalls = 0
    let aChatCalls = 0
    fetchHandler = async (url) => {
      if (url.startsWith('http://a:11434')) {
        if (url.endsWith('/api/tags')) { aTagsCalls++; return tagsRes(['fresh-A']) }
        if (url.endsWith('/api/chat')) {
          aChatCalls++
          // First chat attempt 404s (stale/uninstalled), retry succeeds.
          return aChatCalls === 1 ? jsonRes(404, 'model not found') : chatRes('recovered')
        }
      }
      throw new Error(`unexpected ${url}`)
    }

    const res = await aiComplete({ ...baseReq, baseUrl: 'http://a:11434', model: 'gone:latest' })

    expect(res.content).toBe('recovered')
    // 404 fallback auto-detected a fresh model even though a model was passed.
    expect(aTagsCalls).toBe(1)
    expect(aChatCalls).toBe(2)
  })
})
