// totpStepUp — post-login TOTP verification marks (AER-84).
// One mark per (userId, sign-in iat): covers exactly one session, TTL matches
// the session maxAge, and only an exact `true` counts as verified.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cache } from '../redis'
import {
  markTotpStepUp,
  hasTotpStepUp,
  issueTotpRememberToken,
  redeemTotpRememberToken,
} from '../totpStepUp'

vi.mock('../redis', () => ({
  cache: { get: vi.fn(), set: vi.fn() }
}))

const cacheGet = cache.get as unknown as ReturnType<typeof vi.fn>
const cacheSet = cache.set as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  cacheGet.mockResolvedValue(null)
  cacheSet.mockResolvedValue(undefined)
})

describe('markTotpStepUp / hasTotpStepUp', () => {
  it('marks with the session-scoped key and 30-day TTL', async () => {
    await markTotpStepUp('u-1', 42)
    expect(cacheSet).toHaveBeenCalledWith('totp-stepup:u-1:42', true, 30 * 24 * 60 * 60)
  })

  it('keys on BOTH user and sign-in instant — another session never inherits the mark', async () => {
    await markTotpStepUp('u-1', 42)
    const [key] = cacheSet.mock.calls[0] as [string]
    expect(key).toContain('u-1')
    expect(key).toContain('42')
  })

  it('reads back only an exact true', async () => {
    cacheGet.mockResolvedValue(true)
    await expect(hasTotpStepUp('u-1', 42)).resolves.toBe(true)

    cacheGet.mockResolvedValue(null)
    await expect(hasTotpStepUp('u-1', 42)).resolves.toBe(false)

    cacheGet.mockResolvedValue('true') // stringly-typed junk must not pass
    await expect(hasTotpStepUp('u-1', 42)).resolves.toBe(false)
  })
})

describe('remember-device tokens (14 days)', () => {
  it('issue stores only a sha-256 hash under the user key with a 14-day TTL and returns the raw token', async () => {
    const raw = await issueTotpRememberToken('u-1')

    expect(raw).toMatch(/^[0-9a-f]{64}$/)
    const [key, value, ttl] = cacheSet.mock.calls[0] as [string, unknown, number]
    expect(key).toMatch(/^totp-remember:u-1:[0-9a-f]{64}$/)
    expect(key).not.toContain(raw) // never the raw token at rest
    expect(value).toBe(true)
    expect(ttl).toBe(14 * 24 * 60 * 60)
  })

  it('redeem accepts the issued token for the same user only', async () => {
    const raw = await issueTotpRememberToken('u-1')
    const [storedKey] = cacheSet.mock.calls[0] as [string]
    cacheGet.mockImplementation(async (k: string) => (k === storedKey ? true : null))

    await expect(redeemTotpRememberToken('u-1', raw)).resolves.toBe(true)
    await expect(redeemTotpRememberToken('u-2', raw)).resolves.toBe(false)
    await expect(redeemTotpRememberToken('u-1', 'wrong')).resolves.toBe(false)
  })

  it('redeem rejects oversized junk without touching Redis', async () => {
    await expect(redeemTotpRememberToken('u-1', 'x'.repeat(500))).resolves.toBe(false)
    expect(cacheGet).not.toHaveBeenCalled()
  })
})
