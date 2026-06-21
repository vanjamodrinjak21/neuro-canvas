import { describe, it, expect, beforeEach, vi } from 'vitest'

// Capture the Lua eval call so we can inspect the KEYS[1] argument that
// checkRateLimit forwards to Redis. redis.ts does:
//   import Redis from 'ioredis'
//   export const redis = new Redis(redisUrl, {...})
//   await (redis as any).eval(RATE_LIMIT_LUA, numKeys, KEYS[1], ARGV[1])
// so we mock the ioredis default export to return a stub whose `eval` is a spy.

const evalMock = vi.fn()

vi.mock('ioredis', () => {
  // Minimal ioredis stub: only the members redis.ts touches need to exist.
  class RedisStub {
    eval = evalMock
    // evalsha is included in case the implementation switches to script caching.
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

/**
 * Extract the KEYS[1] argument from an ioredis `eval`/`evalsha` invocation.
 * Signature: eval(script, numKeys, KEYS[1], ARGV[1], ...) -> index 2.
 */
function capturedKey(call: unknown[]): unknown {
  return call[2]
}

describe('checkRateLimit — Redis key passthrough (AER-48)', () => {
  beforeEach(() => {
    evalMock.mockReset()
  })

  it('passes the caller key VERBATIM to Redis (no sync:rate: prefix)', async () => {
    evalMock.mockResolvedValue(1)
    const { checkRateLimit } = await import('../redis')

    await checkRateLimit('ai:u1', 5, 60)

    expect(evalMock).toHaveBeenCalledTimes(1)
    const key = capturedKey(evalMock.mock.calls[0]!)
    // Desired behavior: the verbatim namespace the caller chose.
    expect(key).toBe('ai:u1')
    // Guard against the bug where syncRate() rewrites it.
    expect(key).not.toBe('sync:rate:ai:u1')
  })

  it('maps distinct caller keys to DISTINCT Redis keys', async () => {
    evalMock.mockResolvedValue(1)
    const { checkRateLimit } = await import('../redis')

    await checkRateLimit('ai:u1', 5, 60)
    await checkRateLimit('search:u1', 5, 60)

    expect(evalMock).toHaveBeenCalledTimes(2)
    const firstKey = capturedKey(evalMock.mock.calls[0]!)
    const secondKey = capturedKey(evalMock.mock.calls[1]!)

    expect(firstKey).toBe('ai:u1')
    expect(secondKey).toBe('search:u1')
    // Core of the collision bug: these MUST NOT collapse to the same Redis key.
    expect(firstKey).not.toBe(secondKey)
  })

  it('forwards the window (ARGV[1]) and returns allowed/remaining correctly', async () => {
    evalMock.mockResolvedValue(3)
    const { checkRateLimit } = await import('../redis')

    const result = await checkRateLimit('ai:u1', 5, 90)

    const call = evalMock.mock.calls[0]!
    // ARGV[1] is the window in seconds, passed after KEYS[1].
    expect(call[3]).toBe(90)
    expect(result).toEqual({ allowed: true, remaining: 2 })
  })

  it('fails CLOSED on a Redis/eval error', async () => {
    evalMock.mockRejectedValue(new Error('redis down'))
    const { checkRateLimit } = await import('../redis')

    const result = await checkRateLimit('ai:u1', 5, 60)

    expect(result.allowed).toBe(false)
  })
})
