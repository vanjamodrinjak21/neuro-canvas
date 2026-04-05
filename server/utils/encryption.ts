import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHmac } from 'crypto'

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''
const AUTH_SECRET_OLD = process.env.AUTH_SECRET_OLD || ''

/**
 * Derive a master key from a given secret using scrypt
 */
function deriveMasterKey(secret: string): Buffer {
  if (!secret) {
    throw new Error('Cannot derive encryption key from empty secret')
  }
  return scryptSync(secret, 'neurocanvas:master:v1', 32)
}

/**
 * Derive a master key from the current AUTH_SECRET
 */
function getMasterKey(): Buffer {
  return deriveMasterKey(AUTH_SECRET)
}

/**
 * Derive a per-user Key Encryption Key (KEK) using HMAC-SHA256
 */
export function deriveUserKEK(userId: string): string {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not set')
  }
  const hmac = createHmac('sha256', AUTH_SECRET)
  hmac.update(`neurocanvas:kek:v1:${userId}`)
  return hmac.digest('hex')
}

/**
 * Derive a per-user KEK from the old AUTH_SECRET (for rotation)
 */
function deriveUserKEKOld(userId: string): string | null {
  if (!AUTH_SECRET_OLD) return null
  const hmac = createHmac('sha256', AUTH_SECRET_OLD)
  hmac.update(`neurocanvas:kek:v1:${userId}`)
  return hmac.digest('hex')
}

/**
 * Server-side AES-256-GCM encryption
 * Format: iv:authTag:ciphertext (all hex-encoded)
 */
export function serverEncrypt(plaintext: string): string {
  const key = getMasterKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Server-side AES-256-GCM decryption.
 * Tries current AUTH_SECRET first, falls back to AUTH_SECRET_OLD if set.
 * Returns the decrypted value and whether the old key was used.
 */
export function serverDecrypt(encrypted: string): { decrypted: string; usedOldKey: boolean } {
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format')
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string]

  // Try current key first
  try {
    const key = getMasterKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return { decrypted, usedOldKey: false }
  } catch (currentKeyError) {
    // If no old key configured, rethrow
    if (!AUTH_SECRET_OLD) throw currentKeyError
  }

  // Try old key
  const oldKey = deriveMasterKey(AUTH_SECRET_OLD)
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', oldKey, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return { decrypted, usedOldKey: true }
}

/**
 * HMAC of first 8 chars for key identification without decryption
 */
export function hashKeyPrefix(apiKey: string): string {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not set — cannot hash key prefix')
  }
  const prefix = apiKey.slice(0, 8)
  const hmac = createHmac('sha256', AUTH_SECRET)
  hmac.update(prefix)
  return hmac.digest('hex').slice(0, 16)
}

/**
 * Full decrypt: remove server layer, then client layer.
 * If AUTH_SECRET_OLD was used, self-heals by re-encrypting with current secret.
 * Returns { plaintext, credentialUpdate } — caller should persist credentialUpdate if present.
 */
/**
 * Full decrypt: supports both server-only (v4) and double-encrypted (v1-3) credentials.
 * v4: server-only AES-256-GCM — just unwrap the server layer.
 * v1-3: double-encrypted — unwrap server layer, then client layer with KEK.
 */
export function serverFullDecrypt(
  userId: string,
  encryptedValue: string,
  encryptionVersion: number = 2
): { plaintext: string; credentialUpdate?: { encryptedValue: string; encryptionVersion: number } } {
  const { decrypted, usedOldKey } = serverDecrypt(encryptedValue)

  // Version 4: server-only encryption — decrypted value IS the plaintext
  if (encryptionVersion >= 4) {
    if (usedOldKey) {
      const reEncrypted = serverEncrypt(decrypted)
      return { plaintext: decrypted, credentialUpdate: { encryptedValue: reEncrypted, encryptionVersion: 4 } }
    }
    return { plaintext: decrypted }
  }

  // Version 1-3: double-encrypted — need to peel client layer too
  let plaintext: string | null = null
  try {
    const kek = deriveUserKEK(userId)
    plaintext = decryptClientLayer(decrypted, kek)
  } catch {
    const oldKek = deriveUserKEKOld(userId)
    if (oldKek) {
      plaintext = decryptClientLayer(decrypted, oldKek)
    }
  }

  if (plaintext === null) {
    throw new Error('Failed to decrypt credential: no valid key')
  }

  if (usedOldKey) {
    const reEncrypted = serverEncrypt(decrypted)
    return { plaintext, credentialUpdate: { encryptedValue: reEncrypted, encryptionVersion: 3 } }
  }

  return { plaintext }
}

function decryptClientLayer(base64Blob: string, passphrase: string): string {
  const { pbkdf2Sync } = require('crypto') as typeof import('crypto')
  const raw = Buffer.from(base64Blob, 'base64')

  if (raw.length < 28) {
    throw new Error('Invalid encrypted blob: too short')
  }

  const salt = raw.subarray(0, 16)
  const iv = raw.subarray(16, 28)
  const encryptedWithTag = raw.subarray(28)

  if (encryptedWithTag.length < 16) {
    throw new Error('Invalid encrypted blob: missing auth tag')
  }

  const authTag = encryptedWithTag.subarray(encryptedWithTag.length - 16)
  const ciphertext = encryptedWithTag.subarray(0, encryptedWithTag.length - 16)

  const key = pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext)
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}
