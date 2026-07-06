// totpStepUp — post-login TOTP verification marks (AER-84).
// One mark per (userId, sign-in iat): covers exactly one session, TTL matches
// the session maxAge, and only an exact `true` counts as verified.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cache } from '../redis'
import { markTotpStepUp, hasTotpStepUp } from '../totpStepUp'

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
