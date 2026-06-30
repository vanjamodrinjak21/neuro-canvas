// Single source of truth for turning a user record into a human-friendly
// display name + initials.
//
// The motivating bug: Sign in with Apple + "Hide My Email" returns a random
// relay address (e.g. `hf2zj5rg97@privaterelay.appleid.com`) and no name
// (Apple only sends the name once, in a POST field next-auth v4 drops). Every
// surface that fell back to `email.split('@')[0]` then showed the meaningless
// `hf2zj5rg97` as the user's name. Centralising the rule here guarantees a
// relay local-part is never surfaced as a name.

/** Apple "Hide My Email" relay domain. */
const PRIVATE_RELAY_DOMAIN = 'privaterelay.appleid.com'

/** Sentinel email for the Tauri/Capacitor local-only (signed-out) user. */
const LOCAL_DEVICE_EMAIL = 'local@device'

export interface DisplayUserLike {
  name?: string | null
  email?: string | null
}

/**
 * True for Apple Hide-My-Email relay addresses. Their local part is a random
 * token with no human meaning, so it must never be used as a display name.
 */
export function isPrivateRelayEmail(email?: string | null): boolean {
  if (!email) return false
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return domain === PRIVATE_RELAY_DOMAIN || domain.endsWith(`.${PRIVATE_RELAY_DOMAIN}`)
}

/**
 * Resolve a human-friendly display name.
 * Priority: explicit name → email local-part (real emails only) → fallback.
 * A relay or local-device address yields the caller-supplied fallback so we
 * never render a meaningless handle.
 */
export function resolveDisplayName(user: DisplayUserLike | null | undefined, fallback: string): string {
  const name = user?.name?.trim()
  if (name) return name

  const email = user?.email?.trim()
  if (email && email !== LOCAL_DEVICE_EMAIL && !isPrivateRelayEmail(email)) {
    const local = email.split('@')[0]?.trim()
    if (local) return local
  }

  return fallback
}

/** Two-letter initials from a resolved display name. */
export function resolveInitials(name: string, fallback = 'NC'): string {
  const trimmed = name.trim()
  if (!trimmed) return fallback

  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0]! + parts[1][0]!).toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}
