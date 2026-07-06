import { useAISettings } from '~/composables/useAISettings'
import { useGuestMode } from '~/composables/useGuestMode'
import { readKey } from '~/utils/secureKeyStore'

export interface ResolvedProvider {
  type: string
  credentialId?: string
  apiKey?: string // Tauri desktop: raw API key from local storage
  baseUrl?: string
  selectedModelId?: string
}

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

function _isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window
    && !!(window as any).Capacitor?.isNativePlatform?.()
}

/**
 * AER-61 read-through: fetch a FRESH copy of the provider's own vault key from
 * the server so a key rotated on ANOTHER device is picked up at inference time.
 * Returns null (so the caller falls back to the local cache) when: not native,
 * signed-out, offline, the credentialId isn't a real vault row (a `local-`
 * placeholder or the AER-61 `review-` sentinel), the reveal fails/404s, or Web
 * Crypto isn't around. Reuses each shell's own remoteFetch (JWT Cookie header
 * already attached — same pattern as useSyncEngine.syncFetch). NEVER throws,
 * NEVER logs the key.
 */
async function revealFreshNativeKey(credentialId: string | undefined): Promise<string | null> {
  // `review-` is the App-Store-reviewer SHARED key: it lives ONLY in the local
  // cache and was never written to the vault, so a reveal would always 404.
  // Treat it exactly like the `local-` placeholder — use the local cache.
  if (!credentialId || credentialId.startsWith('local-') || credentialId.startsWith('review-')) return null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  const tauri = _isTauri()
  if (!tauri && !_isCapacitor()) return null
  try {
    const auth = tauri ? useDesktopAuth() : useMobileAuth()
    if (!auth?.isSignedIn?.value) return null
    // A GET needs no body, so a plain `{ method: 'GET' }` satisfies both
    // remoteFetch signatures (desktop RequestInit / mobile options). Each already
    // attaches the JWT Cookie header.
    const res: any = await auth.remoteFetch(`/api/vault/credentials/${credentialId}/reveal`, { method: 'GET' })
    const key = res?.apiKey
    return typeof key === 'string' && key.length > 0 ? key : null
  } catch {
    // 404 (rotated/deleted elsewhere) / offline / transport — fall back to cache.
    return null
  }
}

/**
 * Resolve the default AI provider config.
 * Web: returns credentialId for server-side vault decryption.
 * Tauri: returns raw apiKey from local IndexedDB storage.
 */
export async function resolveProvider(): Promise<ResolvedProvider> {
  const guest = useGuestMode()

  // Capacitor (mobile) guests can use the on-device local model without an account
  if (_isCapacitor() && guest.isGuest.value) {
    return { type: 'local' }
  }

  if (guest.isGuest.value) {
    throw new Error('AI features require a free account. Sign up to unlock AI-powered mind mapping.')
  }

  const aiSettings = useAISettings()

  // Ensure AI settings are loaded from IndexedDB
  if (!aiSettings.isInitialized.value) {
    await aiSettings.initialize()
  }

  // Native (Capacitor / Tauri) calls providers directly and needs the key
  // on-device. If no on-device key is present yet, make a one-shot, awaited
  // attempt to seed it from the server (App Store reviewer / owner allowlist).
  // No-op on web, when not allowlisted (404), or once a key already exists.
  if (_isTauri() || _isCapacitor()) {
    const hasOnDeviceKey = aiSettings.providers.value.some(p => p.isEnabled && p.localApiKey)
    if (!hasOnDeviceKey) {
      await aiSettings.seedReviewKey()
    }
  }

  const defaultProvider = aiSettings.defaultProvider.value

  if (!defaultProvider?.isEnabled) {
    throw new Error('No AI provider configured. Please configure an AI provider in settings.')
  }

  // Tauri desktop / Capacitor mobile: use locally stored API key
  if (_isTauri() || _isCapacitor()) {
    // Phones can't reach an Ollama server running on the dev machine's localhost.
    if (_isCapacitor() && defaultProvider.type === 'ollama') {
      const url = defaultProvider.baseUrl || ''
      if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
        throw new Error('Ollama at localhost isn\'t reachable from your phone. Open Settings → AI Providers and tap USE on a cloud provider, or set Ollama\'s baseUrl to your computer\'s LAN IP.')
      }
    }
    // AER-61 read-through: when online + signed-in, PREFER a fresh reveal of the
    // account's vault key so a key rotated on another device is used here too.
    // Falls back to the local cache below when offline, signed-out, on a `local-`
    // placeholder, or when the reveal fails — never regressing airplane mode.
    // Attempted BEFORE the "no key" guard so a fresh device that has an
    // account-linked vault row but no local cache yet can still generate.
    const freshKey = await revealFreshNativeKey(defaultProvider.credentialId)
    if (!freshKey && !defaultProvider.localApiKey && defaultProvider.type !== 'ollama' && defaultProvider.type !== 'local') {
      throw new Error('API key needs to be entered. Go to Settings > AI Providers and add your key.')
    }
    // localApiKey is AES-GCM-WRAPPED (see secureKeyStore). Unwrap it before
    // handing it to the AI client — otherwise the ciphertext is sent as
    // x-api-key and the provider returns "invalid x-api-key". (The settings
    // Test button already unwraps, which is why testing passes but generation
    // failed.) readKey() passes legacy plaintext keys through unchanged.
    const apiKey = freshKey
      ?? (defaultProvider.localApiKey
        ? (await readKey(defaultProvider.localApiKey)) || undefined
        : undefined)
    return {
      type: defaultProvider.type,
      apiKey,
      baseUrl: defaultProvider.baseUrl,
      selectedModelId: (defaultProvider.type === 'ollama' || defaultProvider.type === 'local') ? undefined : defaultProvider.selectedModelId
    }
  }

  // Web: use server vault credential ID. Cloud providers may run WITHOUT
  // local wiring — the server falls back to the account's most recent
  // credential for the provider (AER-79) and 404s with the actionable
  // "add a key" message if the vault is empty. Only on-device runtimes
  // still need explicit local config.
  const serverResolvable = ['anthropic', 'openai', 'openrouter', 'custom'].includes(defaultProvider.type)
  if (!defaultProvider.credentialId && defaultProvider.type !== 'ollama' && !serverResolvable) {
    throw new Error('No API key configured for the selected provider. Please add one in Settings.')
  }

  return {
    type: defaultProvider.type,
    credentialId: defaultProvider.credentialId || undefined,
    baseUrl: defaultProvider.baseUrl,
    selectedModelId: defaultProvider.type === 'ollama' ? undefined : defaultProvider.selectedModelId
  }
}
