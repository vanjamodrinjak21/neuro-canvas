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
   * Google sign-in for the Tauri desktop shell. Never leaves the app.
   *
   * Pattern:
   *   1. Generate PKCE verifier + SHA-256 challenge.
   *   2. Open a child WebviewWindow at Google's OAuth URL with a normal Safari
   *      User-Agent (Google blocks obvious embedded webviews).
   *   3. Poll the child window's URL until it lands on the loopback redirect
   *      with `?code=...`. Validate `state`, extract the code, close the window.
   *   4. POST { code, codeVerifier, redirectUri } to /api/auth/desktop-google
   *      via the Tauri HTTP plugin so the next-auth session cookie lands in
   *      the native cookie jar (matches loginWithCredentials).
   *   5. Fetch /api/auth/session to confirm + persist the user locally.
   */
  async function loginWithGoogle(): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      throw new Error('Google desktop sign-in requires the Tauri shell.')
    }

    const config = useRuntimeConfig()
    const clientId = (config.public as Record<string, string>).googleDesktopClientId || ''
    if (!clientId) {
      throw new Error('GOOGLE_DESKTOP_CLIENT_ID is not configured on the server.')
    }

    _isLoggingIn.value = true
    _loginError.value = null

    let authWindow: { close: () => Promise<void> } | null = null

    try {
      // PKCE — verifier (43-128 url-safe chars), challenge = base64url(sha256(verifier)).
      const base64Url = (bytes: Uint8Array) => {
        let s = ''
        for (const b of bytes) s += String.fromCharCode(b)
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      }
      const verifierBytes = new Uint8Array(32)
      crypto.getRandomValues(verifierBytes)
      const codeVerifier = base64Url(verifierBytes)
      const challengeBytes = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)),
      )
      const codeChallenge = base64Url(challengeBytes)
      const stateBytes = new Uint8Array(16)
      crypto.getRandomValues(stateBytes)
      const state = base64Url(stateBytes)

      // Fixed loopback port (Google's web client treats any localhost port
      // as a valid redirect, but pinning one means we don't need to register
      // dynamic ports). The window never actually loads the localhost page —
      // we intercept the navigation before that happens.
      const redirectUri = 'http://localhost:53782/auth/desktop-callback'

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        access_type: 'offline',
        prompt: 'select_account',
      })
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const desktopUserAgent
        = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 '
          + '(KHTML, like Gecko) Version/17.5 Safari/605.1.15'

      authWindow = new WebviewWindow(`nc-google-auth-${Date.now()}`, {
        url: authUrl,
        title: 'Sign in to NeuroCanvas',
        width: 480,
        height: 720,
        resizable: false,
        center: true,
        focus: true,
        userAgent: desktopUserAgent,
      })

      // Wait for the child window to navigate to our redirect URI; pull `code`.
      const code: string = await new Promise<string>((resolve, reject) => {
        let settled = false
        const cleanup = () => {
          settled = true
          clearInterval(poll)
          clearTimeout(timer)
        }
        const timer = setTimeout(() => {
          if (!settled) {
            cleanup()
            reject(new Error('Sign-in timed out.'))
          }
        }, 5 * 60 * 1000)
        const poll = setInterval(async () => {
          if (settled || !authWindow) return
          try {
            const w = authWindow as unknown as { url: () => Promise<URL | string> }
            const current = await w.url()
            if (!current) return
            const u = new URL(current.toString())
            if (u.origin === 'http://localhost:53782' && u.pathname === '/auth/desktop-callback') {
              const err = u.searchParams.get('error')
              if (err) { cleanup(); reject(new Error(`Google: ${err}`)); return }
              const returnedState = u.searchParams.get('state')
              const returnedCode = u.searchParams.get('code')
              if (returnedState !== state || !returnedCode) {
                cleanup(); reject(new Error('OAuth state mismatch.')); return
              }
              cleanup()
              resolve(returnedCode)
            }
          } catch {
            // Window closed by user or url() failed → cancel.
            if (!settled) { cleanup(); reject(new Error('Sign-in cancelled.')) }
          }
        }, 250)
      })

      // Hand the code to our backend through the Tauri HTTP plugin so the
      // session cookie lands in the same native cookie jar as the rest of
      // the desktop app's authenticated requests.
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const exchangeRes = await tauriFetch(`${AUTH_BASE_URL}/api/auth/desktop-google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier, redirectUri }),
      })
      if (!exchangeRes.ok) {
        const text = await exchangeRes.text().catch(() => '')
        throw new Error(`Sign-in rejected by server: ${exchangeRes.status} ${text}`.trim())
      }

      // Confirm via session endpoint and persist the user locally.
      const sessionRes = await tauriFetch(`${AUTH_BASE_URL}/api/auth/session`, { method: 'GET' })
      const sessionData = await sessionRes.json() as { user?: { id?: string; name?: string; email?: string; image?: string } }
      if (!sessionData?.user?.email) {
        throw new Error('Sign-in completed but no session was returned.')
      }

      localStorage.setItem('nc-desktop-session', JSON.stringify({
        version: 2,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
        provider: 'google',
      }))

      _user.value = sessionData.user
      _isSignedIn.value = true
      _showAuthModal.value = false
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed.'
      _loginError.value = msg
      throw e
    } finally {
      try { await authWindow?.close() } catch {}
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
    loginWithGoogle,
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
