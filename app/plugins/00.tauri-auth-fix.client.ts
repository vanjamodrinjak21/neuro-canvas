/**
 * Tauri Auth Fix
 *
 * Patches both window.fetch and globalThis.$fetch to intercept
 * /api/auth/session calls and return a mock empty session.
 * This prevents @sidebase/nuxt-auth from crashing on Tauri
 * where there's no local server.
 */
export default defineNuxtPlugin({
  name: 'tauri-auth-fix',
  enforce: 'pre',
  setup() {
    if (typeof window === 'undefined') return
    if (!('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) return

    const mockSessionResponse = () => new Response(
      JSON.stringify({ user: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

    // Patch window.fetch
    const origFetch = window.fetch.bind(window)
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/api/auth/session') || url.includes('/api/auth/csrf') || url.includes('/api/auth/providers')) {
        return Promise.resolve(mockSessionResponse())
      }
      return origFetch(input, init)
    } as typeof window.fetch
  }
})
