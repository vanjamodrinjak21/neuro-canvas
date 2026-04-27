/**
 * Mobile Auth — Singleton shared state for Capacitor (iOS/Android)
 *
 * Uses Capacitor's native HTTP (CapacitorHttp) to bypass CORS restrictions
 * in WKWebView/Android WebView. The native HTTP layer has its own cookie jar
 * and doesn't enforce same-origin policy, similar to Tauri's HTTP plugin.
 * Session is stored in localStorage for persistence across app launches.
 */

const AUTH_BASE_URL = 'https://neuro-canvas.com'
const STORAGE_KEY = 'nc-mobile-session'

// Module-level shared state (singleton across all callers)
const _isSignedIn = ref(false)
const _initialized = ref(false)
const _isLoggingIn = ref(false)
const _loginError = ref<string | null>(null)
const _user = ref<{ id?: string; name?: string; email?: string; image?: string } | null>(null)

export function useMobileAuth() {
  // Initialize from localStorage once
  if (!_initialized.value && typeof window !== 'undefined') {
    _initialized.value = true
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        if (data.version === 1 && data.user?.email) {
          _isSignedIn.value = true
          _user.value = data.user
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }

  /**
   * Authenticate with email/password via native HTTP calls.
   * Uses CapacitorHttp to bypass CORS restrictions in the WebView.
   */
  async function loginWithCredentials(email: string, password: string, totpCode?: string): Promise<void> {
    _isLoggingIn.value = true
    _loginError.value = null

    try {
      const { CapacitorHttp } = await import('@capacitor/core')

      // Step 1: Get CSRF token
      const csrfRes = await CapacitorHttp.get({
        url: `${AUTH_BASE_URL}/api/auth/csrf`,
      })
      if (csrfRes.status !== 200) {
        throw new Error('Failed to connect to server. Check your internet connection.')
      }
      const csrfToken = csrfRes.data?.csrfToken
      if (!csrfToken) {
        throw new Error('Server did not return a CSRF token.')
      }

      // Step 2: POST credentials
      const params = new URLSearchParams()
      params.set('csrfToken', csrfToken)
      params.set('email', email)
      params.set('password', password)
      params.set('json', 'true')
      if (totpCode) {
        params.set('totpCode', totpCode)
      }

      const authRes = await CapacitorHttp.post({
        url: `${AUTH_BASE_URL}/api/auth/callback/credentials`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: params.toString(),
      })

      // Check for error in response
      if (authRes.data) {
        const authData = typeof authRes.data === 'string' ? tryParseJSON(authRes.data) : authRes.data
        if (authData?.url && authData.url.includes('error=')) {
          const errorParam = new URL(authData.url).searchParams.get('error')
          throw new Error(mapAuthError(errorParam || 'Unknown'))
        }
      }

      // Step 3: Fetch session (cookies are in the native HTTP layer's jar)
      const sessionRes = await CapacitorHttp.get({
        url: `${AUTH_BASE_URL}/api/auth/session`,
      })
      if (sessionRes.status !== 200) {
        throw new Error('Failed to verify sign-in. Please try again.')
      }
      const sessionData = typeof sessionRes.data === 'string' ? tryParseJSON(sessionRes.data) : sessionRes.data

      if (!sessionData?.user?.email) {
        throw new Error('Invalid email or password.')
      }

      // Step 4: Store session locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
      }))

      _user.value = sessionData.user
      _isSignedIn.value = true
      _loginError.value = null
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
      _loginError.value = msg
      throw e
    } finally {
      _isLoggingIn.value = false
    }
  }

  /**
   * Make an authenticated fetch to the remote server using native HTTP.
   */
  async function remoteFetch<T = unknown>(path: string, options?: { method?: string; headers?: Record<string, string>; data?: unknown }): Promise<T> {
    const { CapacitorHttp } = await import('@capacitor/core')
    const url = path.startsWith('http') ? path : `${AUTH_BASE_URL}${path}`
    const res = await CapacitorHttp.request({
      url,
      method: options?.method || 'GET',
      headers: options?.headers,
      data: options?.data,
    })
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Remote fetch failed: ${res.status}`)
    }
    return (typeof res.data === 'string' ? tryParseJSON(res.data) : res.data) as T
  }

  /**
   * OAuth sign-in via in-app browser (Google, GitHub, Apple).
   * Opens the OAuth flow in an in-app browser overlay, polls for the session
   * cookie, and auto-closes the browser once authenticated.
   */
  async function loginWithOAuth(provider: 'google' | 'github' | 'apple'): Promise<void> {
    _isLoggingIn.value = true
    _loginError.value = null

    try {
      const { Browser } = await import('@capacitor/browser')
      const { App } = await import('@capacitor/app')

      // Open the web signin page with ?auto={provider} to auto-trigger OAuth.
      // The callbackUrl points to /auth/mobile-callback which reads the session
      // and redirects to neurocanvas://auth/callback?session=base64data.
      // This brings the user back to the app via custom URL scheme.
      const callbackUrl = `${AUTH_BASE_URL}/auth/mobile-callback`
      await Browser.open({
        url: `${AUTH_BASE_URL}/auth/signin?auto=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        presentationStyle: 'popover',
      })

      // Listen for the custom URL scheme callback from the mobile-callback page.
      // The callback contains user data AND the JWT session cookie, which we
      // set in CapacitorHttp's cookie jar so sync API calls are authenticated.
      const sessionData = await new Promise<{ user: { id?: string; name?: string; email?: string; image?: string } }>((resolve, reject) => {
        let browserClosed = false

        const urlListener = App.addListener('appUrlOpen', async (event) => {
          try {
            const url = new URL(event.url)
            if (url.host === 'auth' && url.pathname === '/callback') {
              const sessionParam = url.searchParams.get('session')
              if (sessionParam) {
                const callbackData = JSON.parse(atob(sessionParam))
                urlListener.then(l => l.remove())
                browserListener.then(l => l.remove())
                Browser.close().catch(() => {})

                // Set the JWT cookie in CapacitorHttp's native cookie jar
                // so sync API calls are authenticated
                if (callbackData.token && callbackData.cookieName) {
                  try {
                    const { CapacitorCookies } = await import('@capacitor/core')
                    await CapacitorCookies.setCookie({
                      url: AUTH_BASE_URL,
                      key: callbackData.cookieName,
                      value: callbackData.token,
                      path: '/',
                      expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toUTCString(), // 6h like server
                    })
                  } catch {}
                }

                resolve({ user: callbackData.user })
                return
              }
            }
          } catch {}
          urlListener.then(l => l.remove())
          browserListener.then(l => l.remove())
          reject(new Error('Invalid callback data.'))
        })

        const browserListener = Browser.addListener('browserFinished', () => {
          browserClosed = true
          // Give a moment for the URL event to fire (it might come after browserFinished)
          setTimeout(() => {
            if (browserClosed) {
              urlListener.then(l => l.remove())
              browserListener.then(l => l.remove())
              reject(new Error('Sign-in was cancelled.'))
            }
          }, 1000)
        })

        // Timeout after 2 minutes
        setTimeout(() => {
          urlListener.then(l => l.remove())
          browserListener.then(l => l.remove())
          Browser.close().catch(() => {})
          reject(new Error('Sign-in timed out. Please try again.'))
        }, 120000)
      })

      // Step 5: Store session locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
      }))

      _user.value = sessionData.user
      _isSignedIn.value = true
      _loginError.value = null
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
      _loginError.value = msg
      throw e
    } finally {
      _isLoggingIn.value = false
    }
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY)
    _isSignedIn.value = false
    _user.value = null
    _loginError.value = null
  }

  return {
    isSignedIn: readonly(_isSignedIn),
    isLoggingIn: readonly(_isLoggingIn),
    loginError: readonly(_loginError),
    user: readonly(_user),
    authBaseUrl: AUTH_BASE_URL,
    loginWithCredentials,
    loginWithOAuth,
    remoteFetch,
    signOut,
  }
}

function tryParseJSON(str: string): any {
  try { return JSON.parse(str) } catch { return null }
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
