/**
 * Auth middleware - Protects routes that require authentication
 * Allows guest mode users to access their single map
 * On native apps (Tauri desktop, Capacitor mobile): all pages accessible without auth
 */
import { useGuestMode } from '~/composables/useGuestMode'

export default defineNuxtRouteMiddleware(async (to) => {
  // Native apps: all pages accessible without auth — sign-in is optional
  if (typeof window !== 'undefined') {
    const isTauri = '__TAURI__' in window || '__TAURI_INTERNALS__' in window
    const isCapacitor = 'Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()
    if (isTauri || isCapacitor) return
  }

  const guest = useGuestMode()
  const { data, getSession } = useAuth()

  if (import.meta.client) {
    try {
      await getSession({ force: true })
    } catch (e) {
      console.error('Failed to get session:', e)
    }
  }

  const session = data.value

  // Authenticated session always wins over guest mode.
  // If the user worked as a guest then signed in, claim the in-progress map
  // for their account before clearing guest state.
  if (session?.user) {
    if (guest.isGuest.value) {
      const claimedId = import.meta.client ? await guest.claimGuestMap() : null
      guest.exitGuestMode()
      // If they were being routed to /dashboard (the default post-sign-in landing),
      // send them straight back to their newly-saved map so they can keep working.
      if (claimedId && to.path === '/dashboard') {
        return navigateTo(`/map/${claimedId}`)
      }
    }
    return
  }

  // Guest mode: allow access to their one map; landing and auth pages are escape hatches
  if (guest.isGuest.value) {
    if (to.path.startsWith('/map/')) {
      const mapId = to.params.id as string
      if (mapId === 'new' || mapId === guest.guestMapId.value) {
        return
      }
      // Trying to access a different map — bounce to landing rather than locking back
      return navigateTo('/')
    }
    if (to.path.startsWith('/auth/') || to.path === '/') {
      return
    }
    // Any other protected page — let them out to the landing page
    return navigateTo('/')
  }

  if (!to.path.startsWith('/auth/')) {
    return navigateTo('/auth/signin')
  }
})
