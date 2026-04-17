/**
 * Fix auth baseURL for Tauri desktop.
 *
 * @sidebase/nuxt-auth uses relative URLs by default (/api/auth/session).
 * In Tauri, these resolve to the local asset protocol, not the web server.
 * Override the runtime config to point to the production server.
 */
export default defineNuxtPlugin(() => {
  const isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
  if (!isTauri) return

  const config = useRuntimeConfig()

  // Override auth baseURL to point to the production web server
  if (config.public?.auth) {
    (config.public.auth as Record<string, unknown>).baseURL = 'https://neuro-canvas.com/api/auth'
  }
})
