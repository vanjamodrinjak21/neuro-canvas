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
import { encrypt, decrypt, generateSessionPassphrase } from '~/utils/crypto'
import { useDatabase } from '~/composables/useDatabase'
import { useCredentialVault } from '~/composables/useCredentialVault'
import { aiTestConnection } from '~/utils/aiClient'

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// Shared state across all instances
const state = reactive<{
  settings: AISettings
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  decryptedKeys: Map<string, string> // In-memory decrypted keys
}>({
  settings: { ...DEFAULT_AI_SETTINGS, updatedAt: Date.now() },
  isLoading: false,
  isInitialized: false,
  error: null,
  decryptedKeys: new Map()
})

// Module-scoped KEK cache — persists across all useAISettings() instances
let _kekPassphrase: string | null = null
let _kekFetched = false
let _migrationResult: { migrated: number; failed: string[] } | null = null

export function useAISettings() {
  const db = useDatabase()
  const vault = useCredentialVault()

  // In Tauri mode, provide a stable mock session (no auth server available)
  const _tauriSession = {
    user: { id: 'desktop-user', email: 'desktop@neurocanvas.local', name: 'Desktop User' }
  }
  const { data: _sessionData } = _isTauri()
    ? { data: ref(_tauriSession) }
    : useAuth()
  const session = _sessionData ?? ref(null)

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
   * Get the passphrase for encryption — tries KEK first, falls back to old pattern
   */
  function getPassphrase(): string | null {
    // If we've already fetched KEK, use it
    if (_kekPassphrase) return _kekPassphrase

    const user = session.value?.user
    if (!user?.email) {
      console.warn('getPassphrase: No user email available', { session: session.value, user })
      return null
    }
    const id = (user as { id?: string }).id || user.email
    return generateSessionPassphrase(id, user.email)
  }

  /**
   * Fetch KEK from server and re-encrypt existing secrets (one-time migration).
   * Returns migration results for tracking.
   */
  async function migrateToKEK(): Promise<{ migrated: number; failed: string[] }> {
    const result = { migrated: 0, failed: [] as string[] }
    if (_kekFetched || !vault.isVaultAvailable.value) return result
    _kekFetched = true

    try {
      const kek = await vault.fetchKEK()
      if (!kek) return result

      const oldPassphrase = getPassphrase()
      if (!oldPassphrase || oldPassphrase === kek) {
        _kekPassphrase = kek
        return result
      }

      // Re-encrypt all existing secrets with the new KEK
      for (const provider of state.settings.providers) {
        const secretData = await db.getSecretWithVersion(provider.id)
        if (!secretData) continue
        // Skip already-migrated secrets
        if (secretData.encryptionVersion >= 2) continue

        try {
          // Decrypt with old passphrase
          const plainKey = await decrypt(secretData.encryptedValue, oldPassphrase)
          // Re-encrypt with KEK
          const reEncrypted = await encrypt(plainKey, kek)
          await db.saveSecret(provider.id, reEncrypted, 2)
          // Sync to vault with version 2
          await vault.syncToVault(provider.type, reEncrypted, plainKey.slice(0, 8), provider.id, 2)
          result.migrated++
        } catch {
          result.failed.push(provider.id)
        }
      }

      _kekPassphrase = kek
      _migrationResult = result
    } catch {
      // KEK fetch failed — continue with old passphrase
    }
    return result
  }

  /**
   * Initialize settings from database
   */
  async function initialize(): Promise<void> {
    if (state.isInitialized) return

    state.isLoading = true
    state.error = null

    try {
      const settings = await db.getAISettings()
      state.settings = settings

      // Create default persona if none exist
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

      // Attempt KEK migration in background (no-op if vault unavailable)
      migrateToKEK().then((result) => {
        if (result.failed.length > 0) {
          console.warn('KEK migration: failed to migrate credentials:', result.failed)
        }
      }).catch(() => {})
    } catch (e) {
      state.error = e instanceof Error ? e.message : 'Failed to load AI settings'
      console.error('Failed to initialize AI settings:', e)
    } finally {
      state.isLoading = false
    }
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
   * Add a new provider
   */
  async function addProvider(
    type: AIProviderType,
    name?: string,
    apiKey?: string,
    baseUrl?: string
  ): Promise<AIProviderConfig> {
    const template = PROVIDER_TEMPLATES[type]
    const id = generateId()

    const provider: AIProviderConfig = {
      id,
      type,
      name: name || template.name || type,
      baseUrl: baseUrl || template.baseUrl,
      models: [...(template.models || [])],
      selectedModelId: template.models?.[0]?.id,
      isEnabled: true,
      isDefault: state.settings.providers.length === 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    // Encrypt and store API key if provided
    if (apiKey) {
      // Ensure KEK is loaded before encrypting
      if (!_kekPassphrase && vault.isVaultAvailable.value) {
        const kek = await vault.fetchKEK()
        if (kek) _kekPassphrase = kek
      }
      const passphrase = _kekPassphrase || getPassphrase()
      if (!passphrase) {
        console.error('Cannot save API key: No user session available')
        throw new Error('Unable to save API key - please ensure you are signed in')
      }
      const encryptedKey = await encrypt(apiKey, passphrase)
      await db.saveSecret(id, encryptedKey, 2)
      state.decryptedKeys.set(id, apiKey)

      // Web only: sync encrypted key to server vault for server-side decrypt
      if (vault.isVaultAvailable.value) {
        try {
          const result: { ok: boolean; credential?: { id: string } } = await ($fetch as any)('/api/vault/credentials', {
            method: 'POST',
            body: {
              provider: type,
              encryptedValue: encryptedKey,
              keyPrefix: apiKey.slice(0, 8),
              label: id,
              encryptionVersion: 2
            }
          })
          if (result.ok && result.credential) {
            provider.credentialId = result.credential.id
          }
        } catch (err) {
          console.error('Failed to sync key to vault:', err)
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
   * Also stores locally for offline/Tauri use.
   */
  async function updateProviderApiKey(id: string, apiKey: string): Promise<void> {
    // Cache in memory immediately
    state.decryptedKeys.set(id, apiKey)

    // Local storage (for Tauri/offline): encrypt with KEK or legacy passphrase
    try {
      if (!_kekPassphrase && vault.isVaultAvailable.value) {
        const kek = await vault.fetchKEK()
        if (kek) _kekPassphrase = kek
      }
      const passphrase = _kekPassphrase || getPassphrase()
      if (passphrase) {
        const encryptedKey = await encrypt(apiKey, passphrase)
        await db.saveSecret(id, encryptedKey, 2)
      }
    } catch {
      // Local storage is best-effort; server vault is the source of truth
    }

    // Web: send raw key to server vault (server-only encryption v4)
    const provider = state.settings.providers.find(p => p.id === id)
    if (vault.isVaultAvailable.value && provider) {
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
        console.error('Failed to sync key to vault:', err)
      }
    }

    await updateProvider(id, { updatedAt: Date.now() })
  }

  /**
   * Get decrypted API key for a provider.
   * Uses encryptionVersion to choose passphrase instead of blind try/catch.
   */
  async function getProviderApiKey(id: string): Promise<string | null> {
    // Check in-memory cache first
    if (state.decryptedKeys.has(id)) {
      return state.decryptedKeys.get(id) || null
    }

    try {
      const secretData = await db.getSecretWithVersion(id)
      if (!secretData) return null

      const { encryptedValue, encryptionVersion } = secretData

      // Ensure KEK is loaded from vault if not yet cached
      if (!_kekPassphrase && vault.isVaultAvailable.value) {
        const kek = await vault.fetchKEK()
        if (kek) _kekPassphrase = kek
      }

      // Version 2+: use KEK
      if (encryptionVersion >= 2 && _kekPassphrase) {
        try {
          const decrypted = await decrypt(encryptedValue, _kekPassphrase)
          state.decryptedKeys.set(id, decrypted)
          return decrypted
        } catch {
          // KEK failed on a v2+ secret — unexpected, fall through to legacy as last resort
        }
      }

      // Version 1 (legacy) or KEK failed: try legacy passphrase
      const user = session.value?.user
      if (user?.email) {
        const uid = (user as { id?: string }).id || user.email
        const legacyPassphrase = generateSessionPassphrase(uid, user.email)
        try {
          const decrypted = await decrypt(encryptedValue, legacyPassphrase)
          state.decryptedKeys.set(id, decrypted)
          return decrypted
        } catch {
          // Legacy passphrase also failed
        }
      }

      console.error('Failed to decrypt API key: no valid passphrase')
      return null
    } catch (e) {
      console.error('Failed to decrypt API key:', e)
      return null
    }
  }

  /**
   * Get count of credentials still on legacy encryption (version 1)
   */
  async function getUnmigratedCount(): Promise<number> {
    let count = 0
    for (const provider of state.settings.providers) {
      const secretData = await db.getSecretWithVersion(provider.id)
      if (secretData && (secretData.encryptionVersion ?? 1) < 2) {
        count++
      }
    }
    return count
  }

  /**
   * Get the last migration result (from migrateToKEK)
   */
  function getMigrationResult(): { migrated: number; failed: string[] } | null {
    return _migrationResult
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
    if (state.decryptedKeys.has(id)) return true
    const encryptedKey = await db.getSecret(id)
    return !!encryptedKey
  }

  /**
   * Delete a provider
   */
  async function deleteProvider(id: string): Promise<void> {
    const index = state.settings.providers.findIndex(p => p.id === id)
    if (index === -1) return

    // Delete API key
    await db.deleteSecret(id)
    state.decryptedKeys.delete(id)

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
      apiKey = testApiKey || await getProviderApiKey(providerIdOrConfig)
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

      const result = await aiTestConnection({
        provider: provider.type,
        apiKey,
        credentialId: credentialId || undefined,
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
    await db.clearAllSecrets()
    state.decryptedKeys.clear()
  }

  /**
   * Reset to defaults
   */
  async function reset(): Promise<void> {
    state.settings = { ...DEFAULT_AI_SETTINGS, updatedAt: Date.now() }
    await clearAllSecrets()
    await save()
    state.isInitialized = false
    _kekPassphrase = null
    _kekFetched = false
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
    save,

    // Provider actions
    addProvider,
    updateProvider,
    updateProviderApiKey,
    getProviderApiKey,
    getProviderCredentialId,
    hasProviderApiKey,
    getUnmigratedCount,
    getMigrationResult,
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
