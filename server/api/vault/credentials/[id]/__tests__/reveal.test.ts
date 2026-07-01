// ---------------------------------------------------------------------------
// AER-61 — owner-scoped BYOK reveal endpoint
//   GET /api/vault/credentials/:id/reveal
// ---------------------------------------------------------------------------
//
// Exercises the ACTUAL route handler (defineEventHandler) against a fake h3
// event. The source relies on Nuxt auto-imports (defineEventHandler,
// createError, getRouterParam, setResponseHeader) which vitest does not inject,
// so we stub them as globals with the REAL h3 implementations — meaning status
// codes, router-param reads and response-header writes go through the same code
// path production uses. The module-level imports (auth, rate-limit, crypto,
// prisma) are mocked so we can drive each branch deterministically.
//
// Coverage:
//   - 200 for the owner (returns { provider, apiKey }, no-store header, audit)
//   - 404 for a credential owned by ANOTHER user (IDOR — must NOT be 403)
//   - 404 for a genuinely missing credential (indistinguishable from IDOR case)
//   - 401 when unauthenticated
//   - 429 when over the per-user rate limit
//   - decrypt failure surfaces a 500 with NO key / ciphertext in the body
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createError as h3CreateError,
  getRouterParam as h3GetRouterParam,
  setResponseHeader as h3SetResponseHeader,
} from 'h3'

// --- Mocks for the handler's module-level imports --------------------------

vi.mock('../../../../../utils/syncHelpers', () => ({
  requireAuthSession: vi.fn(),
}))
vi.mock('../../../../../utils/redis', () => ({
  checkRateLimit: vi.fn(),
}))
vi.mock('../../../../../utils/resolveCredential', () => ({
  resolveCredential: vi.fn(),
}))
vi.mock('../../../../../utils/prisma', () => ({
  prisma: {
    credential: { findFirst: vi.fn() },
  },
}))

// --- h3 auto-import globals (real implementations) -------------------------
// The handler calls these as bare globals; wire them to real h3 so createError
// yields real { statusCode } errors and header writes hit our fake event.
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('createError', h3CreateError)
vi.stubGlobal('getRouterParam', h3GetRouterParam)
vi.stubGlobal('setResponseHeader', h3SetResponseHeader)

// --- Helpers ---------------------------------------------------------------

type Handler = (event: unknown) => Promise<unknown>

/** Build a fake h3 event whose header writes we can inspect. */
function makeEvent(id: string | undefined) {
  const headers: Record<string, string> = {}
  const event = {
    context: { params: id === undefined ? {} : { id } },
    node: {
      res: {
        setHeader: (k: string, v: string) => { headers[k] = v },
        getHeader: (k: string) => headers[k],
        removeHeader: (k: string) => { headers[k] = '' },
      },
    },
  }
  return { event, headers }
}

async function loadHandler(): Promise<Handler> {
  const mod = await import('../reveal.get')
  return mod.default as unknown as Handler
}

const OWNER = 'user_owner'
const CRED_ID = 'cred_abc123'
const PLAINTEXT_KEY = 'sk-secret-plaintext-value-do-not-leak'

describe('GET /api/vault/credentials/:id/reveal (AER-61)', () => {
  let requireAuthSession: ReturnType<typeof vi.fn>
  let checkRateLimit: ReturnType<typeof vi.fn>
  let resolveCredential: ReturnType<typeof vi.fn>
  let prismaFindFirst: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    requireAuthSession = (await import('../../../../../utils/syncHelpers')).requireAuthSession as ReturnType<typeof vi.fn>
    checkRateLimit = (await import('../../../../../utils/redis')).checkRateLimit as ReturnType<typeof vi.fn>
    resolveCredential = (await import('../../../../../utils/resolveCredential')).resolveCredential as ReturnType<typeof vi.fn>
    prismaFindFirst = (await import('../../../../../utils/prisma')).prisma.credential.findFirst as ReturnType<typeof vi.fn>

    // Sensible defaults — the owner, under the limit. Individual tests override.
    requireAuthSession.mockResolvedValue({ userId: OWNER, email: 'owner@test.dev' })
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 })
  })

  it('returns { provider, apiKey } for the credential owner', async () => {
    prismaFindFirst.mockResolvedValue({ id: CRED_ID })
    resolveCredential.mockResolvedValue({ apiKey: PLAINTEXT_KEY, provider: 'anthropic', credentialId: CRED_ID })

    const handler = await loadHandler()
    const { event, headers } = makeEvent(CRED_ID)
    const auditSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const result = await handler(event) as { provider: string; apiKey: string }

    // Contract: exactly { provider, apiKey } and the key IS returned to owner.
    expect(result).toEqual({ provider: 'anthropic', apiKey: PLAINTEXT_KEY })
    expect(result.apiKey).toBe(PLAINTEXT_KEY)

    // Ownership was enforced with the explicit { id, userId } scope.
    expect(prismaFindFirst).toHaveBeenCalledWith({
      where: { id: CRED_ID, userId: OWNER },
      select: { id: true },
    })
    // Decrypt was owner-scoped (userId + credentialId), reusing existing crypto.
    expect(resolveCredential).toHaveBeenCalledWith(OWNER, CRED_ID)

    // no-store proof.
    expect(headers['Cache-Control']).toBe('no-store')
    expect(headers['Pragma']).toBe('no-cache')

    // Audit line fires with the right fields and WITHOUT the key.
    expect(auditSpy).toHaveBeenCalledTimes(1)
    const [tag, payload] = auditSpy.mock.calls[0] as [string, string]
    expect(tag).toContain('credential_revealed')
    expect(payload).toContain(OWNER)
    expect(payload).toContain(CRED_ID)
    expect(payload).toContain('anthropic')
    expect(payload).not.toContain(PLAINTEXT_KEY)
    auditSpy.mockRestore()
  })

  it('IDOR: 404 (never 403) for a credential owned by another user', async () => {
    // The credential exists but is NOT owned by the caller → findFirst({id,userId})
    // returns null, exactly like a missing row. Must 404, never 403, never leak.
    prismaFindFirst.mockResolvedValue(null)

    const handler = await loadHandler()
    const { event, headers } = makeEvent(CRED_ID)

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 })

    // Never touched crypto for a non-owned id → no key path executed.
    expect(resolveCredential).not.toHaveBeenCalled()
    // No plaintext, and specifically not a 403 (which would disclose existence).
    await handler(event).catch((e: { statusCode: number }) => {
      expect(e.statusCode).not.toBe(403)
    })
    // no-store header not set on the reject path (we short-circuit before it) —
    // and critically no key material anywhere.
    expect(headers['Cache-Control']).toBeUndefined()
  })

  it('404 for a genuinely missing credential (indistinguishable from IDOR)', async () => {
    prismaFindFirst.mockResolvedValue(null)
    const handler = await loadHandler()
    const { event } = makeEvent('cred_does_not_exist')
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 404 })
    expect(resolveCredential).not.toHaveBeenCalled()
  })

  it('401 when unauthenticated', async () => {
    requireAuthSession.mockRejectedValue(h3CreateError({ statusCode: 401, statusMessage: 'Unauthorized' }))
    const handler = await loadHandler()
    const { event } = makeEvent(CRED_ID)
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
    // Fails before rate-limit / ownership / crypto.
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(prismaFindFirst).not.toHaveBeenCalled()
    expect(resolveCredential).not.toHaveBeenCalled()
  })

  it('429 when over the per-user rate limit', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const handler = await loadHandler()
    const { event } = makeEvent(CRED_ID)
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 429 })
    // Rate-limit short-circuits before ownership/crypto.
    expect(prismaFindFirst).not.toHaveBeenCalled()
    expect(resolveCredential).not.toHaveBeenCalled()
  })

  it('rate limit is keyed per-user (vault:reveal:<userId>, 10/60s)', async () => {
    prismaFindFirst.mockResolvedValue({ id: CRED_ID })
    resolveCredential.mockResolvedValue({ apiKey: PLAINTEXT_KEY, provider: 'openai', credentialId: CRED_ID })
    const handler = await loadHandler()
    const { event } = makeEvent(CRED_ID)
    const auditSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    await handler(event)
    expect(checkRateLimit).toHaveBeenCalledWith(`vault:reveal:${OWNER}`, 10, 60)
    auditSpy.mockRestore()
  })

  it('decrypt failure surfaces a 500 with NO key or ciphertext in the body', async () => {
    prismaFindFirst.mockResolvedValue({ id: CRED_ID })
    // Mirror resolveCredential's real failure: a generic 500, code only.
    resolveCredential.mockRejectedValue(
      h3CreateError({
        statusCode: 500,
        statusMessage: 'Failed to decrypt API key. Try removing and re-adding your key in Settings.',
        data: { code: 'CREDENTIAL_DECRYPT_FAILED' },
      })
    )
    const handler = await loadHandler()
    const { event } = makeEvent(CRED_ID)

    const err = await handler(event).catch((e: unknown) => e) as {
      statusCode: number; statusMessage: string; data?: unknown
    }
    expect(err.statusCode).toBe(500)
    // The generic message and serialized error must never contain the plaintext.
    const serialized = JSON.stringify({ msg: err.statusMessage, data: err.data })
    expect(serialized).not.toContain(PLAINTEXT_KEY)
    expect(serialized).not.toContain('sk-')
  })
})
