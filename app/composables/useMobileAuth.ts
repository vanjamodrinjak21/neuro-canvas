/**
 * Mobile Auth — Singleton shared state for Capacitor (iOS/Android)
 *
 * Uses Capacitor's native HTTP (CapacitorHttp) to bypass CORS restrictions
 * in WKWebView/Android WebView. The native HTTP layer has its own cookie jar
 * and doesn't enforce same-origin policy, similar to Tauri's HTTP plugin.
 * Session is stored in localStorage for persistence across app launches.
 */
import { decodeMobileSessionPayload } from '~/utils/mobileSessionPayload'

const AUTH_BASE_URL = 'https://neuro-canvas.com'
const STORAGE_KEY = 'nc-mobile-session'

// Module-level shared state (singleton across all callers)
const _isSignedIn = ref(false)
const _initialized = ref(false)
const _isLoggingIn = ref(false)
const _loginError = ref<string | null>(null)
const _user = ref<{ id?: string; name?: string; email?: string; image?: string } | null>(null)

async function revalidateSession() {
  try {
    const { CapacitorHttp } = await import('@capacitor/core')
    // Attach the persisted JWT explicitly — the native cookie jar is
    // unreliable on iOS (the very reason remoteFetch sends the token itself).
    // A bare call here reported "signed out" for perfectly valid sessions and
    // wiped them, so login didn't survive an app restart (AER-102).
    let stored: { token?: string; cookieName?: string } | null = null
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    } catch { stored = null }
    const headers: Record<string, string> = {}
    if (stored?.token && stored?.cookieName) {
      headers.Cookie = `${stored.cookieName}=${stored.token}`
    }

    const res = await CapacitorHttp.get({ url: `${AUTH_BASE_URL}/api/auth/session`, headers })
    const sessionData = typeof res.data === 'string' ? tryParseJSON(res.data) : res.data
    if (sessionData?.user?.email) {
      _user.value = sessionData.user
      _isSignedIn.value = true
      // Spread the existing record FIRST: rewriting without token/cookieName
      // silently de-authenticated every later remoteFetch call (AER-102).
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...(stored || {}),
        version: 1,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
      }))
    } else if (headers.Cookie) {
      // The server rejected an explicitly attached token — the session is
      // genuinely dead (revoked/expired). Clear local state.
      _isSignedIn.value = false
      _user.value = null
      localStorage.removeItem(STORAGE_KEY)
    }
    // No token to attach and the cookie jar came up empty: inconclusive —
    // keep cached state (same policy as the network-failure path below)
    // rather than wiping a session we couldn't actually test.
  } catch {
    // Network failure — keep cached state so offline use still works.
  }
}

/**
 * Retry a deferred server-side logout revoke (AER-59 #5). If a previous
 * sign-out couldn't reach the server (offline/timeout), we stored the session
 * token in `nc-pending-logout-revoke`. On the next online launch we POST
 * /api/auth/logout with that Cookie header so the residual 30-day native JWT is
 * invalidated server-side, then clear the marker. Best-effort; never throws.
 */
async function retryPendingLogoutRevoke(): Promise<void> {
  if (typeof window === 'undefined') return
  let marker: { token?: string; cookieName?: string } | null = null
  try {
    const raw = localStorage.getItem('nc-pending-logout-revoke')
    if (!raw) return
    marker = JSON.parse(raw)
  } catch {
    // Malformed marker — drop it so we don't retry forever.
    try { localStorage.removeItem('nc-pending-logout-revoke') } catch { /* ignore */ }
    return
  }
  if (!marker?.token || !marker?.cookieName) {
    try { localStorage.removeItem('nc-pending-logout-revoke') } catch { /* ignore */ }
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  try {
    const { CapacitorHttp } = await import('@capacitor/core')
    await Promise.race([
      CapacitorHttp.post({
        url: `${AUTH_BASE_URL}/api/auth/logout`,
        headers: { Cookie: `${marker.cookieName}=${marker.token}` },
      }),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ])
  } catch {
    // Best-effort — leave the marker to retry next launch.
    return
  }

  try { localStorage.removeItem('nc-pending-logout-revoke') } catch { /* ignore */ }
}

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
    // Re-validate against server in the background so a stale/expired cookie
    // flips isSignedIn back to false and the sync engine watcher reacts.
    if ('Capacitor' in (window as any) && (window as any).Capacitor?.isNativePlatform?.()) {
      void revalidateSession()
      // Retry any deferred server-side logout revoke from a prior offline
      // sign-out (AER-59 #5). Best-effort; never blocks init.
      void retryPendingLogoutRevoke()
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

      // Step 4: Pull the raw JWT so we can attach it as an explicit Cookie
      // header on subsequent calls (CapacitorHttp's cookie jar is unreliable
      // across plugin/native boundaries on iOS).
      let token = ''
      let cookieName = ''
      try {
        const tokenRes = await CapacitorHttp.get({
          url: `${AUTH_BASE_URL}/api/auth/mobile-token`,
        })
        const tokenData = typeof tokenRes.data === 'string' ? tryParseJSON(tokenRes.data) : tokenRes.data
        if (tokenData?.token && tokenData?.cookieName) {
          token = tokenData.token
          cookieName = tokenData.cookieName
        }
      } catch { /* fall back to cookie-jar mode */ }

      // Step 5: Store session locally
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
        token,
        cookieName,
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
   * Create an account fully in-app via native HTTP (AER-106). App Review
   * rejects flows that bounce to the system browser to register, and the
   * relative $fetch the web signup page uses has no backend to hit on the
   * capacitor:// origin. CapacitorHttp doesn't throw on 4xx/5xx, so surface
   * the server's statusMessage (breached password, rate limit, validation)
   * instead of a generic failure.
   */
  async function registerWithCredentials(email: string, password: string, name?: string): Promise<void> {
    const { CapacitorHttp } = await import('@capacitor/core')
    const res = await CapacitorHttp.post({
      url: `${AUTH_BASE_URL}/api/auth/register`,
      headers: { 'Content-Type': 'application/json' },
      data: { email, password, ...(name ? { name } : {}) },
    })
    if (res.status < 200 || res.status >= 300) {
      const data = typeof res.data === 'string' ? tryParseJSON(res.data) : res.data
      throw new Error(data?.statusMessage || data?.message || 'Registration failed. Please try again.')
    }
  }

  /**
   * Make an authenticated fetch to the remote server using native HTTP.
   * Attaches the persisted JWT as an explicit Cookie header so authentication
   * does not depend on CapacitorHttp's native cookie jar (which is unreliable
   * for cookies set via CapacitorCookies/Set-Cookie boundary on iOS).
   */
  async function remoteFetch<T = unknown>(path: string, options?: { method?: string; headers?: Record<string, string>; data?: unknown }): Promise<T> {
    const { CapacitorHttp } = await import('@capacitor/core')
    const url = path.startsWith('http') ? path : `${AUTH_BASE_URL}${path}`

    const headers: Record<string, string> = { ...(options?.headers || {}) }
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data?.token && data?.cookieName) {
          // Don't clobber an explicit Cookie passed by the caller.
          if (!headers.Cookie && !headers.cookie) {
            headers.Cookie = `${data.cookieName}=${data.token}`
          }
        }
      }
    } catch { /* malformed localStorage — ignore */ }

    // CapacitorHttp only serialises `data` as JSON when the Content-Type says
    // so; without it the request reaches the server without application/json
    // and the CSRF middleware rejects it with 403 (AER-101). Default the type
    // for any payload-carrying call unless the caller set one explicitly.
    if (options?.data !== undefined
      && !Object.keys(headers).some(h => h.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }

    const res = await CapacitorHttp.request({
      url,
      method: options?.method || 'GET',
      headers,
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
      const sessionData = await new Promise<{ user: { id?: string; name?: string; email?: string; image?: string }; token?: string; cookieName?: string }>((resolve, reject) => {
        let browserClosed = false

        const urlListener = App.addListener('appUrlOpen', async (event) => {
          try {
            const url = new URL(event.url)
            if (url.host === 'auth' && url.pathname === '/callback') {
              // The callback page deep-links ?error= when it couldn't confirm
              // the session — close the sheet and surface a clean retry
              // message instead of leaving the browser open (AER-106).
              if (url.searchParams.get('error')) {
                urlListener.then(l => l.remove())
                browserListener.then(l => l.remove())
                Browser.close().catch(() => {})
                reject(new Error('Sign-in didn\'t complete. Please try again.'))
                return
              }
              const sessionParam = url.searchParams.get('session')
              if (sessionParam) {
                // UTF-8-safe decode; also repairs legacy '+'-mangled base64
                // from older deployed callback pages (AER-106).
                const callbackData = decodeMobileSessionPayload(sessionParam)
                urlListener.then(l => l.remove())
                browserListener.then(l => l.remove())
                Browser.close().catch(() => {})

                // Best-effort cookie-jar push for any code path that still
                // relies on it. The explicit Cookie header in remoteFetch is
                // the actual auth carrier.
                if (callbackData.token && callbackData.cookieName) {
                  try {
                    const { CapacitorCookies } = await import('@capacitor/core')
                    await CapacitorCookies.setCookie({
                      url: AUTH_BASE_URL,
                      key: callbackData.cookieName,
                      value: callbackData.token,
                      path: '/',
                      expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toUTCString(),
                    })
                  } catch {}
                }

                resolve({
                  user: {
                    id: callbackData.user?.id,
                    name: callbackData.user?.name ?? undefined,
                    email: callbackData.user?.email ?? undefined,
                    image: callbackData.user?.image ?? undefined,
                  },
                  token: callbackData.token,
                  cookieName: callbackData.cookieName,
                })
                return
              }
            }
          } catch {}
          urlListener.then(l => l.remove())
          browserListener.then(l => l.remove())
          // Close the sheet so the failure is visible in the app, not behind
          // a stuck browser overlay (AER-106).
          Browser.close().catch(() => {})
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

      // Step 5: Store session locally — including the raw JWT so remoteFetch
      // can attach it as an explicit Cookie header.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: sessionData.user,
        token: sessionData.token || '',
        cookieName: sessionData.cookieName || '',
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
   * Hardened mobile sign-out (AER-59). Sequence:
   *   1. Best-effort flush of never-synced / queued maps (guest/offline maps).
   *   2. Best-effort server-side revoke via POST /api/auth/logout, sent through
   *      CapacitorHttp with the JWT attached as an explicit Cookie header (the
   *      native cookie jar is unreliable across the WebView boundary on iOS).
   *   3. Clear ALL local user data (maps/syncQueue/syncMeta) — previously
   *      MISSING on mobile, which leaked the prior user's maps to the next
   *      sign-in on the same device.
   *   4. Delete the native session cookie that login pushed into
   *      CapacitorCookies for the app origin.
   *   5. Drop the stored session (removes nc-mobile-session, incl. the JWT).
   *
   * Every network/native step is guarded so sign-out can never throw or hang.
   */
  async function signOut() {
    // 1. Flush unsynced/queued maps (+ pending debounced edits) before wiping
    //    local state. Returns `allClean` = everything is safely on the server.
    let allClean = false
    try {
      const { useSyncEngine } = await import('~/composables/useSyncEngine')
      allClean = await useSyncEngine().flushBeforeLogout()
    } catch { /* best-effort — proceed, treat as NOT clean */ }

    // Capture the session token BEFORE it's dropped in step 5 so we can attach
    // it to the revoke POST and, if that POST doesn't land, persist a pending
    // marker to retry the revoke on next launch (AER-59 #5).
    let token = ''
    let cookieName = ''
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        token = data?.token || ''
        cookieName = data?.cookieName || ''
      }
    } catch { /* malformed storage — no token to attach */ }

    // 2. Server-side revoke (idempotent { ok: true }). Attach the JWT the same
    //    way remoteFetch/syncFetch do so the epoch bump lands even when the
    //    native cookie jar doesn't carry the session. Capped at 3s so a
    //    black-hole network can't stall logout (AER-59 #4). Track landing.
    let revokeOk = false
    try {
      const { CapacitorHttp } = await import('@capacitor/core')
      const headers: Record<string, string> = {}
      if (token && cookieName) headers.Cookie = `${cookieName}=${token}`
      await Promise.race([
        CapacitorHttp.post({ url: `${AUTH_BASE_URL}/api/auth/logout`, headers }).then(() => { revokeOk = true }),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ])
    } catch { /* best-effort — local sign-out still proceeds */ }

    // If the revoke didn't succeed (offline/timeout/error), persist a marker so
    // the server session gets revoked on the next online launch — otherwise the
    // 30-day native JWT stays valid server-side. On success, clear any marker.
    try {
      if (!revokeOk && token && cookieName) {
        localStorage.setItem('nc-pending-logout-revoke', JSON.stringify({ token, cookieName }))
      } else if (revokeOk) {
        localStorage.removeItem('nc-pending-logout-revoke')
      }
    } catch { /* best-effort — marker is an optimization, not required */ }

    // 3. Clear local user-scoped data ONLY when everything is safely on the
    //    server. If NOT clean (offline logout / failed push) keep the on-device
    //    maps — they're the last surviving copy of some edits, userId-scoped so
    //    inert for other accounts, and intact when this user signs back in.
    try {
      const { useDatabase } = await import('~/composables/useDatabase')
      const { clearUserData, setCurrentUserId } = useDatabase()
      if (allClean) {
        await clearUserData()
      } else {
        console.warn('[mobile-auth] logout: unsynced local data present — keeping on-device maps (not wiping)')
      }
      await setCurrentUserId(null)
    } catch { /* best-effort — still drop the session below */ }

    // 4. Delete the native session cookie login pushed for the app origin.
    try {
      const { CapacitorCookies } = await import('@capacitor/core')
      let cookieName = ''
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) cookieName = JSON.parse(stored)?.cookieName || ''
      } catch { /* ignore malformed storage */ }
      if (cookieName) {
        await CapacitorCookies.deleteCookie({ url: AUTH_BASE_URL, key: cookieName })
      }
      // Belt-and-suspenders: drop any remaining cookie for the auth origin.
      await CapacitorCookies.clearCookies({ url: AUTH_BASE_URL })
    } catch { /* best-effort — the stored JWT is dropped below regardless */ }

    // 5. Drop the stored session (removes the JWT — the real auth carrier).
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
    registerWithCredentials,
    loginWithOAuth,
    remoteFetch,
    signOut,
    retryPendingLogoutRevoke,
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
