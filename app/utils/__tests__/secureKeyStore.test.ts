import { describe, it, expect, beforeEach } from 'vitest'
import { wrapKey, unwrapKey, readKey, isWrapped } from '../secureKeyStore'

// happy-dom provides localStorage + crypto.subtle; ensure a clean slate
// between tests so the per-install material isn't accidentally shared.
beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear()
})

describe('secureKeyStore', () => {
  it('round-trips a plaintext key through wrap/unwrap', async () => {
    const plain = 'sk-proj-abc123XYZ'
    const wrapped = await wrapKey(plain)
    expect(isWrapped(wrapped)).toBe(true)
    expect(wrapped).not.toContain(plain)
    expect(await unwrapKey(wrapped)).toBe(plain)
  })

  it('produces different ciphertext for the same plaintext (IV is random)', async () => {
    const a = await wrapKey('same-key')
    const b = await wrapKey('same-key')
    expect(a).not.toBe(b)
    // But both decrypt back to the same plaintext
    expect(await unwrapKey(a)).toBe('same-key')
    expect(await unwrapKey(b)).toBe('same-key')
  })

  it('passes legacy plaintext through readKey unchanged', async () => {
    const legacy = 'plaintext-api-key-from-before-wrap-shipped'
    expect(isWrapped(legacy)).toBe(false)
    expect(await readKey(legacy)).toBe(legacy)
  })

  it('readKey returns null for empty / null / undefined', async () => {
    expect(await readKey('')).toBeNull()
    expect(await readKey(null)).toBeNull()
    expect(await readKey(undefined)).toBeNull()
  })

  it('readKey returns null on malformed wrapped value (corrupt material)', async () => {
    // Manually fabricate a "wrapped" string that uses garbage payload
    const fake = 'enc1:bm90X2J5dGVz:bm90X2J5dGVz'
    expect(await readKey(fake)).toBeNull()
  })

  it('isWrapped detects the enc1: tag and nothing else', () => {
    expect(isWrapped('enc1:foo:bar')).toBe(true)
    expect(isWrapped('plaintext')).toBe(false)
    expect(isWrapped('')).toBe(false)
    expect(isWrapped(null)).toBe(false)
    expect(isWrapped(undefined)).toBe(false)
    // Don't match unknown future tags
    expect(isWrapped('enc2:foo:bar')).toBe(false)
  })

  it('handles unicode plaintext correctly', async () => {
    const plain = 'sk-中文-éñ-🔑-test'
    const wrapped = await wrapKey(plain)
    expect(await unwrapKey(wrapped)).toBe(plain)
  })

  it('produces the same plaintext within one session for stable material', async () => {
    // Wrap once, unwrap multiple times — should always match.
    const wrapped = await wrapKey('stable-test')
    expect(await unwrapKey(wrapped)).toBe('stable-test')
    expect(await unwrapKey(wrapped)).toBe('stable-test')
    expect(await unwrapKey(wrapped)).toBe('stable-test')
  })
})
