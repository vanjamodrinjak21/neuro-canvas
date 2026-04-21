/**
 * Desktop Auth — Singleton shared state
 *
 * Uses module-level state so all components share the same auth state.
 * Authenticates via Tauri HTTP plugin (native HTTP client with its own cookie jar)
 * to bypass SameSite cookie restrictions that block cross-origin browser fetch.
 */

const AUTH_BASE_URL = 'https://neuro-canvas.com'

// Module-level shared state (singleton across all callers)
const _showAuthModal = ref(false)
const _isSignedIn = ref(false)
const _initialized = ref(false)
const _isLoggingIn = ref(false)
const _loginError = ref<string | null>(null)
const _user = ref<{ id?: string; name?: string; email?: string; image?: string } | null>(null)

export function useDesktopAuth() {
  // Initialize from localStorage once
  if (!_initialized.value && typeof window !== 'undefined') {
    _initialized.value = true
    const stored = localStorage.getItem('nc-desktop-session')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.version === 2) {
          _isSignedIn.value = true
          _user.value = data.user || null
        } else {
          localStorage.removeItem('nc-desktop-session')
        }
      } catch {
        localStorage.removeItem('nc-desktop-session')
      }
    }
  }

  function signIn() {
    _loginError.value = null
    _showAuthModal.value = true
  }

  function completeSignIn() {
    const stored = localStorage.getItem('nc-desktop-session')
    if (stored) {
      try {
        const data = JSON.parse(stored)
        _user.value = data.user || null
      } catch {}
    }
    _isSignedIn.value = true
    _showAuthModal.value = false
    _loginError.value = null
  }

  function closeAuthModal() {
    _showAuthModal.value = false
    _loginError.value = null
  }

  /**
   * Authenticate with email/password using Tauri's native HTTP plugin.
   * The native HTTP client has its own cookie jar and doesn't enforce
   * SameSite restrictions, so it can handle next-auth's cookie-based flow.
   */
  async function loginWithCredentials(email: string, password: string, totpCode?: string) {
    _isLoggingIn.value = true
    _loginError.value = null

    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')

      // Step 1: Get CSRF token from next-auth
      const csrfRes = await tauriFetch(`${AUTH_BASE_URL}/api/auth/csrf`, {
        method: 'GET',
      })
      if (!csrfRes.ok) {
        throw new Error('Failed to connect to server. Check your internet connection.')
      }
      const csrfData = await csrfRes.json() as { csrfToken: string }
      const csrfToken = csrfData.csrfToken
      if (!csrfToken) {
        throw new Error('Server did not return a CSRF token.')
      }

      // Step 2: POST credentials to next-auth callback
      const params = new URLSearchParams()
      params.set('csrfToken', csrfToken)
      params.set('email', email)
      params.set('password', password)
      params.set('json', 'true')
      if (totpCode) {
        params.set('totpCode', totpCode)
      }

      const authRes = await tauriFetch(`${AUTH_BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        // Follow redirects to get the final response
        redirect: 'follow',
      })

      // next-auth returns a JSON response with { url } when json=true
      // If login fails, the URL will contain ?error=
      if (authRes.ok) {
        const authBody = await authRes.text()
        try {
          const authJson = JSON.parse(authBody)
          if (authJson.url && authJson.url.includes('error=')) {
            const errorParam = new URL(authJson.url).searchParams.get('error')
            throw new Error(mapAuthError(errorParam || 'Unknown'))
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input' && !e.message.startsWith('Failed') && !e.message.startsWith('Invalid')) {
            throw e
          }
          // If not JSON, the redirect was followed — check session next
        }
      }

      // Step 3: Fetch session from next-auth (cookie is in the HTTP plugin's jar now)
      const sessionRes = await tauriFetch(`${AUTH_BASE_URL}/api/auth/session`, {
        method: 'GET',
      })
      if (!sessionRes.ok) {
        throw new Error('Failed to verify sign-in. Please try again.')
      }
      const sessionData = await sessionRes.json() as { user?: { id?: string; name?: string; email?: string; image?: string } }

      if (!sessionData?.user?.email) {
        throw new Error('Invalid email or password.')
      }

      // Step 4: Store session locally and complete sign-in
      localStorage.setItem('nc-desktop-session', JSON.stringify({
        version: 2,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
      }))

      _user.value = sessionData.user
      _isSignedIn.value = true
      _showAuthModal.value = false
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
      _loginError.value = msg
      throw e
    } finally {
      _isLoggingIn.value = false
    }
  }

  /**
   * Make an authenticated fetch to the remote server using the Tauri HTTP plugin.
   * Uses the native HTTP client's cookie jar (set during loginWithCredentials).
   */
  async function remoteFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    const url = path.startsWith('http') ? path : `${AUTH_BASE_URL}${path}`
    const res = await tauriFetch(url, options)
    if (!res.ok) {
      throw new Error(`Remote fetch failed: ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  function signOut() {
    localStorage.removeItem('nc-desktop-session')
    _isSignedIn.value = false
    _user.value = null
    _loginError.value = null
  }

  return {
    showAuthModal: readonly(_showAuthModal),
    isSignedIn: readonly(_isSignedIn),
    isLoggingIn: readonly(_isLoggingIn),
    loginError: readonly(_loginError),
    user: readonly(_user),
    authBaseUrl: AUTH_BASE_URL,
    signIn,
    completeSignIn,
    closeAuthModal,
    loginWithCredentials,
    remoteFetch,
    signOut,
  }
}

function mapAuthError(error: string): string {
  switch (error) {
    case 'CredentialsSignin':
      return 'Invalid email or password.'
    case 'TOTP_REQUIRED':
      return 'Two-factor authentication code required.'
    default:
      if (error.includes('Invalid email or password')) return error
      if (error.includes('TOTP')) return 'Invalid two-factor code.'
      return `Sign-in failed: ${error}`
  }
}
