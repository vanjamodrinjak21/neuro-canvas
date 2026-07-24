/**
 * Session payload codec for the OAuth deep-link bounce
 * (web /auth/mobile-callback → neurocanvas://auth/callback?session=...).
 * Used by the web callback page (encode) and by the Capacitor + Tauri
 * deep-link listeners (decode).
 *
 * Two hard-won constraints (AER-106):
 * - btoa()/atob() are Latin-1 only — a display name with diacritics made the
 *   old encoder THROW, stranding sign-in in the in-app browser sheet. The
 *   JSON is encoded as UTF-8 bytes first.
 * - The payload travels in a URL query where base64 '+' decodes to a space
 *   in URLSearchParams, silently corrupting the old (unencoded) payloads.
 *   Callers must encodeURIComponent(encodeMobileSessionPayload(...)), and
 *   decode() repairs legacy space-mangled input by mapping ' ' back to '+'
 *   (a space can never legitimately appear in base64).
 */

export interface MobileSessionPayload {
  user: { id?: string; name?: string | null; email?: string | null; image?: string | null }
  token?: string
  cookieName?: string
}

export function encodeMobileSessionPayload(payload: MobileSessionPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

export function decodeMobileSessionPayload(param: string): MobileSessionPayload {
  const bin = atob(param.replace(/ /g, '+'))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as MobileSessionPayload
}
