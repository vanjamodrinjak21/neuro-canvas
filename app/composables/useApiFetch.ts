/**
 * Platform-aware authenticated API fetch.
 *
 * On the web a plain relative $fetch works: the session cookie rides along
 * automatically. On the native shells it does NOT — a relative $fetch
 * resolves against the local shell origin (tauri://localhost /
 * capacitor://localhost) where no API exists, and even absolute calls lack
 * the session because the native cookie jars are unreliable (AER-59). Every
 * feature that shipped web-first has re-hit this (sync pushDelete, vault
 * credentials, share modal — AER-103); this helper is the single place that
 * knows the routing rules:
 *
 *   - Tauri + signed in      → desktopAuth.remoteFetch (JWT Cookie attached)
 *   - Capacitor + signed in  → mobileAuth.remoteFetch  (JWT Cookie attached)
 *   - otherwise              → $fetch (web session cookie)
 *
 * Mutating calls always satisfy the server's CSRF middleware: JSON bodies
 * carry Content-Type: application/json, bodyless calls carry
 * X-Requested-With: XMLHttpRequest (AER-101).
 */

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

function _isCapacitor(): boolean {
  return typeof window !== 'undefined' && 'Capacitor' in window
    && !!(window as any).Capacitor?.isNativePlatform?.()
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export function useApiFetch() {
  // Resolve the platform auth lazily but only on the matching shell — the
  // composables are singletons, so this is cheap and SSR-safe (both checks
  // are false without a window).
  const desktopAuth = _isTauri() ? useDesktopAuth() : null
  const mobileAuth = _isCapacitor() ? useMobileAuth() : null

  async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
    const method = options.method || 'GET'
    const hasBody = options.body !== undefined
    const mutating = method !== 'GET'

    if (desktopAuth?.isSignedIn.value) {
      const init: RequestInit = {
        method,
        headers: hasBody
          ? { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
          : { 'X-Requested-With': 'XMLHttpRequest' },
      }
      if (hasBody) init.body = JSON.stringify(options.body)
      return desktopAuth.remoteFetch(path, init) as Promise<T>
    }

    if (mobileAuth?.isSignedIn.value) {
      const opts: { method: string; headers: Record<string, string>; data?: unknown } = {
        method,
        // remoteFetch defaults Content-Type: application/json when data is
        // present (AER-101); the header here covers the bodyless calls.
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }
      if (hasBody) opts.data = options.body
      return mobileAuth.remoteFetch(path, opts) as Promise<T>
    }

    return ($fetch as any)(path, {
      method,
      body: hasBody ? options.body : undefined,
      // Bodyless mutating calls need the header for the CSRF middleware; with
      // a body, $fetch's JSON serialisation already vouches for the request.
      headers: mutating && !hasBody ? { 'X-Requested-With': 'XMLHttpRequest' } : undefined,
    }) as Promise<T>
  }

  return { apiFetch }
}
