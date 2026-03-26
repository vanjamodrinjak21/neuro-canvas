import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHmac } from 'crypto'

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''

/**
 * Derive a master key from AUTH_SECRET using scrypt
 */
function getMasterKey(): Buffer {
  if (!AUTH_SECRET) {
    throw new Error('AUTH_SECRET is not set — cannot derive encryption keys')
  }
  return scryptSync(AUTH_SECRET, 'neurocanvas:master:v1', 32)
}

/**
 * Derive a per-user Key Encryption Key (KEK) using HMAC-SHA256
 * Replaces the weak `nc-${userId}-${email}-key` pattern
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
 * Server-side AES-256-GCM decryption
 */
export function serverDecrypt(encrypted: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format')
  }

  const [ivHex, authTagHex, ciphertext] = parts as [string, string, string]
  const key = getMasterKey()
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
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

export function serverFullDecrypt(userId: string, doubleEncryptedValue: string): string {
  const clientEncrypted = serverDecrypt(doubleEncryptedValue)
  const kek = deriveUserKEK(userId)
  return decryptClientLayer(clientEncrypted, kek)
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
