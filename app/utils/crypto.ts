/**
 * Crypto utilities for secure API key storage
 * Uses Web Crypto API with AES-GCM encryption
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12

/**
 * Generate a secure random encryption key from a passphrase
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate a random salt for key derivation
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

/**
 * Generate a random initialization vector
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH))
}

/**
 * Encrypt a plaintext string
 * Returns base64-encoded string containing salt + iv + ciphertext
 */
export async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = generateSalt()
  const iv = generateIV()
  const key = await deriveKey(passphrase, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plaintext)
  )

  // Combine salt + iv + ciphertext into single array
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

  // Return as base64
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded string containing salt + iv + ciphertext
 */
export async function decrypt(encryptedBase64: string, passphrase: string): Promise<string> {
  const decoder = new TextDecoder()

  // Decode base64
  const combined = new Uint8Array(
    atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
  )

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 16 + IV_LENGTH)
  const ciphertext = combined.slice(16 + IV_LENGTH)

  const key = await deriveKey(passphrase, salt)

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  )

  return decoder.decode(plaintext)
}

/**
 * Generate an encryption passphrase from user session data
 * This creates a unique key per user without storing it
 */
export function generateSessionPassphrase(userId: string, email: string): string {
  // Combine user-specific data to create a deterministic passphrase
  // The user ID and email together make this unique per user
  return `nc-${userId}-${email}-key`
}

/**
 * Mask an API key for display (show first 4 and last 4 chars)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '••••••••'
  }
  return `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`
}

/**
 * Validate that a string looks like an API key
 */
export function isValidApiKeyFormat(apiKey: string, providerType: string): boolean {
  if (!apiKey || apiKey.trim().length === 0) {
    return false
  }

  const trimmed = apiKey.trim()

  switch (providerType) {
    case 'openai':
      // OpenAI keys start with sk-
      return trimmed.startsWith('sk-') && trimmed.length > 20
    case 'anthropic':
      // Anthropic keys start with sk-ant-
      return trimmed.startsWith('sk-ant-') && trimmed.length > 20
    case 'openrouter':
      // OpenRouter keys start with sk-or-
      return trimmed.startsWith('sk-or-') && trimmed.length > 20
    case 'ollama':
      // Ollama doesn't require an API key
      return true
    case 'custom':
      // Custom providers - just check it's not empty
      return trimmed.length > 0
    default:
      return trimmed.length > 10
  }
}

/**
 * Securely clear a string from memory (as much as possible in JS)
 */
export function secureClear(str: string): void {
  // In JavaScript, we can't truly clear strings from memory
  // but we can at least overwrite the variable reference
  // The GC will eventually clean up the original string
  // This is a best-effort approach
  if (typeof str === 'string' && str.length > 0) {
    // Create a new string to replace the reference
    // The original string will be garbage collected
    str = '0'.repeat(str.length)
  }
}
