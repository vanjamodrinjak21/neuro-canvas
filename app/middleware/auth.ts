/**
 * Auth middleware - Protects routes that require authentication
 * Redirects to /auth/signin if not authenticated
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data, status, getSession } = useAuth()

  // For client-side SPA, always fetch fresh session
  if (import.meta.client) {
    try {
      await getSession({ force: true })
    } catch (e) {
      console.error('Failed to get session:', e)
    }
  }

  // Check session data directly (more reliable than status for SPA)
  const session = data.value

  if (session?.user) {
    // User is authenticated
    return
  }

  // Not authenticated - redirect to sign in
  if (!to.path.startsWith('/auth/')) {
    return navigateTo('/auth/signin')
  }
})
