/**
 * Auth middleware - Protects routes that require authentication
 * Redirects to /auth/signin if not authenticated
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { status, getSession } = useAuth()

  // On client-side, refresh session to get latest state
  if (import.meta.client) {
    await getSession({ force: true })
  }

  // Wait for auth status to be determined
  if (status.value === 'loading') {
    return
  }

  if (status.value !== 'authenticated') {
    // Prevent redirect loop
    if (to.path.startsWith('/auth/')) {
      return
    }
    return navigateTo('/auth/signin')
  }
})
