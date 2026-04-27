/**
 * Native Auth Fix (Tauri + Capacitor)
 *
 * Patches window.fetch to intercept /api/auth/* calls and return
 * mock responses. If the user has signed in on mobile (stored in localStorage),
 * returns their real session. Otherwise returns a local-only mock user so
 * @sidebase/nuxt-auth doesn't redirect to /api/auth/signin.
 */
export default defineNuxtPlugin({
  name: 'native-auth-fix',
  enforce: 'pre',
  setup() {
    if (typeof window === 'undefined') return
    const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window
    const isCapacitor = 'Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()
    if (!isTauri && !isCapacitor) return

    const json = (data: unknown) => new Response(
      JSON.stringify(data),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

    // Check for stored native session (mobile or desktop)
    function getStoredSession() {
      const mobileStored = localStorage.getItem('nc-mobile-session')
      if (mobileStored) {
        try {
          const data = JSON.parse(mobileStored)
          if (data.version === 1 && data.user?.email) {
            return {
              user: data.user,
              expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        } catch {}
      }

      const desktopStored = localStorage.getItem('nc-desktop-session')
      if (desktopStored) {
        try {
          const data = JSON.parse(desktopStored)
          if (data.version === 2 && data.user?.email) {
            return {
              user: data.user,
              expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            }
          }
        } catch {}
      }

      // Fallback: local-only user so nuxt-auth stays happy
      return {
        user: {
          id: 'local-device-user',
          name: 'Local User',
          email: 'local@device'
        },
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    }

    const origFetch = window.fetch.bind(window)
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/api/auth/session')) return Promise.resolve(json(getStoredSession()))
      if (url.includes('/api/auth/csrf')) return Promise.resolve(json({ csrfToken: 'native-noop' }))
      if (url.includes('/api/auth/providers')) return Promise.resolve(json({}))
      // Catch any other /api/auth/* calls (signin, signout, callback, etc.)
      if (url.includes('/api/auth/')) return Promise.resolve(json({ ok: true }))
      return origFetch(input, init)
    } as typeof window.fetch
  }
})
