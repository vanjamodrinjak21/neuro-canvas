// ---------------------------------------------------------------------------
// AER-84 — POST /api/user/totp/verify-session (session step-up)
//
// Exercises the ACTUAL route handler against mocked collaborators, following
// the reveal.test.ts harness pattern (h3 auto-imports wired to real h3).
//
// Coverage: happy path marks the step-up; wrong code 400 + NO mark; replayed
// code 400 + NO mark; 2FA-disabled 400; rate limit 429; body validation 400.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createError as h3CreateError } from 'h3'
import { requireAuthSession } from '../../../../utils/syncHelpers'
import { checkRateLimit } from '../../../../utils/redis'
import { prisma } from '../../../../utils/prisma'
import { markTotpStepUp } from '../../../../utils/totpStepUp'

vi.mock('../../../../utils/syncHelpers', () => ({
  requireAuthSession: vi.fn(),
}))
vi.mock('../../../../utils/redis', () => ({
  checkRateLimit: vi.fn(),
}))
vi.mock('../../../../utils/prisma', () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('../../../../utils/encryption', () => ({
  serverDecrypt: vi.fn(() => ({ decrypted: 'JBSWY3DPEHPK3PXP' })),
}))
vi.mock('../../../../utils/totpStepUp', () => ({
  markTotpStepUp: vi.fn(),
}))
// otpauth is mocked so tests control validation outcomes deterministically.
const totpValidate = vi.fn()
vi.mock('otpauth', () => ({
  TOTP: class { validate = totpValidate },
  Secret: { fromBase32: vi.fn(() => ({})) },
}))

vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('createError', h3CreateError)
vi.stubGlobal('readBody', vi.fn())

// Dynamic import AFTER the vi.stubGlobal calls above — a static import hoists
// past them and the handler module evaluates before defineEventHandler exists.
const handler = (await import('../verify-session.post')).default

const requireAuth = requireAuthSession as unknown as ReturnType<typeof vi.fn>
const rateLimit = checkRateLimit as unknown as ReturnType<typeof vi.fn>
const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
const update = prisma.user.update as unknown as ReturnType<typeof vi.fn>
const mark = markTotpStepUp as unknown as ReturnType<typeof vi.fn>
const readBodyMock = (globalThis as Record<string, unknown>).readBody as ReturnType<typeof vi.fn>

const EVENT = {} as never
const USER = { id: 'u-1', email: 'v@x.com', totpSecret: 'enc', totpEnabled: true, lastTotpDelta: null }

function callStatus(promise: Promise<unknown>) {
  return promise.then(
    (r) => r,
    (e: { statusCode?: number }) => `status:${e.statusCode}`
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ userId: 'u-1', email: 'v@x.com', iat: 1_751_800_000, totpEnabled: true, totpClaim: 'pending' })
  rateLimit.mockResolvedValue({ allowed: true })
  findUnique.mockResolvedValue({ ...USER })
  update.mockResolvedValue({})
  readBodyMock.mockResolvedValue({ code: '123456' })
  totpValidate.mockReturnValue(0)
})

describe('POST /api/user/totp/verify-session', () => {
  it('verifies the code, records replay state, and marks the session step-up', async () => {
    const result = await (handler as (e: never) => Promise<{ success: boolean }>)(EVENT)

    expect(result).toEqual({ success: true })
    expect(mark).toHaveBeenCalledWith('u-1', 1_751_800_000)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u-1' },
      data: { lastTotpDelta: expect.any(Number) },
    }))
  })

  it('rejects an invalid code with 400 and never marks', async () => {
    totpValidate.mockReturnValue(null)

    await expect(callStatus((handler as (e: never) => Promise<unknown>)(EVENT))).resolves.toBe('status:400')
    expect(mark).not.toHaveBeenCalled()
  })

  it('rejects a replayed code (same period) with 400 and never marks', async () => {
    // lastTotpDelta encodes period*10 + delta+1 for the CURRENT period.
    const encodedNow = Math.floor(Date.now() / 30000) * 10 + 1
    findUnique.mockResolvedValue({ ...USER, lastTotpDelta: encodedNow })

    await expect(callStatus((handler as (e: never) => Promise<unknown>)(EVENT))).resolves.toBe('status:400')
    expect(mark).not.toHaveBeenCalled()
  })

  it('400s when 2FA is not enabled on the account', async () => {
    findUnique.mockResolvedValue({ ...USER, totpEnabled: false })

    await expect(callStatus((handler as (e: never) => Promise<unknown>)(EVENT))).resolves.toBe('status:400')
  })

  it('429s past the rate limit', async () => {
    rateLimit.mockResolvedValue({ allowed: false })

    await expect(callStatus((handler as (e: never) => Promise<unknown>)(EVENT))).resolves.toBe('status:429')
    expect(totpValidate).not.toHaveBeenCalled()
  })

  it('400s on a malformed body', async () => {
    readBodyMock.mockResolvedValue({ code: 'abc' })

    await expect(callStatus((handler as (e: never) => Promise<unknown>)(EVENT))).resolves.toBe('status:400')
  })
})
