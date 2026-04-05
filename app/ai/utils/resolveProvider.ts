// Extract provider resolution pattern repeated across useAI.ts

import { useAISettings } from '~/composables/useAISettings'

export interface ResolvedProvider {
  type: string
  apiKey: string
  credentialId?: string // Server vault credential ID (web only, for server-side decrypt)
  baseUrl?: string
  selectedModelId?: string
}

/**
 * Resolve the default AI provider and its API key.
 * On web: returns credentialId so server can decrypt from vault (key never leaves server).
 * On Tauri: returns decrypted apiKey for direct provider calls.
 * Throws descriptive errors if not configured.
 */
export async function resolveProvider(): Promise<ResolvedProvider> {
  const aiSettings = useAISettings()
  const defaultProvider = aiSettings.defaultProvider.value

  if (!defaultProvider?.isEnabled) {
    throw new Error('No AI provider configured. Please configure an AI provider in settings.')
  }

  // On web, prefer credentialId for server-side decryption (key never leaves server)
  const credentialId = aiSettings.getProviderCredentialId(defaultProvider.id)

  // Try client-side decrypt (may fail if KEK not loaded yet)
  const apiKey = await aiSettings.getProviderApiKey(defaultProvider.id)

  // Need at least one: credentialId (server decrypts) or apiKey (client decrypted)
  if (!apiKey && !credentialId) {
    throw new Error('No API key configured for the selected provider.')
  }

  return {
    type: defaultProvider.type,
    apiKey: apiKey || '',
    credentialId: credentialId || undefined,
    baseUrl: defaultProvider.baseUrl,
    selectedModelId: defaultProvider.selectedModelId
  }
}
