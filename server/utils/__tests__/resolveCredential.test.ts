// ---------------------------------------------------------------------------
// resolveCredential — provider-scoped self-healing fallback (AER-79)
//
// Two behaviours under test on top of the existing exact-id resolution:
//   1. A STALE credentialId (deleted + re-added on another device) falls back
//      to the user's most recent credential FOR THE REQUESTED PROVIDER — but
//      ONLY when the caller states the provider. Id-strict callers (the
//      /reveal endpoint) pass no provider and keep exact-row 404 semantics.
//   2. The no-id lookup is provider-scoped when a provider is given, so an
//      anthropic request can never resolve an openai key.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createError as h3CreateError } from 'h3'
import { prisma } from '../prisma'
import { serverFullDecrypt } from '../encryption'
import { resolveCredential } from '../resolveCredential'

vi.mock('../prisma', () => ({
  prisma: { credential: { findFirst: vi.fn(), update: vi.fn() } }
}))
vi.mock('../encryption', () => ({
  serverFullDecrypt: vi.fn()
}))

// resolveCredential calls the Nuxt auto-imported createError at runtime —
// wire it to the real h3 implementation so errors carry real statusCodes.
vi.stubGlobal('createError', h3CreateError)

const findFirst = prisma.credential.findFirst as unknown as ReturnType<typeof vi.fn>
const update = prisma.credential.update as unknown as ReturnType<typeof vi.fn>
const decrypt = serverFullDecrypt as unknown as ReturnType<typeof vi.fn>

const LIVE_ROW = { id: 'cred-live', provider: 'anthropic', encryptedValue: 'enc', encryptionVersion: 4 }

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  return promise.then(
    () => undefined,
    (e: { statusCode?: number }) => e.statusCode
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  update.mockResolvedValue({})
  decrypt.mockReturnValue({ plaintext: 'sk-live' })
})

describe('resolveCredential', () => {
  it('resolves an exact credentialId scoped to the owner', async () => {
    findFirst.mockResolvedValueOnce(LIVE_ROW)

    const result = await resolveCredential('u-1', 'cred-live')

    expect(result).toMatchObject({ apiKey: 'sk-live', provider: 'anthropic', credentialId: 'cred-live' })
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst.mock.calls[0]![0].where).toMatchObject({ id: 'cred-live', userId: 'u-1' })
  })

  it('falls back to the most recent SAME-provider credential when the id is stale and a provider is given', async () => {
    findFirst
      .mockResolvedValueOnce(null)      // stale id lookup
      .mockResolvedValueOnce(LIVE_ROW)  // provider-scoped fallback

    const result = await resolveCredential('u-1', 'cred-dead', { provider: 'anthropic' })

    expect(result).toMatchObject({ apiKey: 'sk-live', credentialId: 'cred-live' })
    expect(findFirst).toHaveBeenCalledTimes(2)
    const fallback = findFirst.mock.calls[1]![0]
    expect(fallback.where).toMatchObject({ userId: 'u-1', provider: 'anthropic' })
    expect(fallback.orderBy).toMatchObject({ updatedAt: 'desc' })
  })

  it('keeps strict exact-row 404 semantics for a stale id when NO provider is given (reveal endpoint)', async () => {
    findFirst.mockResolvedValueOnce(null)

    await expect(statusOf(resolveCredential('u-1', 'cred-dead'))).resolves.toBe(404)
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it('scopes the no-id lookup to the requested provider', async () => {
    findFirst.mockResolvedValueOnce(LIVE_ROW)

    await resolveCredential('u-1', undefined, { provider: 'anthropic' })

    expect(findFirst).toHaveBeenCalledTimes(1)
    const call = findFirst.mock.calls[0]![0]
    expect(call.where).toMatchObject({ userId: 'u-1', provider: 'anthropic' })
    expect(call.orderBy).toMatchObject({ updatedAt: 'desc' })
  })

  it('keeps the legacy any-provider no-id lookup when no provider is given', async () => {
    findFirst.mockResolvedValueOnce(LIVE_ROW)

    await resolveCredential('u-1')

    const call = findFirst.mock.calls[0]![0]
    expect(call.where).toEqual({ userId: 'u-1' })
  })

  it('404s with the actionable message when the fallback also finds nothing', async () => {
    findFirst.mockResolvedValue(null)

    const failure = await resolveCredential('u-1', 'cred-dead', { provider: 'openai' }).then(
      () => { throw new Error('expected rejection') },
      (e: { statusCode?: number; statusMessage?: string }) => e
    )
    expect(failure.statusCode).toBe(404)
    expect(failure.statusMessage).toContain('No API credential found')
  })

  it('surfaces decrypt failures as 500 CREDENTIAL_DECRYPT_FAILED without key material', async () => {
    findFirst.mockResolvedValueOnce(LIVE_ROW)
    decrypt.mockImplementationOnce(() => { throw new Error('bad secret') })

    const failure = await resolveCredential('u-1', 'cred-live').then(
      () => { throw new Error('expected rejection') },
      (e: { statusCode?: number; data?: { code?: string } }) => e
    )
    expect(failure.statusCode).toBe(500)
    expect(failure.data?.code).toBe('CREDENTIAL_DECRYPT_FAILED')
  })
})
