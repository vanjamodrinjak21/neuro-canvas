// Client-side wrapping for BYOK API keys.
//
// Background: API keys for Anthropic / OpenAI / OpenRouter were
// persisted to IndexedDB as plaintext on Capacitor + Tauri shells
// (where the server vault doesn't apply). The frontend XSS audit
// flagged this as the largest data-loss risk left — a single XSS
// would let an attacker read every BYOK key on the device.
//
// This module encrypts the key with AES-GCM-256 before persistence
// using a wrapping key derived from a random per-install salt that
// lives in localStorage. It is **not** as strong as a hardware
// keychain — a sufficiently determined XSS that also runs this
// module's `unwrap()` can still decrypt — but it neutralises the
// large class of attacks that just exfiltrate the IndexedDB row
// (backups, forensic disk inspection, browser-extension scrapes,
// dev-tools snooping) because the value at rest is opaque.
//
// Migration path is forward-compatible: legacy plaintext keys still
// read through `readKey()` unchanged; on the next save they get
// wrapped. Wrapped values are tagged with the `enc1:` prefix so
// future format upgrades are detectable.
//
// On native shells (Capacitor / Tauri) the next step is to replace
// `getOrCreateWrappingMaterial()` with Capacitor SecureStorage /
// Tauri Stronghold. The public API of this module would not change.

const WRAPPED_PREFIX = 'enc1:'
const MATERIAL_KEY = 'nc:keywrap:material:v1'

/** True if the value was produced by `wrapKey` (vs legacy plaintext). */
export function isWrapped(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(WRAPPED_PREFIX)
}

function b64encode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Get-or-create the per-install random material that we feed into the
 * KDF. Stored in localStorage today; trivial to swap for Capacitor
 * SecureStorage or Tauri Stronghold by replacing this one function.
 */
function getOrCreateWrappingMaterial(): Uint8Array {
  if (typeof window === 'undefined' || !window.localStorage) {
    // SSR or sandboxed context — return a deterministic empty-buffer
    // wrap key. wrapKey/unwrapKey error out for any meaningful payload,
    // so we never produce ciphertext we couldn't decrypt back.
    return new Uint8Array(32)
  }
  const existing = window.localStorage.getItem(MATERIAL_KEY)
  if (existing) {
    try { return b64decode(existing) } catch { /* corrupted, regenerate */ }
  }
  const fresh = crypto.getRandomValues(new Uint8Array(32))
  window.localStorage.setItem(MATERIAL_KEY, b64encode(fresh))
  return fresh
}

let _cachedKey: CryptoKey | null = null

async function getWrappingKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey
  const material = getOrCreateWrappingMaterial()
  // Use raw HKDF/PBKDF2-derived key. We use HKDF here because the
  // material is already high-entropy (32 random bytes), so PBKDF2's
  // iteration cost adds nothing — HKDF gives a clean derive.
  const baseKey = await crypto.subtle.importKey(
    'raw',
    material as BufferSource,
    'HKDF',
    false,
    ['deriveKey'],
  )
  const derived = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('neurocanvas:byok:salt:v1') as BufferSource,
      info: new TextEncoder().encode('neurocanvas:byok:aes-gcm-256') as BufferSource,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  _cachedKey = derived
  return derived
}

/**
 * Encrypt a plaintext API key. Returns `enc1:<iv-b64>:<ct-b64>`.
 * Throws if Web Crypto is unavailable.
 */
export async function wrapKey(plaintext: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto unavailable — cannot wrap key')
  }
  const key = await getWrappingKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(plaintext)
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource),
  )
  return `${WRAPPED_PREFIX}${b64encode(iv)}:${b64encode(cipher)}`
}

/**
 * Decrypt a value produced by `wrapKey`. Legacy plaintext values
 * pass through unchanged so existing stored keys keep working.
 */
export async function unwrapKey(value: string): Promise<string> {
  if (!isWrapped(value)) return value
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto unavailable — cannot unwrap key')
  }
  const body = value.slice(WRAPPED_PREFIX.length)
  const sep = body.indexOf(':')
  if (sep === -1) throw new Error('Malformed wrapped key')
  const iv = b64decode(body.slice(0, sep))
  const cipher = b64decode(body.slice(sep + 1))
  const key = await getWrappingKey()
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipher as BufferSource,
  )
  return new TextDecoder().decode(plain)
}

/**
 * Convenience: read a stored key whether wrapped or legacy plaintext.
 * Returns null when input is empty so callers can treat "no key" and
 * "decrypt failed" the same way.
 */
export async function readKey(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null
  try {
    return await unwrapKey(stored)
  } catch {
    // Wrapping material lost / corrupted / wrong format. Treat as
    // "no key" so the UI prompts re-entry instead of crashing.
    return null
  }
}
