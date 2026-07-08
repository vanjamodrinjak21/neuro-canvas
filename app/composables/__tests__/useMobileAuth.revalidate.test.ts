// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed, reactive, watch, readonly } from 'vue'

// ---------------------------------------------------------------------------
// useMobileAuth — revalidateSession session persistence (AER-102)
// ---------------------------------------------------------------------------
//
// revalidateSession used to (a) call /api/auth/session WITHOUT the persisted
// JWT — relying on CapacitorHttp's cookie jar, which is unreliable on iOS —
// so valid sessions were reported signed-out and wiped, and (b) rewrite the
// stored session WITHOUT token/cookieName on success, de-authenticating every
// later remoteFetch. Mobile login therefore didn't survive an app restart.
//
// useMobileAuth runs its init (restore + background revalidation) on the
// FIRST call per module instance, so each test re-imports the module fresh
// (vi.resetModules) with a Capacitor-native window and a stubbed
// CapacitorHttp.
// ---------------------------------------------------------------------------

Object.assign(globalThis, { ref, computed, reactive, watch, readonly })

const http = {
  get: vi.fn(),
  request: vi.fn(),
}
vi.mock('@capacitor/core', () => ({ CapacitorHttp: http, Browser: {} }))

const STORAGE_KEY = 'nc-mobile-session'

function seedStoredSession(over: Record<string, unknown> = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    origin: 'https://neuro-canvas.com',
    authenticatedAt: 123,
    user: { id: 'u-1', name: 'Vanja', email: 'v@x.com' },
    token: 'jwt-abc',
    cookieName: '__Secure-next-auth.session-token',
    ...over,
  }))
}

async function importFresh() {
  vi.resetModules()
  const mod = await import('../useMobileAuth')
  return mod.useMobileAuth()
}

/** The background revalidation is fire-and-forget — let its promises settle. */
async function settle() {
  for (let i = 0; i < 6; i++) await Promise.resolve()
  await new Promise(r => setTimeout(r, 0))
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  ;(window as any).Capacitor = { isNativePlatform: () => true }
})

describe('revalidateSession (AER-102)', () => {
  it('attaches the persisted JWT as an explicit Cookie header', async () => {
    seedStoredSession()
    http.get.mockResolvedValue({ status: 200, data: { user: { id: 'u-1', name: 'Vanja', email: 'v@x.com' } } })

    await importFresh()
    await settle()

    expect(http.get).toHaveBeenCalledTimes(1)
    const call = http.get.mock.calls[0]![0]
    expect(call.url).toContain('/api/auth/session')
    expect(call.headers?.Cookie).toBe('__Secure-next-auth.session-token=jwt-abc')
  })

  it('preserves token/cookieName in storage after a successful revalidation', async () => {
    seedStoredSession()
    http.get.mockResolvedValue({ status: 200, data: { user: { id: 'u-1', name: 'Novi Vanja', email: 'v@x.com' } } })

    const auth = await importFresh()
    await settle()

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    // The refreshed user lands…
    expect(stored.user.name).toBe('Novi Vanja')
    expect(auth.user.value?.name).toBe('Novi Vanja')
    // …and the JWT survives — losing it de-authenticated every remoteFetch.
    expect(stored.token).toBe('jwt-abc')
    expect(stored.cookieName).toBe('__Secure-next-auth.session-token')
    expect(auth.isSignedIn.value).toBe(true)
  })

  it('keeps the cached session when there is no token to attach (inconclusive check)', async () => {
    // Cookie-jar-mode session (no persisted token): an empty server session
    // proves nothing, so the local session must survive.
    seedStoredSession({ token: '', cookieName: '' })
    http.get.mockResolvedValue({ status: 200, data: {} })

    const auth = await importFresh()
    await settle()

    expect(auth.isSignedIn.value).toBe(true)
    expect(auth.user.value?.email).toBe('v@x.com')
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('clears the session when the server rejects an explicitly attached token', async () => {
    seedStoredSession()
    http.get.mockResolvedValue({ status: 200, data: {} }) // signed out despite Cookie

    const auth = await importFresh()
    await settle()

    expect(auth.isSignedIn.value).toBe(false)
    expect(auth.user.value).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('keeps the cached session on network failure', async () => {
    seedStoredSession()
    http.get.mockRejectedValue(new Error('offline'))

    const auth = await importFresh()
    await settle()

    expect(auth.isSignedIn.value).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })
})
