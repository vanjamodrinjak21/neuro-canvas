/**
 * Auth middleware - Protects routes that require authentication
 * Redirects to /auth/signin if not authenticated
 */
export default defineNuxtRouteMiddleware(async () => {
  const { status } = useAuth()

  // Wait for auth status to be determined
  if (status.value === 'loading') {
    return
  }

  if (status.value !== 'authenticated') {
    return navigateTo('/auth/signin')
  }
})
