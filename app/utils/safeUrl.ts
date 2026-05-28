// Reject anything that isn't a real http(s) URL or a safe data:image/
// payload. Avatars come from OAuth providers (Google / GitHub) and from
// DB rows, both of which can be tampered with; binding raw values to
// `<img :src>` lets an attacker smuggle javascript: URIs or non-image
// data: payloads that surface elsewhere.

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])
const SAFE_DATA_PREFIX = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i

/**
 * Returns the input URL if it's safe to bind as an image source, or
 * `null` otherwise. Callers should fall back to a placeholder/initial.
 */
export function safeImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  if (SAFE_DATA_PREFIX.test(trimmed)) return trimmed

  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid')
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null
    // Absolute http(s) URLs only — reject relative paths that resolved
    // against our placeholder origin, since avatars must come from a real host.
    if (parsed.hostname === 'placeholder.invalid') return null
    return parsed.toString()
  } catch {
    return null
  }
}
