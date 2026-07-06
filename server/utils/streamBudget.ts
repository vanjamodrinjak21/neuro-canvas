/**
 * Resource budget for the /api/ai/stream SSE proxy (AER-81).
 *
 * The stream endpoint forwards an upstream provider's bytes over an
 * HTTP-200 SSE connection. A hung or malicious upstream — `custom` baseUrl
 * is user-supplied — must not be able to hold the connection open or push
 * bytes indefinitely. Callers consume() every forwarded chunk and stop
 * reading when a violation message is returned.
 */

export interface StreamBudget {
  /** Record a forwarded chunk; returns a violation message when over budget, null otherwise. */
  consume(bytes: number): string | null
}

const DEFAULT_MAX_MS = 300_000 // 5 minutes — above the slowest observed Opus full-map run
const DEFAULT_MAX_BYTES = 2_000_000 // 2 MB — 4x the 500 KB cacheable response cap

export function createStreamBudget(opts?: {
  maxMs?: number
  maxBytes?: number
  now?: () => number
}): StreamBudget {
  const maxMs = opts?.maxMs ?? DEFAULT_MAX_MS
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES
  const now = opts?.now ?? Date.now
  const startedAt = now()
  let bytes = 0

  return {
    consume(chunk: number): string | null {
      bytes += chunk
      if (now() - startedAt > maxMs) {
        return `AI stream exceeded the ${Math.round(maxMs / 60_000)}-minute limit — the provider may be hanging. Try again.`
      }
      if (bytes > maxBytes) {
        return `AI stream exceeded the ${Math.round(maxBytes / 1_000_000)} MB output limit. Try a smaller generation.`
      }
      return null
    }
  }
}
