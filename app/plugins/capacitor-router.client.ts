/**
 * Capacitor Router Plugin
 *
 * Mirrors tauri-router.client.ts — redirects auth and landing pages
 * to /dashboard on native mobile since Capacitor runs fully local
 * with no authentication required.
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return
  if (!('Capacitor' in window) || !(window as any).Capacitor?.isNativePlatform?.()) return

  const router = useRouter()

  router.beforeEach((to) => {
    // Only redirect landing page — allow auth pages for optional sign-in
    if (to.path === '/') {
      return '/dashboard'
    }
  })
})
