import { encrypt, decrypt } from '~/utils/crypto'
import { useDatabase } from '~/composables/useDatabase'

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// In-memory KEK cache (never persisted to disk)
let _kek: string | null = null

export function useCredentialVault() {
  const db = useDatabase()

  // Auth check
  const _tauriSession = _isTauri() ? { user: null } : null
  const { data: _sessionData } = _tauriSession
    ? { data: ref(_tauriSession) }
    : useAuth()
  const session = _sessionData ?? ref(null)

  const isVaultAvailable = computed(() => {
    return !!session.value?.user && !_isTauri()
  })

  /**
   * Fetch the per-user KEK from server (cached in memory)
   */
  async function fetchKEK(): Promise<string | null> {
    if (_kek) return _kek
    if (!isVaultAvailable.value) return null

    try {
      const response: { kek: string } = await ($fetch as any)('/api/vault/kek')
      _kek = response.kek
      return _kek
    } catch {
      return null
    }
  }

  /**
   * Encrypt an API key using the server-derived KEK
   */
  async function encryptApiKey(apiKey: string): Promise<string | null> {
    const kek = await fetchKEK()
    if (!kek) return null
    return encrypt(apiKey, kek)
  }

  /**
   * Decrypt an API key using the server-derived KEK
   */
  async function decryptApiKey(encryptedValue: string): Promise<string | null> {
    const kek = await fetchKEK()
    if (!kek) return null
    try {
      return await decrypt(encryptedValue, kek)
    } catch {
      return null
    }
  }

  /**
   * Sync an encrypted credential to the server vault
   */
  async function syncToVault(provider: string, encryptedValue: string, keyPrefix?: string, label?: string): Promise<void> {
    if (!isVaultAvailable.value) return

    try {
      await ($fetch as any)('/api/vault/credentials', {
        method: 'POST',
        body: { provider, encryptedValue, keyPrefix, label }
      })
    } catch (err) {
      console.error('Failed to sync credential to vault:', err)
    }
  }

  /**
   * Restore credentials from vault to local Dexie secrets table
   */
  async function restoreFromVault(): Promise<number> {
    if (!isVaultAvailable.value) return 0

    try {
      const response: { credentials: Array<{ id: string; provider: string; label: string | null }> } =
        await ($fetch as any)('/api/vault/credentials')

      let restored = 0
      for (const cred of response.credentials) {
        // Fetch the full encrypted value
        const detail: { encryptedValue: string } = await ($fetch as any)(`/api/vault/credentials/${cred.id}`)
        if (detail.encryptedValue) {
          // Store in local Dexie under provider ID
          const localId = cred.label || cred.provider
          await db.saveSecret(localId, detail.encryptedValue)
          restored++
        }
      }
      return restored
    } catch {
      return 0
    }
  }

  /**
   * Clear in-memory KEK (e.g., on sign out)
   */
  function clearKEK(): void {
    _kek = null
  }

  return {
    isVaultAvailable,
    fetchKEK,
    encryptApiKey,
    decryptApiKey,
    syncToVault,
    restoreFromVault,
    clearKEK
  }
}
