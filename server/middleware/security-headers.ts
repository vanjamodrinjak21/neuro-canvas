export default defineEventHandler((event) => {
  const path = event.path || ''

  // HSTS on ALL responses (not just API) to prevent protocol downgrade
  setResponseHeader(event, 'Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  if (!path.startsWith('/api/')) return

  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  })
})
