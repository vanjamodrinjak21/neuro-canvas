// Extract provider resolution pattern repeated across useAI.ts

import { useAISettings } from '~/composables/useAISettings'

export interface ResolvedProvider {
  type: string
  apiKey: string
  baseUrl?: string
  selectedModelId?: string
}

/**
 * Resolve the default AI provider and its API key.
 * Throws descriptive errors if not configured.
 */
export async function resolveProvider(): Promise<ResolvedProvider> {
  const aiSettings = useAISettings()
  const defaultProvider = aiSettings.defaultProvider.value

  if (!defaultProvider?.isEnabled) {
    throw new Error('No AI provider configured. Please configure an AI provider in settings.')
  }

  const apiKey = await aiSettings.getProviderApiKey(defaultProvider.id)
  if (!apiKey) {
    throw new Error('No API key configured for the selected provider.')
  }

  return {
    type: defaultProvider.type,
    apiKey,
    baseUrl: defaultProvider.baseUrl,
    selectedModelId: defaultProvider.selectedModelId
  }
}
