// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, computed, reactive, watch, toRef, readonly, isRef, unref } from 'vue'

// ---------------------------------------------------------------------------
// useAISettings — AER-61 NATIVE vault integration (client half)
// ---------------------------------------------------------------------------
//
// Covers the four native behaviours added for account-linked, cross-device BYOK
// keys, WITHOUT touching the web flow:
//   1. write-through on add   — addProvider mirrors the raw key to the vault and
//                               replaces the `local-<id>` placeholder with the
//                               real vault id (local wrap kept as offline cache)
//   2. on-login pull          — syncVaultOnInit reveals account keys onto a
//                               FRESH device and caches them locally (wrapped)
//   3. one-time migration     — a local-only key (credentialId doesn't resolve
//                               to a vault row) is pushed up, once, no clobber
//   4. no-clobber guard       — a key the user already has on-device is NOT
//                               overwritten by a pulled/stale one
//
// useAISettings is written against Nuxt auto-imports (bare ref/computed/reactive
// + useDesktopAuth/useMobileAuth). There is no Nuxt runtime in vitest, so we
// (a) expose Vue reactivity as globals, (b) mock the composable's collaborators,
// and (c) flip window.__TAURI__ / window.Capacitor to drive the native branch.
// Module-scoped singleton state + one-shot guards mean each test re-imports the
// module fresh via vi.resetModules() + a re-registered mock set.
// ---------------------------------------------------------------------------

Object.assign(globalThis, { ref, computed, reactive, watch, toRef, readonly, isRef, unref })

// ── In-memory AI settings DB double ─────────────────────────────────────────
interface StoredSettings { providers: any[]; personas: any[]; defaultProviderId?: string; defaultPersonaId?: string; preferences: any; updatedAt: number }
let dbSettings: StoredSettings
const saveAISettings = vi.fn(async (s: StoredSettings) => { dbSettings = JSON.parse(JSON.stringify(s)) })
const getAISettings = vi.fn(async () => JSON.parse(JSON.stringify(dbSettings)))

// ── secureKeyStore doubles — wrap/read are reversible & inspectable ─────────
// wrapKey => "wrapped:<plain>"; readKey reverses it; plaintext passes through.
const wrapKey = vi.fn(async (p: string) => `wrapped:${p}`)
const readKey = vi.fn(async (v: string | null | undefined) => {
  if (!v) return null
  return v.startsWith('wrapped:') ? v.slice('wrapped:'.length) : v
})

// ── Native auth double — signed-in, records every remoteFetch call ──────────
interface FetchCall { path: string; options?: any }
const fetchCalls: FetchCall[] = []
// A programmable router: tests set `respond` to map path+method → response (or
// throw). Defaults to empty list + benign POST ok.
let respond: (path: string, options?: any) => any
const remoteFetch = vi.fn(async (path: string, options?: any) => {
  fetchCalls.push({ path, options })
  return respond(path, options)
})
let signedIn = ref(true)
const desktopAuth = () => ({ isSignedIn: signedIn, user: ref({ id: 'u-1' }), remoteFetch })
const mobileAuth = () => ({ isSignedIn: signedIn, user: ref({ id: 'u-1' }), remoteFetch })

Object.assign(globalThis, {
  useDesktopAuth: () => desktopAuth(),
  useMobileAuth: () => mobileAuth(),
  useAuth: () => ({ data: ref({ user: { id: 'u-1' } }) }),
})

function defaultSettings(providers: any[] = []): StoredSettings {
  return {
    providers,
    personas: [{ id: 'p-1', name: 'Default', systemPrompt: '', temperature: 0.7, maxTokens: 1000, isDefault: true, createdAt: 1, updatedAt: 1 }],
    defaultPersonaId: 'p-1',
    preferences: { autoSuggestConnections: true, semanticFieldEnabled: false, similarityThreshold: 0.5 },
    updatedAt: 1,
  }
}

// The native fetch adapter sends the body differently per shell: Tauri uses
// RequestInit → `options.body` is a JSON STRING; Capacitor uses
// `options.data` → an OBJECT. Normalise so assertions are transport-agnostic.
function bodyOf(call: FetchCall | undefined): any {
  if (!call?.options) return undefined
  const { body, data } = call.options
  if (typeof body === 'string') { try { return JSON.parse(body) } catch { return undefined } }
  if (body !== undefined) return body
  return data
}

function makeProvider(over: Partial<any> = {}): any {
  return {
    id: 'prov-anthropic-1', type: 'anthropic', name: 'Anthropic',
    models: [{ id: 'claude-x', name: 'Claude X' }], selectedModelId: 'claude-x',
    isEnabled: true, isDefault: true, createdAt: 1, updatedAt: 1, ...over,
  }
}

function setPlatform(p: 'web' | 'tauri' | 'capacitor') {
  delete (window as any).__TAURI__
  delete (window as any).__TAURI_INTERNALS__
  delete (window as any).Capacitor
  if (p === 'tauri') (window as any).__TAURI__ = {}
  if (p === 'capacitor') (window as any).Capacitor = { isNativePlatform: () => true }
}

// Fresh module instance per test so the singleton `state` + one-shot vault-sync
// guard start clean. Mocks are re-registered because resetModules clears them.
async function freshComposable() {
  vi.resetModules()
  vi.doMock('~/composables/useDatabase', () => ({ useDatabase: () => ({ getAISettings, saveAISettings }) }))
  vi.doMock('~/composables/useCredentialVault', () => ({ useCredentialVault: () => ({ isVaultAvailable: ref(false) }) }))
  vi.doMock('~/utils/aiClient', () => ({ aiTestConnection: vi.fn() }))
  vi.doMock('~/utils/secureKeyStore', () => ({ wrapKey, readKey, isWrapped: (v: string) => !!v && v.startsWith('wrapped:') }))
  const mod = await import('../useAISettings')
  return mod.useAISettings()
}

beforeEach(() => {
  fetchCalls.length = 0
  vi.clearAllMocks()
  signedIn = ref(true)
  respond = () => ({ credentials: [] })
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  setPlatform('web')
})

// ─── 1. Write-through on add ────────────────────────────────────────────────
describe('addProvider — native write-through (AER-61)', () => {
  it('writes the raw key to the vault and replaces the local-<id> placeholder with the vault id', async () => {
    setPlatform('tauri')
    dbSettings = defaultSettings([])
    respond = (path, opts) => {
      if (path === '/api/vault/credentials' && opts?.method === 'POST') {
        return { ok: true, credential: { id: 'vault-row-1' } }
      }
      return { credentials: [] }
    }

    const ai = await freshComposable()
    const provider = await ai.addProvider('anthropic', undefined, 'sk-ant-secret')

    // Local offline cache is written (wrapped), key never stored plaintext.
    expect(provider.localApiKey).toBe('wrapped:sk-ant-secret')
    // credentialId is the REAL vault id, not the local- placeholder.
    expect(provider.credentialId).toBe('vault-row-1')

    // The POST carried the raw key + a provider-scoped (stable) label.
    const post = fetchCalls.find(c => c.path === '/api/vault/credentials' && (c.options?.method === 'POST'))
    expect(post).toBeTruthy()
    const body = bodyOf(post)
    expect(body.rawValue).toBe('sk-ant-secret')
    expect(body.provider).toBe('anthropic')
    expect(body.label).toBe('nc-native:anthropic')
  })

  it('keeps the local key and the placeholder when the vault POST fails (offline-safe, no key loss)', async () => {
    setPlatform('capacitor')
    dbSettings = defaultSettings([])
    respond = (path, opts) => {
      if (path === '/api/vault/credentials' && opts?.method === 'POST') throw new Error('Remote fetch failed: 500')
      return { credentials: [] }
    }

    const ai = await freshComposable()
    const provider = await ai.addProvider('anthropic', undefined, 'sk-ant-secret')

    // Key survives locally; placeholder left so the migration pass retries later.
    expect(provider.localApiKey).toBe('wrapped:sk-ant-secret')
    expect(provider.credentialId).toBe(`local-${provider.id}`)
  })

  it('makes NO vault call for a signed-out native user (pure local behaviour)', async () => {
    setPlatform('tauri')
    signedIn = ref(false)
    dbSettings = defaultSettings([])

    const ai = await freshComposable()
    const provider = await ai.addProvider('anthropic', undefined, 'sk-ant-secret')

    expect(provider.localApiKey).toBe('wrapped:sk-ant-secret')
    expect(provider.credentialId).toBe(`local-${provider.id}`)
    expect(fetchCalls.filter(c => c.path === '/api/vault/credentials')).toHaveLength(0)
  })
})

// ─── 2. On-login pull (fresh device) ────────────────────────────────────────
describe('initialize — on-login pull lights up a fresh device (AER-61)', () => {
  it('reveals an account key and caches it locally (wrapped) on a device with no local key', async () => {
    setPlatform('tauri')
    // Fresh device: an anthropic provider exists but has NO local key yet.
    dbSettings = defaultSettings([makeProvider({ localApiKey: undefined, credentialId: undefined })])
    respond = (path) => {
      if (path === '/api/vault/credentials') return { credentials: [{ id: 'vault-row-1', provider: 'anthropic', label: 'nc-native:anthropic' }] }
      if (path === '/api/vault/credentials/vault-row-1/reveal') return { provider: 'anthropic', apiKey: 'sk-ant-pulled' }
      return { credentials: [] }
    }

    const ai = await freshComposable()
    await ai.initialize()

    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    // The revealed key is cached locally (wrapped) and pinned to the vault row.
    expect(p.localApiKey).toBe('wrapped:sk-ant-pulled')
    expect(p.credentialId).toBe('vault-row-1')
    // Reveal was actually called.
    expect(fetchCalls.some(c => c.path === '/api/vault/credentials/vault-row-1/reveal')).toBe(true)
  })

  it('does NOT clobber a key the user already has on-device (no-clobber guard)', async () => {
    setPlatform('capacitor')
    dbSettings = defaultSettings([makeProvider({ localApiKey: 'wrapped:sk-ant-USER', credentialId: 'local-prov-anthropic-1' })])
    const reveal = vi.fn()
    respond = (path) => {
      if (path === '/api/vault/credentials') return { credentials: [{ id: 'vault-row-1', provider: 'anthropic', label: 'nc-native:anthropic' }] }
      if (path.endsWith('/reveal')) { reveal(); return { provider: 'anthropic', apiKey: 'sk-ant-STALE' } }
      return { credentials: [] }
    }

    const ai = await freshComposable()
    await ai.initialize()

    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    // The user's on-device key is untouched...
    expect(p.localApiKey).toBe('wrapped:sk-ant-USER')
    // ...and the vault row was never revealed (guard short-circuits before it).
    expect(reveal).not.toHaveBeenCalled()
    // The stale placeholder is self-healed to the real vault row id (safe).
    expect(p.credentialId).toBe('vault-row-1')
  })
})

// ─── 3. One-time migration (local-only key → vault) ─────────────────────────
describe('initialize — one-time migration of a local-only key (AER-61)', () => {
  it('pushes a local-only key (credentialId does NOT resolve to a vault row) up to the vault, once', async () => {
    setPlatform('tauri')
    dbSettings = defaultSettings([makeProvider({ localApiKey: 'wrapped:sk-ant-local', credentialId: 'local-prov-anthropic-1' })])
    respond = (path, opts) => {
      if (path === '/api/vault/credentials' && opts?.method === 'POST') {
        return { ok: true, credential: { id: 'vault-row-9' } }
      }
      // The list is EMPTY — so the local- credentialId doesn't resolve to a row.
      return { credentials: [] }
    }

    const ai = await freshComposable()
    await ai.initialize()

    // Migration unwrapped the local key and POSTed the RAW value once.
    const posts = fetchCalls.filter(c => c.path === '/api/vault/credentials' && c.options?.method === 'POST').map(bodyOf)
    expect(posts).toHaveLength(1)
    expect(posts[0].rawValue).toBe('sk-ant-local')
    expect(posts[0].provider).toBe('anthropic')
    expect(posts[0].label).toBe('nc-native:anthropic')

    // The provider now points at the real vault row.
    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    expect(p.credentialId).toBe('vault-row-9')

    // Idempotency: re-initialize (already-loaded path) does not migrate again —
    // the one-shot guard is spent for this session.
    fetchCalls.length = 0
    await ai.initialize()
    const postsAfter = fetchCalls.filter(c => c.path === '/api/vault/credentials' && c.options?.method === 'POST')
    expect(postsAfter).toHaveLength(0)
  })

  it('does NOT migrate when the credentialId already resolves to a live vault row', async () => {
    setPlatform('tauri')
    dbSettings = defaultSettings([makeProvider({ localApiKey: 'wrapped:sk-ant-local', credentialId: 'vault-row-1' })])
    const posts: any[] = []
    respond = (path, opts) => {
      if (path === '/api/vault/credentials' && opts?.method === 'POST') { posts.push(opts.body); return { ok: true, credential: { id: 'x' } } }
      if (path === '/api/vault/credentials') return { credentials: [{ id: 'vault-row-1', provider: 'anthropic', label: 'nc-native:anthropic' }] }
      return { credentials: [] }
    }

    const ai = await freshComposable()
    await ai.initialize()

    // Nothing pushed — the key is already account-linked.
    expect(posts).toHaveLength(0)
    // And nothing was revealed either (provider already has a usable local key).
    expect(fetchCalls.some(c => c.path.endsWith('/reveal'))).toBe(false)
  })
})

// ─── AER-61 leak-guard: reviewer SHARED key must NEVER enter the vault ───────
describe('seedReviewKey — reviewer SHARED key stays out of the vault', () => {
  // Wire the /api/ai/keys/reveal endpoint (source of the reviewer key) plus a
  // POST that WOULD succeed if anything wrongly tried to write it to the vault.
  function respondReviewerSeed(vaultCredentials: any[] = []) {
    return (path: string, opts?: any) => {
      if (path === '/api/ai/keys/reveal') {
        return { provider: 'anthropic', apiKey: 'sk-ant-REVIEWER', model: 'claude-x' }
      }
      if (path === '/api/vault/credentials' && opts?.method === 'POST') {
        // If this ever fires for the reviewer key, the test's POST assertion fails.
        return { ok: true, credential: { id: 'LEAKED-vault-row' } }
      }
      if (path === '/api/vault/credentials') return { credentials: vaultCredentials }
      return { credentials: [] }
    }
  }

  it('caches the reviewer key locally with a durable review-<id> sentinel and makes NO vault POST (addProvider branch)', async () => {
    setPlatform('capacitor')
    // No provider of this type yet → seedReviewKey takes the addProvider branch.
    dbSettings = defaultSettings([])
    respond = respondReviewerSeed()

    const ai = await freshComposable()
    await ai.seedReviewKey()

    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    // The reviewer key WORKS on-device (cached, wrapped) …
    expect(p.localApiKey).toBe('wrapped:sk-ant-REVIEWER')
    // … but is stamped with the durable sentinel, NOT a real vault id / local-.
    expect(p.credentialId).toBe(`review-${p.id}`)
    // Crucially: it was NEVER written to the account vault.
    const vaultPosts = fetchCalls.filter(c => c.path === '/api/vault/credentials' && c.options?.method === 'POST')
    expect(vaultPosts).toHaveLength(0)
    // The sentinel is persisted (durable across restarts) — it hit the DB.
    expect(dbSettings.providers.find((x: any) => x.type === 'anthropic')?.credentialId).toBe(`review-${p.id}`)
  })

  it('stamps the sentinel and makes NO vault POST when a provider already exists (existing-provider branch)', async () => {
    setPlatform('tauri')
    // A keyless anthropic provider already exists → existing-provider branch.
    dbSettings = defaultSettings([makeProvider({ localApiKey: undefined, credentialId: undefined })])
    respond = respondReviewerSeed()

    const ai = await freshComposable()
    await ai.seedReviewKey()

    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    expect(p.localApiKey).toBe('wrapped:sk-ant-REVIEWER')
    expect(p.credentialId).toBe(`review-${p.id}`)
    const vaultPosts = fetchCalls.filter(c => c.path === '/api/vault/credentials' && c.options?.method === 'POST')
    expect(vaultPosts).toHaveLength(0)
  })

  it('does NOT migrate the reviewer key to the vault on init — even across a simulated restart where seedReviewKey no-ops', async () => {
    setPlatform('capacitor')
    // Simulate a RELAUNCH: the reviewer key was seeded in a PREVIOUS session and
    // is already persisted with its durable review-<id> sentinel. On this launch
    // seedReviewKey() no-ops (a localApiKey already exists), so the ONLY thing
    // that could leak it is the migration pass — which must skip the sentinel.
    dbSettings = defaultSettings([
      makeProvider({ localApiKey: 'wrapped:sk-ant-REVIEWER', credentialId: 'review-prov-anthropic-1' }),
    ])
    // The account vault is EMPTY → a `review-` credentialId does NOT resolve to a
    // row, so WITHOUT the guard the migration pass would push it up.
    respond = (path, opts) => {
      if (path === '/api/ai/keys/reveal') return { provider: 'anthropic', apiKey: 'sk-ant-REVIEWER' }
      if (path === '/api/vault/credentials' && opts?.method === 'POST') return { ok: true, credential: { id: 'LEAKED' } }
      if (path === '/api/vault/credentials') return { credentials: [] }
      return { credentials: [] }
    }

    const ai = await freshComposable()
    await ai.initialize()

    // seedReviewKey no-op'd (key already present) — proven by no reveal-endpoint hit.
    expect(fetchCalls.some(c => c.path === '/api/ai/keys/reveal')).toBe(false)
    // The migration pass skipped the sentinel — NO vault POST, ever.
    const vaultPosts = fetchCalls.filter(c => c.path === '/api/vault/credentials' && c.options?.method === 'POST')
    expect(vaultPosts).toHaveLength(0)
    // The sentinel + the working local key are preserved intact.
    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    expect(p.credentialId).toBe('review-prov-anthropic-1')
    expect(p.localApiKey).toBe('wrapped:sk-ant-REVIEWER')
  })

  it('REGRESSION: a NORMAL local-only key (local- id) IS still migrated to the vault', async () => {
    setPlatform('capacitor')
    // Same empty-vault setup as the reviewer restart case, but a REAL BYOK key
    // carrying the ordinary `local-` placeholder — this MUST still migrate up.
    dbSettings = defaultSettings([
      makeProvider({ localApiKey: 'wrapped:sk-ant-REAL', credentialId: 'local-prov-anthropic-1' }),
    ])
    respond = (path, opts) => {
      if (path === '/api/vault/credentials' && opts?.method === 'POST') return { ok: true, credential: { id: 'vault-row-real' } }
      return { credentials: [] }
    }

    const ai = await freshComposable()
    await ai.initialize()

    const posts = fetchCalls.filter(c => c.path === '/api/vault/credentials' && c.options?.method === 'POST').map(bodyOf)
    expect(posts).toHaveLength(1)
    expect(posts[0].rawValue).toBe('sk-ant-REAL')
    // And the provider is re-pinned to the real vault row.
    const p = ai.providers.value.find(x => x.type === 'anthropic')!
    expect(p.credentialId).toBe('vault-row-real')
  })
})

// ─── Guest / web isolation ──────────────────────────────────────────────────
describe('web flow is untouched by the native vault paths', () => {
  it('makes NO native vault calls and uses the web vault branch on web', async () => {
    setPlatform('web')
    dbSettings = defaultSettings([])

    // On web, useCredentialVault.isVaultAvailable is false in this harness, so
    // addProvider stores no key server-side and makes NO native remoteFetch.
    const ai = await freshComposable()
    await ai.addProvider('anthropic', undefined, 'sk-web')

    // remoteFetch (the NATIVE transport) was never touched on web.
    expect(remoteFetch).not.toHaveBeenCalled()
  })
})
