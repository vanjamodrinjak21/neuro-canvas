// Security headers for every response. API routes get the strict
// `default-src 'none'` policy (they only ever return JSON / binary
// blobs); HTML routes get a permissive-but-explicit policy that the
// SPA needs to function while still blocking the obvious XSS / clickjack
// vectors. Without this the SPA would ship with zero CSP backstop.

const HTML_CSP = [
  "default-src 'self'",
  // Inline scripts are needed for Nuxt's hydration shim. 'unsafe-eval'
  // covers ONNX runtime / wasm-bound libs that compile shaders.
  // TODO: switch to nonce-based once the Tauri shim is fully external.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
  "font-src 'self' data: https://api.fontshare.com https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

export default defineEventHandler((event) => {
  const path = event.path || ''

  // HSTS on ALL responses (not just API) to prevent protocol downgrade
  setResponseHeader(event, 'Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  if (path.startsWith('/api/')) {
    setResponseHeaders(event, {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '0',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    })
    return
  }

  // HTML / asset routes — apply CSP + clickjacking / sniff protection.
  // Don't set Cache-Control here: Nuxt + Nitro tune that per-route, and
  // we don't want to break the asset cache.
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': HTML_CSP,
  })
})
