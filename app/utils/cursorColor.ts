const PALETTE = ['#A78BFA', '#F472B6', '#60A5FA', '#4ADE80', '#FB923C', '#FACC15'] as const

/**
 * Deterministic mapping from a session id to a cursor colour drawn from the
 * canvas node-colour palette. Same session id -> same colour every time, so
 * the same person doesn't change colour across reloads.
 */
export function cursorColor(sessionId: string): string {
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]!
}
