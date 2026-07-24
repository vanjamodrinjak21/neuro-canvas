/**
 * Desktop Auth — Singleton shared state
 *
 * Uses module-level state so all components share the same auth state.
 * Authenticates via Tauri HTTP plugin (native HTTP client with its own cookie jar)
 * to bypass SameSite cookie restrictions that block cross-origin browser fetch.
 */
import { decodeMobileSessionPayload } from '~/utils/mobileSessionPayload'

const AUTH_BASE_URL = 'https://neuro-canvas.com'

// Reverse-client-ID scheme registered for the Google OAuth deep-link callback.
// MUST stay byte-identical (and lowercase) to the scheme baked into the build:
//   - src-tauri/tauri.conf.json    plugins.deep-link.desktop.schemes[1]
//   - src-tauri/windows/hooks.nsh  GOOGLE_OAUTH_SCHEME
const REGISTERED_GOOGLE_SCHEME_PREFIX = 'com.googleusercontent.apps.1025021574887-effk89v1d8s52cjgc4m7mi4nmipruk6c'

// The desktop OAuth client ID is PINNED by the reverse-client-ID scheme baked
// into the build (tauri.conf.json / hooks.nsh): the OS only routes that exact
// compile-time scheme, so the client ID cannot vary at runtime. We therefore
// derive it from the registered scheme as the source of truth, rather than
// depending on a build-time env (`GOOGLE_DESKTOP_CLIENT_ID`) that CI desktop
// builds did not set — which baked an EMPTY client ID and broke Google sign-in
// on every CI build (notably the Windows installer). The client ID is public
// (it appears in the redirect URL), so pinning it in source is safe. The env,
// when present, still wins and is validated by the drift guard below.
const DERIVED_GOOGLE_CLIENT_ID
  = `${REGISTERED_GOOGLE_SCHEME_PREFIX.replace(/^com\.googleusercontent\.apps\./, '')}.apps.googleusercontent.com`

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
          // Backfill the JWT for sessions saved before we persisted it, so sync
          // stops 401ing. Best-effort — only works if the Tauri cookie jar still
          // holds the session this launch; otherwise the user re-signs in once.
          if (!data.token) captureSessionToken()
        } else {
          localStorage.removeItem('nc-desktop-session')
        }
      } catch {
        localStorage.removeItem('nc-desktop-session')
      }
    }
    // Retry any deferred server-side logout revoke from a prior offline
    // sign-out (AER-59 #5). Best-effort; never blocks init.
    void retryPendingLogoutRevoke()
  }

  // Pull the raw session JWT (the next-auth cookie) and persist it in the
  // desktop session so syncFetch can attach it explicitly on later launches.
  // The Tauri HTTP cookie jar is in-memory and lost on app restart, so without
  // this every /api/sync/* call 401s and server maps never pull (maps open
  // empty). Mirrors the mobile-token flow. Best-effort; no-op when not signed in.
  async function captureSessionToken() {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const res = await tauriFetch(`${AUTH_BASE_URL}/api/auth/mobile-token`, { method: 'GET' })
      if (!res.ok) return
      const data = await res.json() as { token?: string; cookieName?: string }
      if (!data?.token || !data?.cookieName) return
      const raw = localStorage.getItem('nc-desktop-session')
      const session = raw ? JSON.parse(raw) : { version: 2 }
      localStorage.setItem('nc-desktop-session', JSON.stringify({
        ...session,
        token: data.token,
        cookieName: data.cookieName,
      }))
    } catch { /* fall back to cookie-jar mode */ }
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
      await captureSessionToken()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed. Please try again.'
      _loginError.value = msg
      throw e
    } finally {
      _isLoggingIn.value = false
    }
  }

  /**
   * Google sign-in for the Tauri desktop shell.
   *
   * Pattern (matches Slack / Linear / Notion):
   *   1. Generate PKCE verifier + SHA-256 challenge.
   *   2. Open Google's OAuth URL in the *system browser* (reliable cookies,
   *      no embedded-webview disallowed-useragent rejection).
   *   3. Google redirects to `neurocanvas://auth/desktop-callback?code=...`.
   *      The OS routes that URL back to the Tauri app via tauri-plugin-deep-link.
   *   4. Listener captures the URL, validates state, posts {code, codeVerifier,
   *      redirectUri} to /api/auth/desktop-google via the Tauri HTTP plugin so
   *      the session cookie lands in the same native cookie jar as the
   *      email/password flow.
   *   5. Fetch /api/auth/session to confirm + persist locally.
   *
   * Add `neurocanvas://auth/desktop-callback` under "Authorized redirect URIs"
   * in your Google OAuth client (Desktop or Web type) for this to work.
   */
  async function loginWithGoogle(): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      throw new Error('Google desktop sign-in requires the Tauri shell.')
    }

    const config = useRuntimeConfig()
    // Prefer the build-time env if set, else fall back to the client ID derived
    // from the registered scheme (the compile-time source of truth). This makes
    // sign-in resilient to a desktop build that shipped without the env baked in.
    const clientId = (config.public as Record<string, string>).googleDesktopClientId || DERIVED_GOOGLE_CLIENT_ID
    if (!clientId) {
      throw new Error('GOOGLE_DESKTOP_CLIENT_ID is not configured on the server.')
    }

    _isLoggingIn.value = true
    _loginError.value = null

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

      // Google's "Desktop" OAuth clients reject custom schemes added via
      // console, but auto-allow a reverse-client-ID scheme of the form
      //   com.googleusercontent.apps.<CLIENT_ID_PREFIX>:/oauthredirect
      // No console changes needed. The matching scheme is registered with
      // Tauri's deep-link plugin so the OS routes it back to the running app.
      const reverseClientId = clientId.replace(/\.apps\.googleusercontent\.com$/, '').toLowerCase()
      const redirectUri = `com.googleusercontent.apps.${reverseClientId}:/oauthredirect`

      // Drift guard: the OS only routes the scheme baked into the build
      // (tauri.conf.json / hooks.nsh). If the runtime GOOGLE_DESKTOP_CLIENT_ID
      // resolves to a different reverse-client-ID, Windows has no handler for
      // the scheme Google redirects to and the callback is silently dropped —
      // so fail loudly here instead of hanging for five minutes.
      if (`com.googleusercontent.apps.${reverseClientId}` !== REGISTERED_GOOGLE_SCHEME_PREFIX) {
        throw new Error(
          'Desktop Google client-ID mismatch: the runtime GOOGLE_DESKTOP_CLIENT_ID does not match the scheme baked into this desktop build. Rebuild the desktop app with the matching client ID.',
        )
      }

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

      // CRITICAL (Windows): attach the deep-link listener BEFORE opening the
      // browser. On macOS the redirect is delivered in-process, so a late
      // listener still catches it — which is why this only ever broke on
      // Windows. There, the redirect arrives as a brand-new OS process whose
      // URL the single-instance plugin forwards into a single, un-buffered
      // `new-url` emit; if the listener isn't attached yet, that emit is lost
      // and sign-in hangs until the 5-minute timeout.
      const { open: openUrl } = await import('@tauri-apps/plugin-shell')
      const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')

      const code: string = await new Promise<string>((resolve, reject) => {
        let settled = false
        let unlisten: (() => void) | null = null
        const cleanup = () => {
          settled = true
          clearTimeout(timer)
          if (unlisten) {
            try { unlisten() } catch {}
          }
        }

        const timer = setTimeout(() => {
          if (!settled) { cleanup(); reject(new Error('Sign-in timed out.')) }
        }, 5 * 60 * 1000)

        // Shared matcher — used by both the live onOpenUrl listener and the
        // getCurrent() backstop below. Matching is case-insensitive because
        // Windows registry/ShellExecute scheme lookup is case-insensitive
        // while the deep-link plugin's own scheme filter is exact.
        const handleUrls = (urls: string[]) => {
          if (settled) return
          for (const raw of urls) {
            console.debug('[desktop-auth] deep-link received →', raw)
            let u: URL
            try {
              u = new URL(raw)
            } catch { continue }
            const lowerRaw = raw.toLowerCase()
            // Match Google's reverse-client-ID redirect:
            //   com.googleusercontent.apps.<CID>:/oauthredirect?code=...
            // (Also accept a generic neurocanvas://auth/desktop-callback in
            // case the user ever switches to a Web client + custom scheme.)
            const isReverseClientCallback
              = u.protocol.toLowerCase().startsWith('com.googleusercontent.apps.')
                && lowerRaw.includes('oauthredirect')
            const isLegacyCallback
              = u.protocol.toLowerCase() === 'neurocanvas:'
                && lowerRaw.includes('desktop-callback')
            if (!isReverseClientCallback && !isLegacyCallback) continue

            const err = u.searchParams.get('error')
            if (err) { cleanup(); reject(new Error(`Google returned error: ${err}`)); return }
            const returnedState = u.searchParams.get('state')
            const returnedCode = u.searchParams.get('code')
            if (returnedState !== state || !returnedCode) {
              cleanup(); reject(new Error('OAuth state mismatch.')); return
            }
            cleanup()
            resolve(returnedCode)
            return
          }
        }

        ;(async () => {
          // 1. Attach the listener FIRST so no redirect can slip past.
          unlisten = await onOpenUrl(handleUrls)
          // 2. Now open Google's consent screen in the system browser.
          await openUrl(authUrl)
          // 3. Backstop: drain any URL the OS already handed us before the
          //    listener attached. On Windows/Linux getCurrent() reads the
          //    forwarded CLI argument; on macOS it is normally null (no-op).
          try {
            const initial = await getCurrent()
            if (initial && initial.length) handleUrls(initial)
          } catch {}
        })().catch((e) => {
          if (!settled) { cleanup(); reject(new Error(`Deep-link listener failed: ${e?.message || e}`)) }
        })
      })

      // Hand the code to our backend through the Tauri HTTP plugin so the
      // session cookie lands in the same native cookie jar as the rest of
      // the desktop app's authenticated requests.
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const exchangeRes = await tauriFetch(`${AUTH_BASE_URL}/api/desktop-google`, {
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
      await captureSessionToken()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed.'
      _loginError.value = msg
      throw e
    } finally {
      _isLoggingIn.value = false
    }
  }

  /**
   * Sign in with Apple for the Tauri desktop shell (macOS only).
   *
   * Apple web OAuth requires an HTTPS return URL (custom schemes are rejected)
   * and there's no AuthenticationServices binding in the webview, so we can't use
   * Google's reverse-client-ID deep-link directly. Instead we reuse the exact
   * flow the mobile app uses:
   *   1. Open the hosted sign-in page in the *system browser* with ?auto=apple
   *      and a callbackUrl pointing at /auth/mobile-callback.
   *   2. Apple authenticates in the browser; next-auth sets the session cookie and
   *      redirects to /auth/mobile-callback, which mints the raw JWT and bounces
   *      to neurocanvas://auth/callback?session=<base64({user,token,cookieName})>.
   *   3. The OS routes that custom-scheme URL back to the app (tauri deep-link —
   *      the `neurocanvas` scheme is registered in tauri.conf.json).
   *   4. We decode it and persist the session. The JWT is attached as an explicit
   *      Cookie header by remoteFetch / the sync engine (the desktop HTTP cookie
   *      jar never sees this browser session).
   */
  async function loginWithApple(): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      throw new Error('Apple desktop sign-in requires the Tauri shell.')
    }

    _isLoggingIn.value = true
    _loginError.value = null

    type DesktopSession = {
      user: { id?: string; name?: string; email?: string; image?: string }
      token?: string
      cookieName?: string
    }

    try {
      const callbackUrl = `${AUTH_BASE_URL}/auth/mobile-callback`
      const authUrl = `${AUTH_BASE_URL}/auth/signin?auto=apple&callbackUrl=${encodeURIComponent(callbackUrl)}`

      const { open: openUrl } = await import('@tauri-apps/plugin-shell')
      const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')

      const session: DesktopSession = await new Promise<DesktopSession>((resolve, reject) => {
        let settled = false
        let unlisten: (() => void) | null = null
        const cleanup = () => {
          settled = true
          clearTimeout(timer)
          if (unlisten) { try { unlisten() } catch {} }
        }

        const timer = setTimeout(() => {
          if (!settled) { cleanup(); reject(new Error('Sign-in timed out.')) }
        }, 5 * 60 * 1000)

        // The mobile-callback bounce is the only neurocanvas:// URL carrying a
        // `session` param, so that param is our discriminator (Google's desktop
        // callback carries `code`). Matching is tolerant of host/path casing.
        const handleUrls = (urls: string[]) => {
          if (settled) return
          for (const raw of urls) {
            console.debug('[desktop-auth] deep-link received →', raw)
            let u: URL
            try { u = new URL(raw) } catch { continue }
            if (u.protocol.toLowerCase() !== 'neurocanvas:') continue
            const err = u.searchParams.get('error')
            if (err) { cleanup(); reject(new Error(`Apple returned error: ${err}`)); return }
            const sessionParam = u.searchParams.get('session')
            if (!sessionParam) continue
            try {
              // UTF-8-safe decode; also repairs legacy '+'-mangled base64
              // (raw base64 in a query string loses '+' to URL parsing) —
              // same codec as the Capacitor listener (AER-106).
              const decoded = decodeMobileSessionPayload(sessionParam)
              if (!decoded?.user?.email) {
                cleanup(); reject(new Error('Sign-in completed but no session was returned.')); return
              }
              cleanup()
              resolve({
                user: {
                  id: decoded.user.id,
                  name: decoded.user.name ?? undefined,
                  email: decoded.user.email ?? undefined,
                  image: decoded.user.image ?? undefined,
                },
                token: decoded.token,
                cookieName: decoded.cookieName,
              })
            } catch {
              cleanup(); reject(new Error('Invalid sign-in callback data.'))
            }
            return
          }
        }

        ;(async () => {
          // Attach the listener BEFORE opening the browser so no redirect slips
          // past (matches the Google flow's Windows-safe ordering).
          unlisten = await onOpenUrl(handleUrls)
          await openUrl(authUrl)
          try {
            const initial = await getCurrent()
            if (initial && initial.length) handleUrls(initial)
          } catch {}
        })().catch((e) => {
          if (!settled) { cleanup(); reject(new Error(`Deep-link listener failed: ${e?.message || e}`)) }
        })
      })

      localStorage.setItem('nc-desktop-session', JSON.stringify({
        version: 2,
        origin: AUTH_BASE_URL,
        authenticatedAt: Date.now(),
        user: session.user,
        token: session.token || '',
        cookieName: session.cookieName || '',
        provider: 'apple',
      }))

      _user.value = session.user
      _isSignedIn.value = true
      _showAuthModal.value = false
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Apple sign-in failed.'
      _loginError.value = msg
      throw e
    } finally {
      _isLoggingIn.value = false
    }
  }

  /**
   * Make an authenticated fetch to the remote server using the Tauri HTTP plugin.
   *
   * Attaches the persisted JWT as an explicit Cookie header (mirrors the sync
   * engine and the mobile client). The native cookie jar is in-memory and, for
   * the system-browser OAuth flows (Apple), never holds this session — so the
   * stored token is the reliable auth carrier. Falls back to the cookie jar when
   * no token is stored (e.g. mid-session after a credentials/Google sign-in).
   */
  async function remoteFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    const url = path.startsWith('http') ? path : `${AUTH_BASE_URL}${path}`

    const headers = new Headers(options?.headers)
    if (!headers.has('cookie')) {
      try {
        const stored = localStorage.getItem('nc-desktop-session')
        if (stored) {
          const data = JSON.parse(stored)
          if (data?.token && data?.cookieName) headers.set('Cookie', `${data.cookieName}=${data.token}`)
        }
      } catch { /* malformed localStorage — fall back to cookie jar */ }
    }

    const res = await tauriFetch(url, { ...options, headers })
    if (!res.ok) {
      throw new Error(`Remote fetch failed: ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  /**
   * Hardened desktop sign-out (AER-59). Sequence:
   *   1. Best-effort flush of never-synced / queued maps (guest/offline maps).
   *   2. Best-effort server-side revoke via POST /api/auth/logout, sent through
   *      the Tauri HTTP plugin with the JWT attached as an explicit Cookie
   *      header (same pattern as syncFetch) so the server can bump the session
   *      epoch even though the native cookie jar is unreliable across restarts.
   *   3. Clear ALL local user data (maps/syncQueue/syncMeta) — previously
   *      MISSING on desktop, which leaked the prior user's maps to the next
   *      sign-in on the same machine.
   *   4. Drop the stored session (removes nc-desktop-session, incl. the JWT).
   *
   * Cookie-jar note: @tauri-apps/plugin-http exposes only `fetch` in JS — there
   * is no binding to clear its (Rust-side, disk-persisted) cookie jar. Auth for
   * remoteFetch/syncFetch rides on the explicit token from nc-desktop-session,
   * which we remove here; combined with the server-side epoch bump in step 2,
   * any residual cookie in the jar no longer authenticates. Every network step
   * is guarded so sign-out can never throw or hang.
   */
  async function signOut() {
    // 1. Flush unsynced/queued maps (+ pending debounced edits) before wiping
    //    local state. Returns `allClean` = everything is safely on the server.
    let allClean = false
    try {
      const { useSyncEngine } = await import('~/composables/useSyncEngine')
      allClean = await useSyncEngine().flushBeforeLogout()
    } catch { /* best-effort — proceed, treat as NOT clean */ }

    // Capture the session token BEFORE it's dropped in step 4 so we can attach
    // it to the revoke POST and, if that POST doesn't land, persist a pending
    // marker to retry the revoke on next launch (AER-59 #5).
    let token = ''
    let cookieName = ''
    try {
      const stored = localStorage.getItem('nc-desktop-session')
      if (stored) {
        const data = JSON.parse(stored)
        token = data?.token || ''
        cookieName = data?.cookieName || ''
      }
    } catch { /* malformed storage — no token to attach */ }

    // 2. Server-side revoke (idempotent { ok: true }). Attach the JWT the same
    //    way syncFetch does so the session cookie jar's unreliability doesn't
    //    stop the epoch bump. Capped at 3s so a black-hole network can't stall
    //    logout (AER-59 #4). Track whether it actually landed.
    let revokeOk = false
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const headers: Record<string, string> = {}
      if (token && cookieName) headers.Cookie = `${cookieName}=${token}`
      await Promise.race([
        tauriFetch(`${AUTH_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: Object.keys(headers).length ? headers : undefined,
        }).then(() => { revokeOk = true }),
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
        console.warn('[desktop-auth] logout: unsynced local data present — keeping on-device maps (not wiping)')
      }
      await setCurrentUserId(null)
    } catch { /* best-effort — still drop the session below */ }

    // 4. Drop the stored session (removes the JWT — the real auth carrier).
    localStorage.removeItem('nc-desktop-session')
    _isSignedIn.value = false
    _user.value = null
    _loginError.value = null
  }

  /**
   * Retry a deferred server-side logout revoke (AER-59 #5). If a previous
   * sign-out couldn't reach the server (offline/timeout), we stored the session
   * token in `nc-pending-logout-revoke`. On the next online launch we POST
   * /api/auth/logout with that Cookie header so the residual 30-day native JWT
   * is invalidated server-side, then clear the marker. Best-effort; never
   * blocks and never throws.
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
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      await Promise.race([
        tauriFetch(`${AUTH_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: `${marker.cookieName}=${marker.token}` },
        }),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ])
    } catch { /* best-effort — leave the marker to retry next launch */ return }

    try { localStorage.removeItem('nc-pending-logout-revoke') } catch { /* ignore */ }
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
    loginWithApple,
    remoteFetch,
    signOut,
    retryPendingLogoutRevoke,
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
