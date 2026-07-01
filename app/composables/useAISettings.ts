/**
 * AI Settings composable for managing BYOK providers and personas
 */
import type {
  AISettings,
  AIProviderConfig,
  PersonaConfig,
  AIProviderType,
  AIModel
} from '~/types/ai-settings'
import {
  PROVIDER_TEMPLATES,
  DEFAULT_PERSONA,
  DEFAULT_AI_SETTINGS
} from '~/types/ai-settings'
import { useDatabase } from '~/composables/useDatabase'
import { useCredentialVault } from '~/composables/useCredentialVault'
import { aiTestConnection } from '~/utils/aiClient'
import { wrapKey, readKey as readWrappedKey } from '~/utils/secureKeyStore'

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

function _isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window
    && !!(window as any).Capacitor?.isNativePlatform?.()
}

/**
 * Stable, provider-scoped vault label for NATIVE-written BYOK keys (AER-61).
 *
 * The web flow labels each vault row with the volatile local provider id
 * (`label: id`) — fine for a single browser session, but on native the local
 * provider id is regenerated per install, so a fresh device would create a
 * SECOND vault row for the same provider instead of updating the account's one
 * key. Keying the upsert (`userId_provider_label`) on the provider TYPE gives a
 * single, cross-device-stable row per provider per account — the whole point of
 * account-linked keys. Web is deliberately left byte-for-byte unchanged.
 */
function _nativeVaultLabel(providerType: AIProviderType): string {
  return `nc-native:${providerType}`
}

interface VaultCredentialMeta {
  id: string
  provider: string
  label: string | null
  keyHash?: string
  encryptionVersion?: number
}

/**
 * Authenticated vault call over the NATIVE HTTP transport, reusing each shell's
 * own `remoteFetch` (which already attaches the persisted JWT as an explicit
 * Cookie header — the pattern documented in useSyncEngine.syncFetch). Desktop
 * (`useDesktopAuth`) speaks `RequestInit`; mobile (`useMobileAuth`) speaks
 * `{ method, headers, data }`. This adapts the two so callers work in one shape
 * and never re-implement the cookie/JWT logic.
 *
 * `auth` is the desktop/mobile composable instance; `tauri` picks the shape.
 * Returns the parsed JSON body (both remoteFetch impls already parse). Throws
 * on non-2xx (remoteFetch throws with the status in the message) so callers can
 * distinguish 404 (missing) from transport failures.
 */
async function _nativeVaultFetch<T = unknown>(
  auth: { remoteFetch: (path: string, options?: any) => Promise<any> },
  tauri: boolean,
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const method = options?.method || 'GET'
  if (tauri) {
    // Desktop remoteFetch takes RequestInit: body must be a JSON string and the
    // Content-Type set explicitly.
    const init: RequestInit = { method }
    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body)
      init.headers = { 'Content-Type': 'application/json' }
    }
    return auth.remoteFetch(path, init) as Promise<T>
  }
  // Mobile remoteFetch takes { method, headers, data }: CapacitorHttp serialises
  // `data` itself, so pass the object through.
  const opts: { method?: string; headers?: Record<string, string>; data?: unknown } = { method }
  if (options?.body !== undefined) {
    opts.data = options.body
    opts.headers = { 'Content-Type': 'application/json' }
  }
  return auth.remoteFetch(path, opts) as Promise<T>
}

// Shared state across all instances
const state = reactive<{
  settings: AISettings
  isLoading: boolean
  isInitialized: boolean
  error: string | null
}>({
  settings: { ...DEFAULT_AI_SETTINGS, updatedAt: Date.now() },
  isLoading: false,
  isInitialized: false,
  error: null,
})

// One review/owner key-seed network attempt per app session (set only once a
// signed-in request is actually made — see seedReviewKey()).
let _reviewSeedAttempted = false

// One vault reconcile (AER-61 migration + pull) per app session, spent only
// once a native signed-in list fetch actually runs — so a cold-start call while
// signed out leaves it unspent for a later retry (sign-in often lands AFTER the
// first initialize()). Mirrors _reviewSeedAttempted's cold-start handling.
let _vaultSyncAttempted = false

export function useAISettings() {
  const db = useDatabase()
  const vault = useCredentialVault()

  // Computed helpers
  const providers = computed(() => state.settings.providers)
  const personas = computed(() => state.settings.personas)

  const defaultProvider = computed(() =>
    state.settings.providers.find(p => p.id === state.settings.defaultProviderId)
  )

  const defaultPersona = computed(() =>
    state.settings.personas.find(p => p.id === state.settings.defaultPersonaId)
  )

  const enabledProviders = computed(() =>
    state.settings.providers.filter(p => p.isEnabled)
  )

  /**
   * Initialize settings from database
   */
  async function initialize(): Promise<void> {
    if (state.isInitialized) {
      // Already loaded — still attempt the (idempotent) native review-key seed
      // and vault reconcile, since sign-in often happens AFTER the first
      // initialize() call (both are one-shot + no-op when not signed in).
      void seedReviewKey()
      void syncVaultOnInit()
      return
    }
    state.isLoading = true
    state.error = null
    try {
      const settings = await db.getAISettings()
      state.settings = settings

      if (state.settings.personas.length === 0) {
        const defaultPersonaConfig: PersonaConfig = {
          ...DEFAULT_PERSONA,
          id: generateId(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        state.settings.personas.push(defaultPersonaConfig)
        state.settings.defaultPersonaId = defaultPersonaConfig.id
        await save()
      }

      state.isInitialized = true

      // Self-heal (ALL platforms incl. web/PWA): refresh the curated provider
      // model lists (Anthropic -> Opus 4.8 / Sonnet 4.6 / Haiku 4.5; OpenAI ->
      // GPT-5.5 / 5.4-mini / 5.4-nano) so the latest IDs replace stale ones
      // stored on accounts created before the lists were bumped. Dynamic
      // providers (OpenRouter, Ollama) load models from the API — leave those.
      let modelsChanged = false
      for (const p of state.settings.providers) {
        if (p.type === 'anthropic' || p.type === 'openai') {
          const template = PROVIDER_TEMPLATES[p.type]
          if (template?.models?.length) {
            const nextModels = [...template.models]
            if (JSON.stringify(p.models) !== JSON.stringify(nextModels)) {
              p.models = nextModels
              modelsChanged = true
            }
            // Move off any selection that's missing, gone, or not-yet-available;
            // fall back to the first AVAILABLE model so AI calls don't break.
            const usable = template.models.some(
              m => m.id === p.selectedModelId && m.available !== false,
            )
            if (!usable) {
              const fallback = template.models.find(m => m.available !== false)
                ?? template.models[0]!
              p.selectedModelId = fallback.id
              modelsChanged = true
            }
          }
        }
      }
      if (modelsChanged) await save()

      // Auto-register local provider on Capacitor (mobile) if not already present
      if (_isCapacitor()) {
        // Ollama is unusable on a phone (no reachable localhost server), so
        // it's fully excluded on mobile. Strip any leftover ollama provider
        // from accounts created before it was removed, and repoint the default.
        const ollamaProviders = state.settings.providers.filter(p => p.type === 'ollama')
        if (ollamaProviders.length) {
          const removedDefault = ollamaProviders.some(p => p.id === state.settings.defaultProviderId)
          state.settings.providers = state.settings.providers.filter(p => p.type !== 'ollama')
          if (removedDefault) {
            state.settings.defaultProviderId = state.settings.providers[0]?.id
          }
          await save()
        }

        const hasLocalProvider = state.settings.providers.some(p => p.type === 'local')
        if (!hasLocalProvider) {
          const template = PROVIDER_TEMPLATES['local']
          const id = `local-${Date.now()}`
          const localProvider: AIProviderConfig = {
            id,
            type: 'local',
            name: template.name || 'Gemma 4 (On-Device)',
            models: [...(template.models || [])],
            selectedModelId: template.models?.[0]?.id,
            isEnabled: true,
            isDefault: state.settings.providers.length === 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          state.settings.providers.push(localProvider)
          if (localProvider.isDefault) {
            state.settings.defaultProviderId = id
          }
          await save()
        }

        // Self-heal: if the current default is an unreachable provider
        // (Ollama on a phone with no localhost server, or local without a key),
        // promote the first enabled provider that actually has a key to default.
        const currentDefault = state.settings.providers.find(p => p.id === state.settings.defaultProviderId)
        const defaultIsBroken = !currentDefault
          || (currentDefault.type === 'ollama' && !currentDefault.localApiKey && (!currentDefault.baseUrl || currentDefault.baseUrl.includes('localhost') || currentDefault.baseUrl.includes('127.0.0.1')))
        if (defaultIsBroken) {
          const usable = state.settings.providers.find(p =>
            p.isEnabled
            && p.type !== 'ollama'
            && p.type !== 'local'
            && (p.localApiKey || p.credentialId)
          )
          if (usable) {
            state.settings.defaultProviderId = usable.id
            for (const p of state.settings.providers) p.isDefault = (p.id === usable.id)
            await save()
          }
        }
      }
      // Native: seed the review/owner key (no-op on web / when not signed in).
      void seedReviewKey()
      // Native (AER-61): reconcile on-device BYOK keys with the account vault —
      // migrate local-only keys up, pull account keys down onto a fresh device.
      // No-op on web / guests / signed-out / offline; awaited so a fresh device
      // has its keys populated before the first generation resolves a provider.
      await syncVaultOnInit()
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Failed to load AI settings'
      console.error('Failed to initialize AI settings:', e)
    } finally {
      state.isLoading = false
    }
  }

  /**
   * NATIVE + signed-in + online (AER-61): reconcile on-device BYOK keys with the
   * account's server vault so keys are account-linked and cross-device. Runs
   * once per initialize(). Three effects, all strictly additive & idempotent:
   *
   *   (a) MIGRATION (no loss, no plaintext at rest): any provider that has a
   *       readKey()-decryptable localApiKey but whose credentialId does NOT
   *       resolve to a real vault row is pushed to the vault via write-through.
   *       Keyed on "vault row resolves", NOT on the `local-` string — so it also
   *       retries earlier write-throughs that failed offline. The plaintext is
   *       unwrapped on THIS device (where the material exists) and travels only
   *       over the authenticated HTTPS POST; never persisted or logged.
   *
   *   (b) PULL (cross-device magic): for each account provider whose key is NOT
   *       already present locally in usable form, reveal it, wrapKey() it into
   *       localApiKey, and set credentialId. This lights up a fresh device.
   *
   * Guard: NEVER clobber a key the user already has on-device (same rule as
   * seedReviewKey) — providers with a usable localApiKey are left untouched by
   * the pull. NEVER throws; any failure leaves local state exactly as it was.
   */
  async function syncVaultOnInit(): Promise<void> {
    if (_vaultSyncAttempted) return
    const ready = nativeAuthIfReady()
    // Not native / signed-out / offline — leave the attempt UNSPENT so a later
    // call (after sign-in) actually runs the reconcile.
    if (!ready) return

    let list: VaultCredentialMeta[]
    try {
      const res = await _nativeVaultFetch<{ credentials?: VaultCredentialMeta[] }>(
        ready.auth,
        ready.tauri,
        '/api/vault/credentials',
      )
      list = Array.isArray(res?.credentials) ? res.credentials : []
    } catch {
      // Offline / server error — do nothing; keys stay local. Leave the attempt
      // UNSPENT so it retries on the next initialize().
      return
    }
    // Reached the server with a signed-in session — spend the one-shot.
    _vaultSyncAttempted = true

    const vaultIds = new Set(list.map(c => c.id))
    let changed = false

    // ── (a) Migration + offline-write retry ────────────────────────────────
    // Push any provider whose credentialId doesn't resolve to a live vault row
    // but which still holds a decryptable local key. Idempotent via the
    // provider-scoped label upsert (userId_provider_label).
    for (const provider of state.settings.providers) {
      if (provider.type === 'ollama' || provider.type === 'local') continue
      // AER-61 leak-guard: never migrate the App-Store-reviewer's SHARED key.
      // The durable `review-<id>` sentinel (set at seed time, persisted with the
      // provider so it survives relaunch) keeps this borrowed key out of the
      // account vault. Real user BYOK keys use `local-`/real ids and still migrate.
      if (provider.credentialId?.startsWith('review-')) continue
      const resolvesToVaultRow = !!provider.credentialId && vaultIds.has(provider.credentialId)
      if (resolvesToVaultRow) continue
      if (!provider.localApiKey) continue
      // Unwrap on-origin (material lives here). null = wrapping material lost →
      // nothing to migrate, leave the provider for the user to re-enter.
      const raw = await readWrappedKey(provider.localApiKey)
      if (!raw) continue
      const ok = await vaultWriteThrough(provider, raw)
      if (ok) {
        // Newly-created/updated row — keep the pull below from re-revealing it.
        if (provider.credentialId) vaultIds.add(provider.credentialId)
        changed = true
      }
      // raw drops out of scope here; never stored, never logged.
    }

    // ── (b) Pull: populate providers missing a usable on-device key ─────────
    // Match a vault row to a local provider by TYPE (the native label is
    // provider-scoped). A provider that already has a localApiKey is respected
    // (don't-clobber guard) and skipped.
    for (const cred of list) {
      const provider = state.settings.providers.find(p => p.type === cred.provider)
      // Don't clobber a user-entered / already-present on-device key.
      if (provider?.localApiKey) {
        // Ensure the credentialId points at the real vault row (self-heal a
        // stale `local-` placeholder now that we know the account row).
        if (provider.credentialId !== cred.id && (!provider.credentialId || provider.credentialId.startsWith('local-'))) {
          provider.credentialId = cred.id
          changed = true
        }
        continue
      }
      // Reveal the account key and cache it locally (wrapped).
      let revealed: { provider?: string; apiKey?: string } | null
      try {
        revealed = await _nativeVaultFetch<{ provider?: string; apiKey?: string }>(
          ready.auth,
          ready.tauri,
          `/api/vault/credentials/${cred.id}/reveal`,
        )
      } catch {
        // 404 (row vanished) / offline — skip this one, try the rest.
        continue
      }
      const key = revealed?.apiKey
      if (!key) continue
      const providerType = (revealed.provider || cred.provider) as AIProviderType
      let target = state.settings.providers.find(p => p.type === providerType)
      if (target?.localApiKey) continue // re-check guard (async gap)
      if (!target) {
        // Fresh device with no local provider of this type yet — create it from
        // the template WITHOUT a key (no redundant write-through; the row already
        // exists on the account), then cache the revealed key locally below.
        target = await addProvider(providerType)
      }
      // Cache the account key locally (AES-GCM wrapped) and point at the real
      // vault row so the read-through/rotation logic works on this device.
      target.localApiKey = await wrapKey(key)
      target.credentialId = cred.id
      target.isEnabled = true
      changed = true
      // key drops out of scope; never persisted in plaintext, never logged.
    }

    // Fresh-device default promotion: if the active default has no usable key
    // (e.g. only the on-device `local` provider was auto-registered), promote a
    // provider we just populated so generation works immediately. Mirrors the
    // existing Capacitor self-heal rule — only fires when the default is broken,
    // so a working user choice is never overridden.
    if (changed) {
      const currentDefault = state.settings.providers.find(p => p.id === state.settings.defaultProviderId)
      const defaultUsable = !!currentDefault
        && currentDefault.isEnabled
        && (currentDefault.type === 'local'
          ? true
          : !!(currentDefault.localApiKey || currentDefault.credentialId))
      if (!defaultUsable) {
        const promote = state.settings.providers.find(p =>
          p.isEnabled && p.type !== 'ollama' && p.type !== 'local' && !!p.localApiKey)
        if (promote) {
          state.settings.defaultProviderId = promote.id
          for (const p of state.settings.providers) p.isDefault = (p.id === promote.id)
        }
      }
    }

    if (changed) await save()
  }

  /**
   * Save settings to database
   */
  async function save(): Promise<void> {
    try {
      state.settings.updatedAt = Date.now()
      // Convert reactive proxy to plain object for IndexedDB
      const plainSettings = JSON.parse(JSON.stringify(state.settings))
      await db.saveAISettings(plainSettings)
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Failed to save AI settings'
      throw e
    }
  }

  /**
   * Generate unique ID
   */
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Native-only: seed a provider API key from the server for allowlisted
   * accounts (App Store reviewer / owner).
   *
   * Native shells (Capacitor / Tauri) call AI providers directly and need the
   * key on-device. This pulls a server-configured key over an authenticated
   * request — gated server-side to an email allowlist (see
   * server/api/ai/keys/reveal.get.ts) — so generation works without typing a
   * key and without the secret ever living in the app binary.
   *
   * Strictly additive: no-op on web, no-op when not signed in, no-op when the
   * endpoint 404s (feature off / not allowlisted), and NEVER overrides a key
   * the user already entered.
   */
  async function seedReviewKey(): Promise<void> {
    if (typeof window === 'undefined') return
    const tauri = _isTauri()
    const cap = _isCapacitor()
    if (!tauri && !cap) return

    if (_reviewSeedAttempted) return
    // Respect any key the user already has — don't clobber real BYOK keys.
    if (state.settings.providers.some(p => p.isEnabled && p.localApiKey)) return

    try {
      const auth = tauri ? useDesktopAuth() : useMobileAuth()
      // Not signed in yet — leave the attempt unspent so a later call retries.
      if (!auth?.isSignedIn?.value) return

      let res: { provider?: string; apiKey?: string; model?: string; baseUrl?: string } | null
      try {
        res = await auth.remoteFetch('/api/ai/keys/reveal')
      } catch (err) {
        // Only burn the one-shot on a definitive 404 (not allowlisted / feature
        // off). A 401 means auth isn't ready yet (cold-start race) — leave the
        // attempt unspent so the next generation retries once the session lands.
        if (err instanceof Error && err.message.includes('404')) {
          _reviewSeedAttempted = true
        }
        return
      }
      _reviewSeedAttempted = true

      const key = res?.apiKey?.trim()
      if (!key) return
      const providerType = (res?.provider || 'anthropic') as AIProviderType

      let provider = state.settings.providers.find(p => p.type === providerType)
      if (!provider) {
        // addProvider wraps the key (AES-GCM) and persists. `reviewSeeded` keeps
        // this SHARED reviewer key out of the vault and stamps the durable
        // `review-<id>` sentinel (see addProvider / syncVaultOnInit leak-guards).
        provider = await addProvider(providerType, undefined, key, res?.baseUrl, { reviewSeeded: true })
      } else {
        provider.localApiKey = await wrapKey(key)
        // Durable `review-<id>` sentinel: marks this as the borrowed reviewer key
        // so the migration pass never pushes it to the vault (survives restarts —
        // persisted with the provider) and the read-through never reveal-404s it.
        provider.credentialId = `review-${provider.id}`
        provider.isEnabled = true
        if (res?.baseUrl) provider.baseUrl = res.baseUrl
      }
      if (res?.model) provider.selectedModelId = res.model

      // Make it the active default so generation uses it immediately.
      state.settings.defaultProviderId = provider.id
      for (const p of state.settings.providers) p.isDefault = (p.id === provider.id)

      await save()
    } catch {
      // 404 (not allowlisted / feature off) or offline — silently no-op.
    }
  }

  /**
   * Native + signed-in helper: resolve the desktop/mobile auth instance IF this
   * is a native shell and the user is actually signed in AND online. Returns
   * null otherwise (web, guest, signed-out, or offline) so every vault path can
   * gate on a single truthy check and pure-local behaviour is preserved for
   * guests/signed-out/web. NEVER throws.
   */
  function nativeAuthIfReady(): { auth: any; tauri: boolean } | null {
    if (typeof window === 'undefined') return null
    const tauri = _isTauri()
    const cap = _isCapacitor()
    if (!tauri && !cap) return null
    // Offline → no vault calls; caller keeps the local cache untouched.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
    try {
      const auth = tauri ? useDesktopAuth() : useMobileAuth()
      if (!auth?.isSignedIn?.value) return null
      return { auth, tauri }
    } catch {
      return null
    }
  }

  /**
   * Native write-through (AER-61): after the local (offline-cache) key is set,
   * mirror the RAW key into the server vault so it becomes account-linked and
   * cross-device. On success, replace the `local-<id>` placeholder credentialId
   * with the real vault id. On any failure (offline / transport / server) we
   * leave the local key + placeholder in place and return false — the key is
   * NEVER lost, the user is NEVER blocked, and the next initialize() migration
   * pass retries the write (keyed on "no real vault row"). The plaintext travels
   * ONLY over the authenticated HTTPS vault POST; it is never logged.
   */
  async function vaultWriteThrough(provider: AIProviderConfig, rawApiKey: string): Promise<boolean> {
    const ready = nativeAuthIfReady()
    if (!ready) return false
    try {
      const result = await _nativeVaultFetch<{ ok: boolean; credential?: { id: string } }>(
        ready.auth,
        ready.tauri,
        '/api/vault/credentials',
        {
          method: 'POST',
          body: {
            provider: provider.type,
            rawValue: rawApiKey,
            label: _nativeVaultLabel(provider.type),
          },
        },
      )
      if (result?.ok && result.credential?.id) {
        provider.credentialId = result.credential.id
        return true
      }
      return false
    } catch {
      // Offline / server error — keep the local cache + placeholder; do not log
      // the key or the error body (may echo request context). Retried on init.
      return false
    }
  }

  /**
   * Add a new provider.
   *
   * `opts.reviewSeeded` (AER-61 leak-guard) marks this provider as seeded from
   * the App-Store-reviewer SHARED key (seedReviewKey()), NOT a real user BYOK
   * key. When set, the raw key is cached locally (so generation works on this
   * device) but is NEVER mirrored into the server vault — the borrowed key must
   * not become account-linked / cross-device — and the credentialId is stamped
   * with the durable `review-<id>` sentinel so both the migration pass and the
   * inference read-through skip it. Default (unset) = current behaviour for
   * every normal caller.
   */
  async function addProvider(
    type: AIProviderType,
    name?: string,
    apiKey?: string,
    baseUrl?: string,
    opts?: { reviewSeeded?: boolean }
  ): Promise<AIProviderConfig> {
    const template = PROVIDER_TEMPLATES[type]
    const id = generateId()

    const provider: AIProviderConfig = {
      id,
      type,
      name: name || template.name || type,
      baseUrl: baseUrl || template.baseUrl,
      models: [...(template.models || [])],
      // First AVAILABLE model (skip not-yet-GA entries like Fable 5).
      selectedModelId: (template.models?.find(m => m.available !== false) ?? template.models?.[0])?.id,
      isEnabled: true,
      isDefault: state.settings.providers.length === 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (apiKey) {
      if (_isTauri() || _isCapacitor()) {
        // Native shells (Tauri / Capacitor): store API key locally in
        // IndexedDB. Wrap with AES-GCM-256 so an IndexedDB dump / backup
        // theft / dev-tools snoop reveals only ciphertext. Legacy
        // plaintext keys still read via readKey() during transition.
        // This local wrap is the OFFLINE CACHE — always written first so the
        // key can never be lost even if the network step below fails.
        provider.localApiKey = await wrapKey(apiKey)
        if (opts?.reviewSeeded) {
          // AER-61 leak-guard: the reviewer's SHARED key. Stamp the durable
          // `review-<id>` sentinel (persisted with the provider) and DO NOT
          // write-through — the borrowed key must never enter the account vault.
          provider.credentialId = `review-${id}`
        } else {
          provider.credentialId = `local-${id}`
          // AER-61 write-through: when signed-in + online, mirror the RAW key into
          // the server vault so it's account-linked & cross-device, and swap the
          // `local-<id>` placeholder for the real vault id. On failure this is a
          // no-op (local key stays; retried on next initialize migration pass).
          await vaultWriteThrough(provider, apiKey)
        }
      } else if (vault.isVaultAvailable.value) {
        // Web: send raw key to server vault (server-only encryption v4)
        try {
          const result: { ok: boolean; credential?: { id: string } } = await ($fetch as any)('/api/vault/credentials', {
            method: 'POST',
            body: {
              provider: type,
              rawValue: apiKey,
              label: id,
            }
          })
          if (result.ok && result.credential) {
            provider.credentialId = result.credential.id
          }
        } catch (err) {
          console.error('Failed to save key to vault:', err)
          throw new Error('Failed to save API key. Please try again.')
        }
      }
    }

    state.settings.providers.push(provider)

    // Set as default if first provider
    if (provider.isDefault) {
      state.settings.defaultProviderId = id
    }

    await save()
    return provider
  }

  /**
   * Update an existing provider
   */
  async function updateProvider(
    id: string,
    updates: Partial<Omit<AIProviderConfig, 'id' | 'createdAt'>>
  ): Promise<void> {
    const index = state.settings.providers.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Provider not found')

    const existing = state.settings.providers[index]!
    state.settings.providers[index] = {
      ...existing,
      ...updates,
      id: existing.id,
      type: existing.type,
      name: updates.name ?? existing.name,
      models: updates.models ?? existing.models,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    }

    await save()
  }

  /**
   * Update provider API key
   * Sends raw key to server vault (v4 server-only encryption).
   */
  async function updateProviderApiKey(id: string, apiKey: string): Promise<void> {
    const provider = state.settings.providers.find(p => p.id === id)
    if (!provider) throw new Error('Provider not found')

    if (_isTauri() || _isCapacitor()) {
      // Native shells (Tauri / Capacitor): store API key locally in
      // IndexedDB, wrapped with AES-GCM-256 (see secureKeyStore.ts). The local
      // wrap is the OFFLINE CACHE and is written first so a failed network step
      // can never lose the key the user just typed.
      const prevCredentialId = provider.credentialId
      provider.localApiKey = apiKey ? await wrapKey(apiKey) : ''
      provider.credentialId = apiKey ? `local-${id}` : ''
      if (apiKey) {
        // AER-61 write-through: mirror the RAW key into the server vault so the
        // rotation propagates to the account's other devices. Replaces the
        // `local-<id>` placeholder with the real vault id on success; on failure
        // the local key stays and initialize()'s migration pass retries.
        await vaultWriteThrough(provider, apiKey)
      } else {
        // Removal: also delete the account-linked vault row so a cross-device
        // pull won't resurrect the key. Only attempt when the previous id was a
        // REAL vault row (not the `local-` placeholder). Best-effort — never
        // block the user, never log the key.
        if (prevCredentialId && !prevCredentialId.startsWith('local-')) {
          const ready = nativeAuthIfReady()
          if (ready) {
            try {
              await _nativeVaultFetch(ready.auth, ready.tauri, `/api/vault/credentials/${prevCredentialId}`, { method: 'DELETE' })
            } catch { /* offline / already gone — local removal already done */ }
          }
        }
      }
    } else if (vault.isVaultAvailable.value) {
      if (apiKey) {
        // Web: send raw key to server vault (server-only encryption v4)
        try {
          const result: { ok: boolean; credential?: { id: string } } = await ($fetch as any)('/api/vault/credentials', {
            method: 'POST',
            body: {
              provider: provider.type,
              rawValue: apiKey,
              label: id,
            }
          })
          if (result.ok && result.credential) {
            provider.credentialId = result.credential.id
          }
        } catch (err) {
          console.error('Failed to update key in vault:', err)
          throw new Error('Failed to save API key. Please try again.')
        }
      } else if (provider.credentialId) {
        // Remove: DELETE the stored credential. Posting an empty rawValue would
        // fall through to the server's legacy branch and 400 on encryptedValue.
        try {
          await ($fetch as any)(`/api/vault/credentials/${provider.credentialId}`, { method: 'DELETE' })
        } catch (err) {
          console.error('Failed to remove key from vault:', err)
        }
        provider.credentialId = ''
      }
    }

    await updateProvider(id, { updatedAt: Date.now() })
  }

  /**
   * Get the vault credential ID for a provider (web only).
   * Returns null for Tauri or if no credential is stored in vault.
   */
  function getProviderCredentialId(id: string): string | null {
    const provider = state.settings.providers.find(p => p.id === id)
    return provider?.credentialId || null
  }

  /**
   * Check if provider has an API key stored
   */
  async function hasProviderApiKey(id: string): Promise<boolean> {
    const provider = state.settings.providers.find(p => p.id === id)
    return !!provider?.credentialId || !!provider?.localApiKey
  }

  /**
   * Delete a provider
   */
  async function deleteProvider(id: string): Promise<void> {
    const index = state.settings.providers.findIndex(p => p.id === id)
    if (index === -1) return

    // Remove provider
    state.settings.providers.splice(index, 1)

    // Update default if needed
    if (state.settings.defaultProviderId === id) {
      state.settings.defaultProviderId = state.settings.providers[0]?.id
    }

    await save()
  }

  /**
   * Set default provider
   */
  async function setDefaultProvider(id: string): Promise<void> {
    const provider = state.settings.providers.find(p => p.id === id)
    if (!provider) throw new Error('Provider not found')

    // Update isDefault flags
    state.settings.providers.forEach(p => {
      p.isDefault = p.id === id
    })
    state.settings.defaultProviderId = id

    await save()
  }

  /**
   * Add a new persona
   */
  async function addPersona(
    config: Omit<PersonaConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PersonaConfig> {
    const persona: PersonaConfig = {
      ...config,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // If this is set as default, unset other defaults
    if (persona.isDefault) {
      state.settings.personas.forEach(p => {
        p.isDefault = false
      })
      state.settings.defaultPersonaId = persona.id
    }

    state.settings.personas.push(persona)
    await save()
    return persona
  }

  /**
   * Update an existing persona
   */
  async function updatePersona(
    id: string,
    updates: Partial<Omit<PersonaConfig, 'id' | 'createdAt'>>
  ): Promise<void> {
    const index = state.settings.personas.findIndex(p => p.id === id)
    if (index === -1) throw new Error('Persona not found')

    // If setting as default, unset other defaults
    if (updates.isDefault) {
      state.settings.personas.forEach(p => {
        p.isDefault = false
      })
      state.settings.defaultPersonaId = id
    }

    const existing = state.settings.personas[index]!
    state.settings.personas[index] = {
      ...existing,
      ...updates,
      id: existing.id,
      name: updates.name ?? existing.name,
      systemPrompt: updates.systemPrompt ?? existing.systemPrompt,
      temperature: updates.temperature ?? existing.temperature,
      maxTokens: updates.maxTokens ?? existing.maxTokens,
      createdAt: existing.createdAt,
      updatedAt: Date.now()
    }

    await save()
  }

  /**
   * Delete a persona
   */
  async function deletePersona(id: string): Promise<void> {
    const index = state.settings.personas.findIndex(p => p.id === id)
    if (index === -1) return

    state.settings.personas.splice(index, 1)

    // Update default if needed
    if (state.settings.defaultPersonaId === id) {
      state.settings.defaultPersonaId = state.settings.personas[0]?.id
      if (state.settings.personas[0]) {
        state.settings.personas[0].isDefault = true
      }
    }

    await save()
  }

  /**
   * Set default persona
   */
  async function setDefaultPersona(id: string): Promise<void> {
    const persona = state.settings.personas.find(p => p.id === id)
    if (!persona) throw new Error('Persona not found')

    state.settings.personas.forEach(p => {
      p.isDefault = p.id === id
    })
    state.settings.defaultPersonaId = id

    await save()
  }

  /**
   * Update AI preferences
   */
  async function updatePreferences(
    updates: Partial<AISettings['preferences']>
  ): Promise<void> {
    state.settings.preferences = {
      ...state.settings.preferences,
      ...updates
    }
    await save()
  }

  /**
   * Test connection to a provider
   * @param providerIdOrConfig - Either a provider ID (string) to look up, or a provider config object for testing new providers
   * @param testApiKey - Optional API key to use for testing (for new providers not yet saved)
   */
  async function testConnection(
    providerIdOrConfig: string | AIProviderConfig,
    testApiKey?: string
  ): Promise<{
    success: boolean
    message: string
    models?: AIModel[]
  }> {
    let provider: AIProviderConfig | undefined
    let apiKey: string | null = null

    if (typeof providerIdOrConfig === 'string') {
      // Look up existing provider by ID
      provider = state.settings.providers.find(p => p.id === providerIdOrConfig)
      if (!provider) {
        return { success: false, message: 'Provider not found' }
      }
      apiKey = testApiKey || null
    } else {
      // Use provided config directly (for testing new providers)
      provider = providerIdOrConfig
      apiKey = testApiKey || null
    }

    // Special handling for Ollama - check if localhost is accessible from production web
    // Skip this check in Tauri (desktop app can always reach localhost)
    if (provider.type === 'ollama' && !_isTauri()) {
      const isLocalhost = provider.baseUrl?.includes('localhost') || provider.baseUrl?.includes('127.0.0.1')
      const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')

      if (isLocalhost && isProduction) {
        return {
          success: false,
          message: 'Cannot connect to local Ollama from a remote website. Use Ollama only when running the app locally, or use cloud providers (OpenAI/Anthropic) instead.'
        }
      }
    }

    try {
      // Prefer credentialId for server-side decrypt (avoids client-side passphrase issues)
      const credentialId = typeof providerIdOrConfig === 'string'
        ? getProviderCredentialId(providerIdOrConfig)
        : null

      // In Tauri / Capacitor: unwrap the stored key (or use the test key as-is).
      // readWrappedKey passes plaintext through unchanged for backwards compat.
      const storedKey = (_isTauri() || _isCapacitor()) && provider.localApiKey
        ? (await readWrappedKey(provider.localApiKey)) || undefined
        : undefined
      const effectiveApiKey = (_isTauri() || _isCapacitor())
        ? (apiKey || storedKey)
        : undefined

      const result = await aiTestConnection({
        provider: provider.type,
        apiKey: effectiveApiKey,
        credentialId: credentialId || undefined,
        rawApiKey: apiKey || undefined,  // For testing new keys before saving (web)
        baseUrl: provider.baseUrl,
      })

      return result
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Connection failed'
      }
    }
  }

  /**
   * Fetch models for a provider (Ollama/OpenRouter)
   */
  async function fetchProviderModels(providerId: string): Promise<AIModel[]> {
    const result = await testConnection(providerId)
    if (result.success && result.models) {
      await updateProvider(providerId, { models: result.models })
      return result.models
    }
    return []
  }

  /**
   * Clear all secrets (for sign out)
   */
  async function clearAllSecrets(): Promise<void> {
    // No-op in web mode — keys are server-side only
  }

  /**
   * Reset to defaults
   */
  async function reset(): Promise<void> {
    state.settings = { ...DEFAULT_AI_SETTINGS, updatedAt: Date.now() }
    await clearAllSecrets()
    await save()
    state.isInitialized = false
  }

  return {
    // State
    settings: computed(() => state.settings),
    providers,
    personas,
    defaultProvider,
    defaultPersona,
    enabledProviders,
    isLoading: computed(() => state.isLoading),
    isInitialized: computed(() => state.isInitialized),
    error: computed(() => state.error),

    // Actions
    initialize,
    seedReviewKey,
    syncVaultOnInit,
    save,

    // Provider actions
    addProvider,
    updateProvider,
    updateProviderApiKey,
    getProviderCredentialId,
    hasProviderApiKey,
    deleteProvider,
    setDefaultProvider,
    testConnection,
    fetchProviderModels,

    // Persona actions
    addPersona,
    updatePersona,
    deletePersona,
    setDefaultPersona,

    // Preferences
    updatePreferences,

    // Cleanup
    clearAllSecrets,
    reset
  }
}
