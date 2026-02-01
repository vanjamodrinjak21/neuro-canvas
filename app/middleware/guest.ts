/**
 * Guest middleware - Redirects authenticated users from auth pages
 * Used on /auth/signin, /auth/signup pages
 */
export default defineNuxtRouteMiddleware(async () => {
  const { status } = useAuth()

  // Wait for auth status to be determined
  if (status.value === 'loading') {
    return
  }

  if (status.value === 'authenticated') {
    return navigateTo('/dashboard')
  }
})
