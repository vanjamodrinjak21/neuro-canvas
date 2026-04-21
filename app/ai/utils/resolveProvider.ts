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

/**
 * Resolve the default AI provider config.
 * Web: returns credentialId for server-side vault decryption.
 * Tauri: returns raw apiKey from local IndexedDB storage.
 */
export async function resolveProvider(): Promise<ResolvedProvider> {
  const guest = useGuestMode()
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

  // Tauri desktop: use locally stored API key
  if (_isTauri()) {
    if (!defaultProvider.localApiKey && defaultProvider.type !== 'ollama') {
      // Provider exists but key was stored in server vault (pre-desktop fix).
      // User needs to re-enter their key so it's stored locally.
      throw new Error('API key needs to be re-entered for desktop use. Go to Settings > AI Providers and update your API key.')
    }
    return {
      type: defaultProvider.type,
      apiKey: defaultProvider.localApiKey || undefined,
      baseUrl: defaultProvider.baseUrl,
      selectedModelId: defaultProvider.type === 'ollama' ? undefined : defaultProvider.selectedModelId
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
