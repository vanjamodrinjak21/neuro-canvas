/**
 * Desktop Auth — Singleton shared state
 *
 * Uses module-level state so all components share the same auth state.
 */

const AUTH_BASE_URL = 'https://neuro-canvas.com'

// Module-level shared state (singleton across all callers)
const _showAuthModal = ref(false)
const _isSignedIn = ref(false)
const _initialized = ref(false)

export function useDesktopAuth() {
  // Initialize from localStorage once
  // Clear stale sessions from previous builds that faked sign-in
  if (!_initialized.value && typeof window !== 'undefined') {
    _initialized.value = true
    // v2: clear all sessions from pre-v2 builds
    const stored = localStorage.getItem('nc-desktop-session')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.version === 2) {
          _isSignedIn.value = true
        } else {
          // Old format — clear it
          localStorage.removeItem('nc-desktop-session')
        }
      } catch {
        localStorage.removeItem('nc-desktop-session')
      }
    }
  }

  function signIn() {
    _showAuthModal.value = true
  }

  function completeSignIn() {
    localStorage.setItem('nc-desktop-session', JSON.stringify({
      version: 2,
      origin: AUTH_BASE_URL,
      authenticatedAt: Date.now()
    }))
    _isSignedIn.value = true
    _showAuthModal.value = false
  }

  function closeAuthModal() {
    _showAuthModal.value = false
  }

  function signOut() {
    localStorage.removeItem('nc-desktop-session')
    _isSignedIn.value = false
  }

  return {
    showAuthModal: readonly(_showAuthModal),
    isSignedIn: readonly(_isSignedIn),
    authUrl: `${AUTH_BASE_URL}/auth/signin`,
    signIn,
    completeSignIn,
    closeAuthModal,
    signOut
  }
}
