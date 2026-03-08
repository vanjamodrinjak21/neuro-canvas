/**
 * Tauri Router Plugin
 *
 * In Tauri (desktop) mode, redirect landing page and auth pages to dashboard.
 * The desktop app is fully local with no login — go straight to the app.
 */
export default defineNuxtPlugin(() => {
  const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

  if (!isTauri) return

  const router = useRouter()

  router.beforeEach((to) => {
    // Redirect landing page and auth routes to dashboard
    if (to.path === '/' || to.path.startsWith('/auth')) {
      return '/dashboard'
    }
  })
})
