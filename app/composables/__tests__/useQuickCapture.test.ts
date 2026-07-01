// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed, reactive, watch, toRef, readonly, isRef, unref } from 'vue'

// ---------------------------------------------------------------------------
// useQuickCapture — AER-70 mobile quick-capture to the Inbox map.
// ---------------------------------------------------------------------------
//
// The composable is written against Nuxt auto-imports; vitest has no Nuxt
// runtime, so we (a) expose Vue reactivity as globals and (b) mock its two
// collaborators (useDatabase / useSyncEngine). The DB double is an in-memory
// map store scoped to a fake current user — enough to exercise find-or-create
// idempotency and the node-append persistence path.
// ---------------------------------------------------------------------------

Object.assign(globalThis, { ref, computed, reactive, watch, toRef, readonly, isRef, unref })

interface FakeMap {
  id: string
  title: string
  nodes: Array<{ id: string; content: string; isRoot?: boolean; type: string; metadata?: Record<string, unknown> }>
  edges: unknown[]
  tags: string[]
  createdAt: number
  updatedAt: number
  rootNodeId?: string
  userId?: string
}

const dbState = { maps: new Map<string, FakeMap>(), currentUserId: 'u-1' as string | null }

const dbApi = {
  getAllMaps: vi.fn(async () =>
    Array.from(dbState.maps.values()).filter(
      m => !dbState.currentUserId || !m.userId || m.userId === dbState.currentUserId,
    ),
  ),
  getMap: vi.fn(async (id: string) => dbState.maps.get(id)),
  saveMap: vi.fn(async (m: FakeMap) => {
    if (dbState.currentUserId && !m.userId) m.userId = dbState.currentUserId
    dbState.maps.set(m.id, m)
  }),
  getCurrentUserId: vi.fn(() => dbState.currentUserId),
}

const debouncedPush = vi.fn()
const syncApi = { debouncedPush }

vi.mock('~/composables/useDatabase', () => ({ useDatabase: () => dbApi }))
vi.mock('~/composables/useSyncEngine', () => ({ useSyncEngine: () => syncApi }))

const {
  useQuickCapture,
  parseCaptureUrl,
  buildCaptureContent,
  looksLikeUrl,
  INBOX_TAG,
} = await import('../useQuickCapture')

beforeEach(() => {
  dbState.maps.clear()
  dbState.currentUserId = 'u-1'
  vi.clearAllMocks()
})

// ── Pure helper: parseCaptureUrl ────────────────────────────────────────────
describe('parseCaptureUrl', () => {
  it('parses neurocanvas://capture?text=&url=', () => {
    const p = parseCaptureUrl('neurocanvas://capture?text=hello%20world&url=https%3A%2F%2Fx.com%2Fa')
    expect(p).toEqual({ text: 'hello world', url: 'https://x.com/a' })
  })

  it('parses text-only', () => {
    expect(parseCaptureUrl('neurocanvas://capture?text=just%20a%20note')).toEqual({
      text: 'just a note',
      url: undefined,
    })
  })

  it('parses url-only', () => {
    expect(parseCaptureUrl('neurocanvas://capture?url=https%3A%2F%2Fa.dev')).toEqual({
      text: undefined,
      url: 'https://a.dev',
    })
  })

  it('accepts the path form neurocanvas:///capture', () => {
    expect(parseCaptureUrl('neurocanvas:///capture?text=hi')).toEqual({ text: 'hi', url: undefined })
  })

  it('returns null for the auth callback (not a capture link)', () => {
    expect(parseCaptureUrl('neurocanvas://auth/callback?session=abc')).toBeNull()
  })

  it('returns null for a foreign scheme', () => {
    expect(parseCaptureUrl('https://neuro-canvas.com/capture?text=hi')).toBeNull()
  })

  it('returns null when capture has neither text nor url', () => {
    expect(parseCaptureUrl('neurocanvas://capture')).toBeNull()
  })

  it('returns null for a non-URL string', () => {
    expect(parseCaptureUrl('not a url')).toBeNull()
  })
})

// ── Pure helper: looksLikeUrl / buildCaptureContent ─────────────────────────
describe('looksLikeUrl', () => {
  it('recognises http(s) URLs only', () => {
    expect(looksLikeUrl('https://example.com')).toBe(true)
    expect(looksLikeUrl('http://example.com/x')).toBe(true)
    expect(looksLikeUrl('  https://trimmed.com  ')).toBe(true)
    expect(looksLikeUrl('example.com')).toBe(false)
    expect(looksLikeUrl('call mom')).toBe(false)
    expect(looksLikeUrl('ftp://x.com')).toBe(false)
    expect(looksLikeUrl('')).toBe(false)
  })
})

describe('buildCaptureContent', () => {
  it('renders text verbatim', () => {
    expect(buildCaptureContent({ text: 'a thought' })).toBe('a thought')
  })
  it('renders a bare URL', () => {
    expect(buildCaptureContent({ url: 'https://x.com' })).toBe('https://x.com')
  })
  it('renders a Markdown link when text + url are both present', () => {
    expect(buildCaptureContent({ text: 'Docs', url: 'https://x.com' })).toBe('[Docs](https://x.com)')
  })
})

// ── findOrCreateInbox idempotency ───────────────────────────────────────────
describe('findOrCreateInbox', () => {
  it('creates the Inbox once and reuses it on subsequent calls', async () => {
    const qc = useQuickCapture()

    const a = await qc.findOrCreateInbox()
    expect(a.tags).toContain(INBOX_TAG)
    expect(a.title).toBe('Inbox')
    expect(dbState.maps.size).toBe(1)
    expect(dbApi.saveMap).toHaveBeenCalledTimes(1)
    expect(debouncedPush).toHaveBeenCalledWith(a.id)

    const b = await qc.findOrCreateInbox()
    expect(b.id).toBe(a.id)
    // No second map, no second create-save.
    expect(dbState.maps.size).toBe(1)
    expect(dbApi.saveMap).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate an inbox that already exists in the DB', async () => {
    dbState.maps.set('pre', {
      id: 'pre',
      title: 'Inbox',
      nodes: [],
      edges: [],
      tags: [INBOX_TAG],
      createdAt: 1000,
      updatedAt: 1000,
      userId: 'u-1',
    })
    const qc = useQuickCapture()
    const inbox = await qc.findOrCreateInbox()
    expect(inbox.id).toBe('pre')
    expect(dbApi.saveMap).not.toHaveBeenCalled()
  })

  it('picks the oldest inbox deterministically when duplicates exist', async () => {
    dbState.maps.set('new', { id: 'new', title: 'Inbox', nodes: [], edges: [], tags: [INBOX_TAG], createdAt: 2000, updatedAt: 2000, userId: 'u-1' })
    dbState.maps.set('old', { id: 'old', title: 'Inbox', nodes: [], edges: [], tags: [INBOX_TAG], createdAt: 1000, updatedAt: 1000, userId: 'u-1' })
    const qc = useQuickCapture()
    const inbox = await qc.findOrCreateInbox()
    expect(inbox.id).toBe('old')
  })

  it('scopes the inbox to the current user', async () => {
    const qc = useQuickCapture()
    const inbox = await qc.findOrCreateInbox()
    expect(inbox.userId).toBe('u-1')
  })
})

// ── captureToInbox: text vs URL ─────────────────────────────────────────────
describe('captureToInbox', () => {
  it('captures a plain-text note as a text node (root when first)', async () => {
    const qc = useQuickCapture()
    const res = await qc.captureToInbox({ text: 'buy milk' })

    const inbox = dbState.maps.get(res.mapId)!
    expect(inbox.nodes).toHaveLength(1)
    const node = inbox.nodes[0]!
    expect(node.id).toBe(res.nodeId)
    expect(node.content).toBe('buy milk')
    expect(node.type).toBe('text')
    expect(node.isRoot).toBe(true)
    expect(inbox.rootNodeId).toBe(node.id)
    expect(node.metadata?.source).toBe('quick-capture')
    // Persisted through the normal path.
    expect(dbApi.saveMap).toHaveBeenCalled()
    expect(debouncedPush).toHaveBeenLastCalledWith(res.mapId)
  })

  it('captures a URL and records it in metadata', async () => {
    const qc = useQuickCapture()
    const res = await qc.captureToInbox({ url: 'https://example.com/read' })
    const node = dbState.maps.get(res.mapId)!.nodes[0]!
    expect(node.content).toBe('https://example.com/read')
    expect(node.metadata?.capturedUrl).toBe('https://example.com/read')
  })

  it('captures a labelled URL as a Markdown link', async () => {
    const qc = useQuickCapture()
    const res = await qc.captureToInbox({ text: 'Vue docs', url: 'https://vuejs.org' })
    const node = dbState.maps.get(res.mapId)!.nodes[0]!
    expect(node.content).toBe('[Vue docs](https://vuejs.org)')
  })

  it('appends multiple captures to the SAME inbox and only the first is root', async () => {
    const qc = useQuickCapture()
    const r1 = await qc.captureToInbox({ text: 'first' })
    const r2 = await qc.captureToInbox({ text: 'second' })

    expect(r1.mapId).toBe(r2.mapId)
    const inbox = dbState.maps.get(r1.mapId)!
    expect(inbox.nodes).toHaveLength(2)
    expect(inbox.nodes[0]!.isRoot).toBe(true)
    expect(inbox.nodes[1]!.isRoot).toBe(false)
    // Second node is stacked below the first.
    // (positions come from measureNodeSize; assert only ordering invariants.)
    expect(dbState.maps.size).toBe(1)
  })

  it('throws when there is nothing to capture', async () => {
    const qc = useQuickCapture()
    await expect(qc.captureToInbox({})).rejects.toThrow(/nothing to capture/i)
    await expect(qc.captureToInbox({ text: '   ' })).rejects.toThrow()
  })
})

// ── open/close UI state (module-scoped, shared) ─────────────────────────────
describe('open/close state', () => {
  it('open() sets prefill and isOpen; close() clears them', () => {
    const qc = useQuickCapture()
    qc.open({ text: 'note', url: 'https://x.com' })
    expect(qc.isOpen.value).toBe(true)
    expect(qc.prefill.value).toEqual({ text: 'note', url: 'https://x.com' })
    expect(qc.canSubmit.value).toBe(true)

    qc.close()
    expect(qc.isOpen.value).toBe(false)
    expect(qc.prefill.value).toEqual({})
    expect(qc.canSubmit.value).toBe(false)
  })

  it('shares state across composable instances (module singleton)', () => {
    const a = useQuickCapture()
    const b = useQuickCapture()
    a.open({ text: 'shared' })
    expect(b.isOpen.value).toBe(true)
    expect(b.prefill.value.text).toBe('shared')
    b.close()
    expect(a.isOpen.value).toBe(false)
  })
})
