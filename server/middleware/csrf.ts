/**
 * CSRF protection for state-changing API routes.
 *
 * Validates that non-GET/HEAD/OPTIONS requests to protected /api/* paths
 * include a custom header (X-Requested-With), which cannot be set by simple
 * HTML form submissions and triggers CORS preflight for cross-origin requests.
 *
 * Nuxt's $fetch sends JSON bodies which already triggers CORS preflight,
 * plus cookies use SameSite=lax. This is defense-in-depth.
 */
const PROTECTED_PREFIXES = [
  '/api/user/',
  '/api/vault/',
  '/api/sync/',
  '/api/templates/publish',
  '/api/templates/generate',
  '/api/embeddings/',
]

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const method = getMethod(event)

  // Only protect state-changing requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return

  // Check if this path needs CSRF protection
  const needsProtection = PROTECTED_PREFIXES.some(p => url.pathname.startsWith(p))
  if (!needsProtection) return

  // $fetch sends Content-Type: application/json which triggers CORS preflight.
  // Verify it's a programmatic request (not a form submission).
  const contentType = getRequestHeader(event, 'content-type') || ''
  if (contentType.includes('application/json')) return

  // Fallback: check custom header
  const requestedWith = getRequestHeader(event, 'x-requested-with')
  if (requestedWith === 'XMLHttpRequest') return

  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden: CSRF validation failed'
  })
})
