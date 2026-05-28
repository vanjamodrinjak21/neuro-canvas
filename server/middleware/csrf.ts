/**
 * CSRF protection for state-changing API routes.
 *
 * Default-deny model: every /api/* non-GET request must look like a
 * programmatic call (JSON body or X-Requested-With header). Browser HTML
 * form submissions can't set either, so cross-origin attacker pages
 * can't trigger a state-changing call against an authenticated cookie.
 *
 * Layered on top of SameSite=lax cookies + (where present) per-endpoint
 * Origin checks. This is defense-in-depth.
 */

// Paths that opt OUT of the CSRF check. Use ONLY for endpoints that
// handle their own CSRF / origin verification or that must accept simple
// HTML form posts. NextAuth handles its own CSRF via its csrf-token route,
// so its surface is excluded. Don't add to this list without a reason.
const SKIP_PREFIXES = [
  '/api/auth/',  // next-auth: built-in CSRF protection on its routes
]

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const method = getMethod(event)

  // Only state-changing methods need CSRF protection. Safe methods
  // (GET/HEAD/OPTIONS) cannot mutate state by themselves.
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return

  // Only guard API surface. SPA route handlers are not affected.
  if (!url.pathname.startsWith('/api/')) return

  // Explicit skip list — keep small, justify each entry.
  if (SKIP_PREFIXES.some(p => url.pathname.startsWith(p))) return

  // JSON Content-Type triggers CORS preflight on cross-origin calls, so
  // attacker pages can't reach this branch with a stolen cookie. Accept.
  const contentType = getRequestHeader(event, 'content-type') || ''
  if (contentType.includes('application/json')) return

  // Empty body POSTs (e.g. action endpoints) — accept the custom-header
  // fallback. Same browser-protection guarantee: simple form posts cannot
  // set this header without preflight.
  const requestedWith = getRequestHeader(event, 'x-requested-with')
  if (requestedWith === 'XMLHttpRequest') return

  // Some PartyKit / webhook callbacks use multipart or text/plain bodies
  // and authenticate themselves via HMAC signature in a custom header.
  // Treat presence of x-collab-signature / x-webhook-signature as a CSRF
  // bypass — those headers are themselves a CSRF-resistant secret.
  if (getRequestHeader(event, 'x-collab-signature')) return
  if (getRequestHeader(event, 'x-webhook-signature')) return

  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden: CSRF validation failed'
  })
})
