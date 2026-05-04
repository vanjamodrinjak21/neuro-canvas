import { useAISettings } from '~/composables/useAISettings'
import { useGuestMode } from '~/composables/useGuestMode'

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
    if (!defaultProvider.localApiKey && defaultProvider.type !== 'ollama' && defaultProvider.type !== 'local') {
      throw new Error('API key needs to be entered. Go to Settings > AI Providers and add your key.')
    }
    return {
      type: defaultProvider.type,
      apiKey: defaultProvider.localApiKey || undefined,
      baseUrl: defaultProvider.baseUrl,
      selectedModelId: (defaultProvider.type === 'ollama' || defaultProvider.type === 'local') ? undefined : defaultProvider.selectedModelId
    }
  }

  // Web: use server vault credential ID
  if (!defaultProvider.credentialId && defaultProvider.type !== 'ollama') {
    throw new Error('No API key configured for the selected provider. Please add one in Settings.')
  }

  return {
    type: defaultProvider.type,
    credentialId: defaultProvider.credentialId || undefined,
    baseUrl: defaultProvider.baseUrl,
    selectedModelId: defaultProvider.type === 'ollama' ? undefined : defaultProvider.selectedModelId
  }
}
