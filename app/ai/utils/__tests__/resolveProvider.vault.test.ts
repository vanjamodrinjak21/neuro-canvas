// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, computed } from 'vue'

// ---------------------------------------------------------------------------
// resolveProvider — AER-61 NATIVE read-through at inference
// ---------------------------------------------------------------------------
//
// On native (Tauri / Capacitor), when online + signed-in, resolveProvider now
// PREFERS a fresh reveal of the provider's own vault key so a key rotated on
// another device is picked up — falling back to the local (offline) cache when
// offline, signed-out, on a `local-` placeholder, or when the reveal fails.
// These tests verify BOTH the fresh path and that airplane-mode never regresses.
// ---------------------------------------------------------------------------

// ── useAISettings double — a controllable default provider ──────────────────
const providersRef = ref<any[]>([])
const defaultProviderRef = ref<any>(null)
const initialize = vi.fn(async () => {})
const seedReviewKey = vi.fn(async () => {})
const syncVaultOnInit = vi.fn(async () => {})
vi.mock('~/composables/useAISettings', () => ({
  useAISettings: () => ({
    isInitialized: ref(true),
    providers: providersRef,
    defaultProvider: defaultProviderRef,
    initialize, seedReviewKey, syncVaultOnInit,
  }),
}))

// ── useGuestMode double — a signed-in (non-guest) user by default ───────────
const isGuest = ref(false)
vi.mock('~/composables/useGuestMode', () => ({
  useGuestMode: () => ({ isGuest: computed(() => isGuest.value) }),
}))

// ── readKey double — reverses the "wrapped:" scheme, plaintext passes through ─
vi.mock('~/utils/secureKeyStore', () => ({
  readKey: vi.fn(async (v: string | null | undefined) => {
    if (!v) return null
    return v.startsWith('wrapped:') ? v.slice('wrapped:'.length) : v
  }),
}))

// ── Native auth double — programmable reveal + signed-in flag ───────────────
let signedIn = ref(true)
let revealImpl: (path: string) => any
const remoteFetch = vi.fn(async (path: string) => revealImpl(path))
const authObj = () => ({ isSignedIn: signedIn, user: ref({ id: 'u-1' }), remoteFetch })
Object.assign(globalThis, {
  useDesktopAuth: () => authObj(),
  useMobileAuth: () => authObj(),
})

function setPlatform(p: 'web' | 'tauri' | 'capacitor') {
  delete (window as any).__TAURI__
  delete (window as any).Capacitor
  if (p === 'tauri') (window as any).__TAURI__ = {}
  if (p === 'capacitor') (window as any).Capacitor = { isNativePlatform: () => true }
}

function setProvider(over: Partial<any> = {}) {
  const p = {
    id: 'prov-1', type: 'anthropic', name: 'Anthropic',
    isEnabled: true, isDefault: true,
    localApiKey: 'wrapped:sk-local', credentialId: 'vault-row-1',
    selectedModelId: 'claude-x', ...over,
  }
  defaultProviderRef.value = p
  providersRef.value = [p]
  return p
}

const { resolveProvider } = await import('../resolveProvider')

beforeEach(() => {
  vi.clearAllMocks()
  signedIn = ref(true)
  isGuest.value = false
  revealImpl = () => { throw new Error('Remote fetch failed: 404') }
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => setPlatform('web'))

describe('resolveProvider — native read-through (AER-61)', () => {
  it('PREFERS the freshly revealed vault key over the local cache when online + signed-in', async () => {
    setPlatform('tauri')
    setProvider({ localApiKey: 'wrapped:sk-STALE', credentialId: 'vault-row-1' })
    revealImpl = (path) => {
      if (path === '/api/vault/credentials/vault-row-1/reveal') return { provider: 'anthropic', apiKey: 'sk-ROTATED' }
      throw new Error('Remote fetch failed: 404')
    }

    const resolved = await resolveProvider()

    // The rotated (remote) key wins over the stale local cache.
    expect(resolved.apiKey).toBe('sk-ROTATED')
    expect(remoteFetch).toHaveBeenCalledWith('/api/vault/credentials/vault-row-1/reveal', { method: 'GET' })
  })

  it('FALLS BACK to the local cache when OFFLINE (airplane mode never regresses)', async () => {
    setPlatform('tauri')
    setProvider({ localApiKey: 'wrapped:sk-local', credentialId: 'vault-row-1' })
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const resolved = await resolveProvider()

    // Offline → no reveal attempted, local cache unwrapped and used.
    expect(remoteFetch).not.toHaveBeenCalled()
    expect(resolved.apiKey).toBe('sk-local')
  })

  it('FALLS BACK to the local cache when the reveal FAILS (404 / rotated away)', async () => {
    setPlatform('capacitor')
    setProvider({ localApiKey: 'wrapped:sk-local', credentialId: 'vault-row-1' })
    revealImpl = () => { throw new Error('Remote fetch failed: 404') }

    const resolved = await resolveProvider()

    expect(remoteFetch).toHaveBeenCalled()
    expect(resolved.apiKey).toBe('sk-local')
  })

  it('does NOT reveal for a `local-` placeholder credentialId (uses local cache)', async () => {
    setPlatform('tauri')
    setProvider({ localApiKey: 'wrapped:sk-local', credentialId: 'local-prov-1' })

    const resolved = await resolveProvider()

    expect(remoteFetch).not.toHaveBeenCalled()
    expect(resolved.apiKey).toBe('sk-local')
  })

  it('lets a fresh device with a vault row but NO local cache still resolve via reveal', async () => {
    setPlatform('tauri')
    setProvider({ localApiKey: undefined, credentialId: 'vault-row-1' })
    revealImpl = () => ({ provider: 'anthropic', apiKey: 'sk-fresh' })

    const resolved = await resolveProvider()

    // No local key, but the vault reveal succeeds → generation is possible.
    expect(resolved.apiKey).toBe('sk-fresh')
  })

  it('signed-out native user makes NO reveal call, uses local cache only', async () => {
    setPlatform('tauri')
    signedIn = ref(false)
    setProvider({ localApiKey: 'wrapped:sk-local', credentialId: 'vault-row-1' })

    const resolved = await resolveProvider()

    expect(remoteFetch).not.toHaveBeenCalled()
    expect(resolved.apiKey).toBe('sk-local')
  })

  it('web path is unaffected — returns credentialId, no native reveal', async () => {
    setPlatform('web')
    setProvider({ localApiKey: undefined, credentialId: 'vault-row-1' })

    const resolved = await resolveProvider()

    expect(remoteFetch).not.toHaveBeenCalled()
    expect(resolved.credentialId).toBe('vault-row-1')
    expect(resolved.apiKey).toBeUndefined()
  })
})
