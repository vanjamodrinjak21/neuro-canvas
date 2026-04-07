function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

export function useCredentialVault() {
  // Auth check
  const _tauriSession = _isTauri() ? { user: null } : null
  const { data: _sessionData } = _tauriSession
    ? { data: ref(_tauriSession) }
    : useAuth()
  const session = _sessionData ?? ref(null)

  const isVaultAvailable = computed(() => {
    return !!session.value?.user && !_isTauri()
  })

  return {
    isVaultAvailable
  }
}
