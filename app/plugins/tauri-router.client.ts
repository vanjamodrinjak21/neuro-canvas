/**
 * Tauri Router Plugin
 *
 * In Tauri (desktop) mode, redirect landing page to dashboard.
 * Auth pages are allowed — users can optionally sign in to sync API keys.
 */
export default defineNuxtPlugin(() => {
  const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

  if (!isTauri) return

  const router = useRouter()

  router.beforeEach((to) => {
    // Only redirect the landing page — allow auth pages for optional sign-in
    if (to.path === '/') {
      return '/dashboard'
    }
  })
})
