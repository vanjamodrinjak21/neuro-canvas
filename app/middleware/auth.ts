/**
 * Auth middleware - Protects routes that require authentication
 * Allows guest mode users to access their single map
 * On Tauri (desktop): all pages accessible without auth (sign-in is optional)
 */
import { useGuestMode } from '~/composables/useGuestMode'

export default defineNuxtRouteMiddleware(async (to) => {
  // Tauri desktop: all pages accessible without auth — sign-in is optional
  if (typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) {
    return
  }

  // Guest mode: allow access to their one map only
  const guest = useGuestMode()
  if (guest.isGuest.value) {
    if (to.path.startsWith('/map/')) {
      const mapId = to.params.id as string
      if (mapId === 'new' || mapId === guest.guestMapId.value) {
        return
      }
      return navigateTo(`/map/${guest.guestMapId.value || 'new'}`)
    }
    if (!to.path.startsWith('/auth/') && to.path !== '/') {
      return navigateTo(`/map/${guest.guestMapId.value || 'new'}`)
    }
    return
  }

  const { data, getSession } = useAuth()

  if (import.meta.client) {
    try {
      await getSession({ force: true })
    } catch (e) {
      console.error('Failed to get session:', e)
    }
  }

  const session = data.value

  if (session?.user) {
    return
  }

  if (!to.path.startsWith('/auth/')) {
    return navigateTo('/auth/signin')
  }
})
