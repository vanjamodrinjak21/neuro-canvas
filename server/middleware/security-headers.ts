// Security headers for every response. API routes get the strict
// `default-src 'none'` policy (they only ever return JSON / binary
// blobs); HTML routes get a permissive-but-explicit policy that the
// SPA needs to function while still blocking the obvious XSS / clickjack
// vectors. Without this the SPA would ship with zero CSP backstop.

// Embedding (AER-98): pages may be rendered inside iframes on other sites.
// The allowed parent origins come from EMBED_FRAME_ANCESTORS (a CSP source
// list, e.g. "https://example.com https://*.school.edu", or 'none' to lock
// embedding back down), defaulting to * so any site can embed. API JSON and
// the next-auth endpoints stay frame-blocked below regardless.
const _rawAncestors = (process.env.EMBED_FRAME_ANCESTORS || '*').trim()
// CSP keywords must be quoted ("'none'", "'self'") — accept the unquoted
// spellings operators will inevitably type and normalize them.
const FRAME_ANCESTORS = _rawAncestors === 'none'
  ? "'none'"
  : _rawAncestors === 'self' ? "'self'" : _rawAncestors

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
  `frame-ancestors ${FRAME_ANCESTORS}`,
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

  // HTML / asset routes — apply CSP + sniff protection. Framing is governed
  // by the CSP frame-ancestors directive above (AER-98): no X-Frame-Options
  // by default, because a stale DENY would override the permissive
  // frame-ancestors in older browsers and block legitimate embeds. When the
  // operator locks embedding back down (EMBED_FRAME_ANCESTORS='none'), the
  // legacy X-Frame-Options fallback returns for browsers without
  // frame-ancestors support.
  // Don't set Cache-Control here: Nuxt + Nitro tune that per-route, and
  // we don't want to break the asset cache.
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': HTML_CSP,
  })
  if (FRAME_ANCESTORS === "'none'" || FRAME_ANCESTORS === 'none') {
    setResponseHeader(event, 'X-Frame-Options', 'DENY')
  }
})
