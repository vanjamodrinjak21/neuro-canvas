import { describe, it, expect, beforeEach, vi } from 'vitest'

// reserveIngest / releaseIngest run atomic Lua via ioredis `eval`, exactly like
// checkRateLimit / syncLock. redis.ts does:
//   import Redis from 'ioredis'
//   export const redis = new Redis(redisUrl, {...})
//   await (redis as any).eval(LUA, numKeys, KEYS[1], ARGV[1], ARGV[2])
// We mock the ioredis default export to a stub whose `eval` *simulates* the Lua
// against an in-memory store keyed on KEYS[1], so the test verifies the real
// INCR/cap/DECR semantics rather than a hardcoded return value.

// In-memory Redis state shared across all eval calls in a test.
let store: Record<string, number> = {}

// Faithful re-implementation of the two Lua scripts in redis.ts. We discriminate
// the two scripts by their text so a single eval spy can serve both.
const evalMock = vi.fn((script: string, _numKeys: number, key: string, ...argv: Array<string | number>) => {
  const isReserve = script.includes("INCR") && script.includes("> tonumber(ARGV[1])")

  if (isReserve) {
    const cap = Number(argv[0])
    // INCR
    const count = (store[key] ?? 0) + 1
    store[key] = count
    if (count > cap) {
      // DECR back (roll back speculative claim) and signal over-cap with -1
      store[key] = count - 1
      return Promise.resolve(-1)
    }
    return Promise.resolve(count)
  }

  // Release script: GET → floor-at-0 DECR.
  const current = store[key] ?? 0
  if (current <= 0) {
    store[key] = 0
    return Promise.resolve(0)
  }
  const next = current - 1
  store[key] = next
  return Promise.resolve(next)
})

vi.mock('ioredis', () => {
  class RedisStub {
    eval = evalMock
    evalsha = evalMock
    get = vi.fn()
    set = vi.fn()
    del = vi.fn()
    setex = vi.fn()
    exists = vi.fn()
    scan = vi.fn()
  }
  return { default: RedisStub }
})

describe('reserveIngest / releaseIngest — per-user ingestion concurrency reserve', () => {
  beforeEach(() => {
    store = {}
    evalMock.mockClear()
  })

  it('reserve succeeds under the cap and returns the running count', async () => {
    const { reserveIngest } = await import('../redis')

    const a = await reserveIngest('u1', 3, 900)
    const b = await reserveIngest('u1', 3, 900)
    const c = await reserveIngest('u1', 3, 900)

    expect(a).toEqual({ ok: true, current: 1 })
    expect(b).toEqual({ ok: true, current: 2 })
    expect(c).toEqual({ ok: true, current: 3 })
  })

  it('fails at the cap and rolls back the speculative INCR (counter stays at cap)', async () => {
    const { reserveIngest } = await import('../redis')

    await reserveIngest('u1', 3, 900)
    await reserveIngest('u1', 3, 900)
    await reserveIngest('u1', 3, 900)

    const over = await reserveIngest('u1', 3, 900)

    expect(over.ok).toBe(false)
    // Reports the ceiling, not 4 — the over-cap INCR was rolled back.
    expect(over.current).toBe(3)
    // The Lua DECR-back kept the underlying counter pinned at the cap.
    expect(store['doc:ingest:active:u1']).toBe(3)
  })

  it('uses the correct per-user Redis key', async () => {
    const { reserveIngest } = await import('../redis')

    await reserveIngest('u1', 3, 900)

    const call = evalMock.mock.calls[0]!
    // eval(script, numKeys, KEYS[1], ARGV[1]=cap, ARGV[2]=ttl)
    expect(call[2]).toBe('doc:ingest:active:u1')
    expect(call[3]).toBe(3)
    expect(call[4]).toBe(900)
  })

  it('release decrements the active count', async () => {
    const { reserveIngest, releaseIngest } = await import('../redis')

    await reserveIngest('u1', 3, 900)
    await reserveIngest('u1', 3, 900)
    expect(store['doc:ingest:active:u1']).toBe(2)

    await releaseIngest('u1')
    expect(store['doc:ingest:active:u1']).toBe(1)

    await releaseIngest('u1')
    expect(store['doc:ingest:active:u1']).toBe(0)
  })

  it('release is floored at 0 (double-release cannot create phantom capacity)', async () => {
    const { releaseIngest, reserveIngest } = await import('../redis')

    // Release with no outstanding reserve must not drive the counter negative.
    await releaseIngest('u1')
    expect(store['doc:ingest:active:u1']).toBe(0)

    // And the next reserve still starts cleanly at 1 (not 0/negative drift),
    // so a stray release can never let a user exceed the cap later.
    const r = await reserveIngest('u1', 3, 900)
    expect(r).toEqual({ ok: true, current: 1 })
  })

  it('different users get independent reserves', async () => {
    const { reserveIngest } = await import('../redis')

    await reserveIngest('u1', 3, 900)
    await reserveIngest('u1', 3, 900)
    await reserveIngest('u1', 3, 900)
    // u1 is now at cap, but u2 is untouched.
    const u1Over = await reserveIngest('u1', 3, 900)
    const u2First = await reserveIngest('u2', 3, 900)

    expect(u1Over.ok).toBe(false)
    expect(u2First).toEqual({ ok: true, current: 1 })
    expect(store['doc:ingest:active:u1']).toBe(3)
    expect(store['doc:ingest:active:u2']).toBe(1)
  })

  it('reserve fails CLOSED on a Redis/eval error', async () => {
    evalMock.mockRejectedValueOnce(new Error('redis down'))
    const { reserveIngest } = await import('../redis')

    const result = await reserveIngest('u1', 3, 900)

    expect(result.ok).toBe(false)
    expect(result.current).toBe(0)
  })

  it('release swallows a Redis/eval error (best-effort cleanup)', async () => {
    evalMock.mockRejectedValueOnce(new Error('redis down'))
    const { releaseIngest } = await import('../redis')

    await expect(releaseIngest('u1')).resolves.toBeUndefined()
  })
})
