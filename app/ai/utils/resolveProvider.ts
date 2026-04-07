import { useAISettings } from '~/composables/useAISettings'

export interface ResolvedProvider {
  type: string
  credentialId?: string
  baseUrl?: string
  selectedModelId?: string
}

/**
 * Resolve the default AI provider config.
 * Server handles all key decryption — client just passes credentialId.
 */
export async function resolveProvider(): Promise<ResolvedProvider> {
  const aiSettings = useAISettings()

  // Ensure AI settings are loaded from IndexedDB
  if (!aiSettings.isInitialized.value) {
    await aiSettings.initialize()
  }

  const defaultProvider = aiSettings.defaultProvider.value

  if (!defaultProvider?.isEnabled) {
    throw new Error('No AI provider configured. Please configure an AI provider in settings.')
  }

  if (!defaultProvider.credentialId && defaultProvider.type !== 'ollama') {
    throw new Error('No API key configured for the selected provider. Please add one in Settings.')
  }

  return {
    type: defaultProvider.type,
    credentialId: defaultProvider.credentialId || undefined,
    baseUrl: defaultProvider.baseUrl,
    selectedModelId: defaultProvider.selectedModelId
  }
}
