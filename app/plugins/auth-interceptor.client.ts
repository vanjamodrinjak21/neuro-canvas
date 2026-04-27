/**
 * Global 401 interceptor — catches expired session errors that bubble up
 * as unhandled errors and redirects to sign-in.
 *
 * IMPORTANT: Does NOT call signOut() — that would destroy the session cookie
 * and make recovery impossible. Instead, just redirects to sign-in where the
 * user can re-authenticate and get a fresh JWT.
 */
export default defineNuxtPlugin((nuxtApp) => {
  // Native apps don't use server auth — skip 401 interception
  if ('Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()) return
  if ('__TAURI__' in window || '__TAURI_INTERNALS__' in window) return

  let handling401 = false

  async function handleSessionExpired() {
    if (handling401) return
    handling401 = true
    try {
      const route = useRoute()
      // Don't redirect if already on auth pages
      if (route.path.startsWith('/auth/')) return
      const returnTo = route.fullPath
      await navigateTo(`/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`)
    } finally {
      // Reset after a longer delay to prevent rapid-fire redirects
      setTimeout(() => { handling401 = false }, 5000)
    }
  }

  // Safety net: catch unhandled 401 errors from $fetch (not raw fetch)
  nuxtApp.hook('vue:error', (error: unknown) => {
    const err = error as { statusCode?: number; status?: number; data?: { statusCode?: number } }
    const status = err?.statusCode || err?.status || err?.data?.statusCode
    if (status === 401) {
      handleSessionExpired()
    }
  })

  return {
    provide: {
      handleSessionExpired
    }
  }
})
