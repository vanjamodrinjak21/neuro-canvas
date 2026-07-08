// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ref, computed, reactive, watch, toRef, readonly,
  isRef, unref,
} from 'vue'

// ---------------------------------------------------------------------------
// useSyncEngine — AER-59 flushBeforeLogout + AER-60 #2 conflict surfacing
// ---------------------------------------------------------------------------
//
// useSyncEngine is written against Nuxt auto-imports (bare ref/computed/watch/
// reactive + useAuth/useDesktopAuth/useMobileAuth). There is no Nuxt runtime in
// vitest, so we (a) expose Vue's reactivity as globals and (b) mock the
// composable's collaborators. Happy-dom has no __TAURI__/Capacitor globals, so
// syncFetch takes the WEB path and calls the global $fetch — which we stub per
// test to drive push/pull responses (incl. the 409 conflict branch).
// ---------------------------------------------------------------------------

// ── Vue reactivity as Nuxt-style auto-import globals ────────────────────────
Object.assign(globalThis, { ref, computed, reactive, watch, toRef, readonly, isRef, unref })

// ── In-memory DB double ─────────────────────────────────────────────────────
interface FakeMap {
  id: string; title: string; nodes: unknown[]; edges: unknown[]
  syncVersion?: number; checksum?: string; userId?: string; updatedAt: number
}
const dbState = {
  maps: new Map<string, FakeMap>(),
  queue: [] as { id: number; mapId: string; action: string }[],
}
const dbApi = {
  getMap: vi.fn(async (id: string) => dbState.maps.get(id)),
  getAllMaps: vi.fn(async () => Array.from(dbState.maps.values())),
  saveMap: vi.fn(async (m: FakeMap) => { dbState.maps.set(m.id, m) }),
  deleteMap: vi.fn(async (id: string) => { dbState.maps.delete(id) }),
  updateMapSyncVersion: vi.fn(async (id: string, v: number, c: string) => {
    const m = dbState.maps.get(id); if (m) { m.syncVersion = v; m.checksum = c }
  }),
  setCurrentUserId: vi.fn(async () => {}),
  saveSyncMeta: vi.fn(async () => {}),
  getSyncMeta: vi.fn(async () => ({ lastSyncAt: 0 })),
  countPendingSyncOps: vi.fn(async () => dbState.queue.length),
  // Return a SNAPSHOT copy (matches the real IndexedDB adapter, which reads a
  // fresh array). If we returned the live reference, replayQueue would iterate
  // it while pushMap re-queues into the same array — draining it in a way the
  // real DB never does.
  getPendingSyncOps: vi.fn(async () => [...dbState.queue]),
  addToSyncQueue: vi.fn(async (op: { mapId: string; action: string }) => {
    const nextId = dbState.queue.reduce((mx, q) => Math.max(mx, q.id), 0) + 1
    dbState.queue.push({ id: nextId, mapId: op.mapId, action: op.action })
  }),
  updateSyncQueueEntry: vi.fn(async () => {}),
  removeSyncQueueEntry: vi.fn(async (id: number) => {
    dbState.queue = dbState.queue.filter(q => q.id !== id)
  }),
}
vi.mock('~/composables/useDatabase', () => ({ useDatabase: () => dbApi }))
vi.mock('~/composables/useDeviceId', () => ({ useDeviceId: () => ({ deviceId: 'dev-1' }) }))
vi.mock('~/utils/syncChecksum', () => ({ generateChecksum: async () => 'sum' }))
vi.mock('~/stores/mapStore', () => ({ useMapStore: () => ({ id: null, fromSerializable: vi.fn() }) }))

// ── Auth session: a signed-in web user ──────────────────────────────────────
const sessionRef = ref<{ user?: { id?: string } } | null>({ user: { id: 'u-1' } })
Object.assign(globalThis, {
  useAuth: () => ({ data: sessionRef }),
  useDesktopAuth: () => ({ isSignedIn: ref(false), user: ref(null) }),
  useMobileAuth: () => ({ isSignedIn: ref(false), user: ref(null) }),
})

const { useSyncEngine } = await import('../useSyncEngine')

function seedMap(over: Partial<FakeMap> = {}): FakeMap {
  const m: FakeMap = {
    id: 'm1', title: 'Local', nodes: [{}, {}], edges: [],
    syncVersion: 1, checksum: 'c', userId: 'u-1', updatedAt: 1000, ...over,
  }
  dbState.maps.set(m.id, m)
  return m
}

beforeEach(() => {
  dbState.maps.clear()
  dbState.queue = []
  vi.clearAllMocks()
  sessionRef.value = { user: { id: 'u-1' } }
  // Default online in the reactive isOnline seed (navigator.onLine in happy-dom).
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

describe('flushBeforeLogout (AER-59 / AER-60 #3)', () => {
  it('pushes never-synced maps and drains the queue when online + signed in, returns allClean=true', async () => {
    seedMap({ id: 'guest-map', syncVersion: undefined }) // never synced
    const calls: string[] = []
    ;(globalThis as any).$fetch = vi.fn(async (path: string) => {
      calls.push(path)
      if (path === '/api/sync/bulk-push') return { ok: true }
      if (path === '/api/sync/pull') return { maps: [], deleted: [] }
      return { ok: true }
    })

    const engine = useSyncEngine()
    const allClean = await engine.flushBeforeLogout()

    // fullSync bulk-pushed the unsynced guest map, then pulled.
    expect(calls).toContain('/api/sync/bulk-push')
    expect(calls).toContain('/api/sync/pull')
    // Online, empty queue, no conflicts ⇒ safe to wipe local data.
    expect(allClean).toBe(true)
  })

  it('flushes a pending DEBOUNCED push (edit to an already-synced map) before wiping', async () => {
    // An already-synced map with an edit still sitting in a debounce timer.
    // fullSync would SKIP it (it has a syncVersion), so flushBeforeLogout must
    // flush the debounced push explicitly or the edit is lost on clearUserData.
    const map = seedMap({ id: 'synced-map', syncVersion: 3, title: 'Edited but not pushed yet' })
    const pushed: string[] = []
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        pushed.push(opts.body.mapId)
        return { ok: true, syncVersion: (map.syncVersion || 0) + 1 }
      }
      if (path === '/api/sync/pull') return { maps: [], deleted: [] }
      return { ok: true }
    })

    const engine = useSyncEngine()
    // Queue a debounced push — this registers an in-memory timer (pushTimers).
    engine.debouncedPush('synced-map')
    // Do NOT advance timers — the edit is still pending when logout runs.
    const allClean = await engine.flushBeforeLogout()

    // The debounced map's push was flushed (would otherwise never fire).
    expect(pushed).toContain('synced-map')
    expect(allClean).toBe(true)
  })

  it('returns allClean=false (no network) when offline', async () => {
    seedMap({ id: 'guest-map', syncVersion: undefined })
    const fetchMock = vi.fn(async () => ({ ok: true }))
    ;(globalThis as any).$fetch = fetchMock
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const engine = useSyncEngine()
    // isOnline seeds from navigator.onLine at construction → false here.
    const allClean = await engine.flushBeforeLogout()

    expect(fetchMock).not.toHaveBeenCalled()
    // Offline ⇒ data may only exist locally ⇒ NOT safe to wipe.
    expect(allClean).toBe(false)
  })

  it('returns allClean=false when a push fails and leaves an op queued', async () => {
    seedMap({ id: 'guest-map', syncVersion: undefined })
    // Pull succeeds, but every push (bulk + per-map + replay) fails with a
    // generic error → pushMap queues the op for later. A residual queued op is
    // the signal that something never reached the server. (The DB double's
    // countPendingSyncOps reflects the live queue length.)
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/pull') return { maps: [], deleted: [] }
      if (path === '/api/sync/bulk-push' || (path === '/api/sync/push' && opts?.method === 'POST')) {
        throw new Error('push failed')
      }
      return { ok: true }
    })

    const engine = useSyncEngine()
    const allClean = await engine.flushBeforeLogout()

    // A queued op means something isn't on the server yet ⇒ NOT clean.
    expect(await dbApi.countPendingSyncOps()).toBeGreaterThan(0)
    expect(allClean).toBe(false)
  })

  it('is a no-op (returns false) when not signed in', async () => {
    sessionRef.value = null
    const fetchMock = vi.fn(async () => ({ ok: true }))
    ;(globalThis as any).$fetch = fetchMock

    const engine = useSyncEngine()
    const allClean = await engine.flushBeforeLogout()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(allClean).toBe(false)
  })

  it('never throws even if the network fails mid-flush (returns a boolean)', async () => {
    seedMap({ id: 'guest-map', syncVersion: undefined })
    ;(globalThis as any).$fetch = vi.fn(async () => { throw new Error('network down') })

    const engine = useSyncEngine()
    // Resolves to a boolean (does not throw). A failed flush queues the op, so
    // it reports NOT clean.
    await expect(engine.flushBeforeLogout()).resolves.toBe(false)
  })
})

describe('pushMap 401 → op stays queued (AER-100)', () => {
  it('queues the push on 401 so the change survives sign-out', async () => {
    seedMap({ id: 'guest-map', syncVersion: undefined })
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        const err: any = new Error('unauthorized'); err.statusCode = 401; throw err
      }
      return { ok: true }
    })

    const engine = useSyncEngine()
    await engine.pushMap('guest-map')

    // The 401 used to skip the queue entirely ("don't queue, don't retry"),
    // leaving the never-synced map invisible to countPendingSyncOps().
    expect(await dbApi.countPendingSyncOps()).toBeGreaterThan(0)
    expect(dbState.queue.some(q => q.mapId === 'guest-map' && q.action === 'push')).toBe(true)
  })

  it('flushBeforeLogout reports NOT clean when pushes 401 (expired session) — wipe guard', async () => {
    // THE data-loss scenario: desktop session JWT expired, user has a map the
    // server has never seen, and signs out. Every push 401s; before AER-100
    // nothing was queued, allClean came back true, and signOut wiped the only
    // copy of the map.
    seedMap({ id: 'guest-map', syncVersion: undefined })
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/bulk-push' || (path === '/api/sync/push' && opts?.method === 'POST')) {
        const err: any = new Error('unauthorized'); err.statusCode = 401; throw err
      }
      if (path === '/api/sync/pull') return { maps: [], deleted: [] }
      return { ok: true }
    })

    const engine = useSyncEngine()
    const allClean = await engine.flushBeforeLogout()

    // A queued op survives the flush (incl. replayQueue's remove-on-return),
    // so the caller keeps the on-device maps instead of wiping them.
    expect(await dbApi.countPendingSyncOps()).toBeGreaterThan(0)
    expect(allClean).toBe(false)
  })
})

describe('pushMap 409 → observable conflict (AER-60 #2)', () => {
  it('records a SyncConflict instead of silently losing local edits', async () => {
    seedMap({ title: 'My local edit', nodes: [{}, {}, {}] })
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        const err: any = new Error('conflict'); err.statusCode = 409; throw err
      }
      if (path === '/api/sync/pull') {
        return { maps: [{ id: 'm1', title: 'Their edit', data: { nodes: [{}] }, updatedAt: '2020-01-01T00:00:00Z', syncVersion: 5 }], deleted: [] }
      }
      return { ok: true }
    })

    const engine = useSyncEngine()
    await engine.pushMap('m1')

    expect(engine.conflicts.value).toHaveLength(1)
    const c = engine.conflicts.value[0]!
    expect(c.mapId).toBe('m1')
    expect(c.localTitle).toBe('My local edit')
    expect(c.remoteTitle).toBe('Their edit')
    expect(c.localNodeCount).toBe(3)
    expect(c.remoteNodeCount).toBe(1)
  })

  it('does not overwrite the local map when a conflict is recorded', async () => {
    seedMap({ title: 'My local edit' })
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        const err: any = new Error('conflict'); err.statusCode = 409; throw err
      }
      if (path === '/api/sync/pull') {
        return { maps: [{ id: 'm1', title: 'Their edit', data: { nodes: [{}] }, updatedAt: '2020-01-01T00:00:00Z', syncVersion: 5 }], deleted: [] }
      }
      return { ok: true }
    })

    const engine = useSyncEngine()
    await engine.pushMap('m1')

    // Local doc is untouched — the user's title survived the conflict.
    expect(dbState.maps.get('m1')!.title).toBe('My local edit')
  })
})

describe('resolveConflict', () => {
  it('keep-local re-stamps the version above the server, then re-pushes', async () => {
    seedMap({ id: 'm1', syncVersion: 1 })
    // Seed a live conflict first.
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        const err: any = new Error('conflict'); err.statusCode = 409; throw err
      }
      if (path === '/api/sync/pull') {
        return { maps: [{ id: 'm1', title: 'Their', data: { nodes: [{}] }, updatedAt: '2020-01-01T00:00:00Z', syncVersion: 5 }], deleted: [] }
      }
      return { ok: true }
    })
    const engine = useSyncEngine()
    await engine.pushMap('m1')
    expect(engine.conflicts.value).toHaveLength(1)

    // Now resolve keep-local: pull reports server v5, so local is bumped to 5
    // BEFORE the re-push, and the re-push succeeds (version now current).
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/pull') {
        return { maps: [{ id: 'm1', title: 'Their', data: { nodes: [{}] }, updatedAt: '2020-01-01T00:00:00Z', syncVersion: 5 }], deleted: [] }
      }
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        // Local now carries v5 → server accepts and returns v6.
        expect(opts.body.syncVersion).toBe(5)
        return { ok: true, syncVersion: 6 }
      }
      return { ok: true }
    })

    await engine.resolveConflict('m1', 'local')

    expect(engine.conflicts.value).toHaveLength(0)
    expect(dbState.maps.get('m1')!.syncVersion).toBe(6)
  })

  it('keep-remote pulls the server snapshot and clears the conflict', async () => {
    seedMap({ id: 'm1', title: 'Local', syncVersion: 1 })
    ;(globalThis as any).$fetch = vi.fn(async (path: string, opts?: any) => {
      if (path === '/api/sync/push' && opts?.method === 'POST') {
        const err: any = new Error('conflict'); err.statusCode = 409; throw err
      }
      if (path === '/api/sync/pull') {
        return { maps: [{ id: 'm1', title: 'Server wins', data: { nodes: [{}] }, createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-02T00:00:00Z', syncVersion: 9 }], deleted: [] }
      }
      return { ok: true }
    })
    const engine = useSyncEngine()
    await engine.pushMap('m1')
    expect(engine.conflicts.value).toHaveLength(1)

    await engine.resolveConflict('m1', 'remote')

    expect(engine.conflicts.value).toHaveLength(0)
    // Local map overwritten by the higher-version server snapshot.
    expect(dbState.maps.get('m1')!.title).toBe('Server wins')
    expect(dbState.maps.get('m1')!.syncVersion).toBe(9)
  })
})
