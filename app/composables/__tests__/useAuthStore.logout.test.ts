// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, toRef, ref } from 'vue'

// ---------------------------------------------------------------------------
// useAuthStore.handleSignOut — AER-59 hardened web logout sequence
// ---------------------------------------------------------------------------
//
// Verifies the ordered, best-effort teardown:
//   1. flushBeforeLogout()  (push guest/offline maps)
//   2. POST /api/auth/logout (server-side session revoke)
//   3. clearUserData() + setCurrentUserId(null)
//   4. next-auth signOut()
// …and that every network step is best-effort: a failing flush or logout POST
// must NOT stop local teardown or throw.
// ---------------------------------------------------------------------------

const order: string[] = []

// ── Nuxt auto-import globals used by useAuthStore ────────────────────────────
Object.assign(globalThis, { reactive, toRef, ref })

// next-auth signOut (web path; __TAURI__/Capacitor absent in happy-dom).
const signOut = vi.fn(async () => { order.push('signOut') })
Object.assign(globalThis, { useAuth: () => ({ signIn: vi.fn(), signOut }) })

// $fetch drives the logout POST (and register/etc., unused here).
const fetchMock = vi.fn(async (path: string) => {
  if (path === '/api/auth/logout') { order.push('logout') ; return { ok: true } }
  return {}
})
Object.assign(globalThis, { $fetch: fetchMock })

// useDatabase — assert clearUserData/setCurrentUserId run after the network steps.
const clearUserData = vi.fn(async () => { order.push('clearUserData') })
const setCurrentUserId = vi.fn(async () => { order.push('setCurrentUserId') })
vi.mock('~/composables/useDatabase', () => ({
  useDatabase: () => ({ clearUserData, setCurrentUserId }),
}))

// useSyncEngine.flushBeforeLogout — assert it runs FIRST. Returns `allClean`:
// true ⇒ everything is safely on the server (safe to wipe local data), false ⇒
// keep on-device maps. Defaults to the clean case; individual tests override.
const flushBeforeLogout = vi.fn(async () => { order.push('flush'); return true })
vi.mock('~/composables/useSyncEngine', () => ({
  useSyncEngine: () => ({ flushBeforeLogout }),
}))

const { useAuthStore } = await import('../useAuthStore')

beforeEach(() => {
  order.length = 0
  vi.clearAllMocks()
  // Re-arm the clean default (clearAllMocks wipes the implementation).
  flushBeforeLogout.mockImplementation(async () => { order.push('flush'); return true })
  clearUserData.mockImplementation(async () => { order.push('clearUserData') })
  setCurrentUserId.mockImplementation(async () => { order.push('setCurrentUserId') })
  fetchMock.mockImplementation(async (path: string) => {
    if (path === '/api/auth/logout') { order.push('logout'); return { ok: true } }
    return {}
  })
})

describe('handleSignOut hardened sequence', () => {
  it('clean flush → runs flush → logout POST → clearUserData → signOut in order', async () => {
    const store = useAuthStore()
    await store.handleSignOut()

    // allClean=true ⇒ local data IS wiped.
    expect(order).toEqual(['flush', 'logout', 'clearUserData', 'setCurrentUserId', 'signOut'])
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' })
  })

  it('NOT-clean flush (offline / unsynced) does NOT wipe local data, but still signs out', async () => {
    // allClean=false ⇒ keep the on-device maps (last copy of unsynced edits).
    flushBeforeLogout.mockImplementation(async () => { order.push('flush'); return false })
    const store = useAuthStore()
    await store.handleSignOut()

    expect(clearUserData).not.toHaveBeenCalled()
    // Still detach the current user + sign out regardless.
    expect(setCurrentUserId).toHaveBeenCalledWith(null)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' })
    // The wipe step is absent from the ordered trace.
    expect(order).toEqual(['flush', 'logout', 'setCurrentUserId', 'signOut'])
  })

  it('treats a THROWN flush as NOT clean — keeps local data but still signs out', async () => {
    flushBeforeLogout.mockRejectedValueOnce(new Error('flush boom'))
    const store = useAuthStore()
    await expect(store.handleSignOut()).resolves.toBeUndefined()

    // A flush that throws defaults allClean=false ⇒ do NOT wipe.
    expect(clearUserData).not.toHaveBeenCalled()
    expect(setCurrentUserId).toHaveBeenCalledWith(null)
    expect(signOut).toHaveBeenCalled()
  })

  it('still signs out when the logout POST fails (clean flush ⇒ still wipes)', async () => {
    fetchMock.mockImplementationOnce(async () => { throw new Error('logout 500') })
    const store = useAuthStore()
    await expect(store.handleSignOut()).resolves.toBeUndefined()

    expect(clearUserData).toHaveBeenCalled()
    expect(setCurrentUserId).toHaveBeenCalledWith(null)
    expect(signOut).toHaveBeenCalled()
  })
})
