import Redis from 'ioredis'

// Singleton pattern for Redis client
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
  redisSubscriber: Redis | undefined
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis =
  globalForRedis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true
  })

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis
}

// Cache utility functions
export const cache = {
  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('Redis get error:', error)
      return null
    }
  },

  /**
   * Set cached value with optional TTL (seconds)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized)
      } else {
        await redis.set(key, serialized)
      }
    } catch (error) {
      console.error('Redis set error:', error)
    }
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error('Redis del error:', error)
    }
  },

  /**
   * Delete multiple keys by pattern using SCAN (non-blocking, production-safe)
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0'
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      } while (cursor !== '0')
    } catch (error) {
      console.error('Redis delPattern error:', error)
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await redis.exists(key)) === 1
    } catch (error) {
      console.error('Redis exists error:', error)
      return false
    }
  },

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await cache.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await fetcher()
    await cache.set(key, value, ttlSeconds)
    return value
  }
}

// Cache key builders
export const cacheKeys = {
  user: (id: string) => `user:${id}`,
  userProfile: (id: string) => `user:${id}:profile`,
  session: (token: string) => `session:${token}`,
  // Embedding cache keys (hot cache — source of truth is pgvector)
  embedding: (textHash: string) => `emb:${textHash}`,
  embeddingByNode: (mapId: string, nodeId: string) => `emb:map:${mapId}:node:${nodeId}`,
  embeddingsByMap: (mapId: string) => `emb:map:${mapId}:*`,
  // AI response cache keys
  aiResponse: (hash: string) => `ai:resp:${hash}`,
  aiResponsePattern: () => `ai:resp:*`,
  // Sync cache keys
  syncState: (userId: string) => `sync:state:${userId}`,
  syncLock: (mapId: string) => `sync:lock:${mapId}`,
  syncQueue: (userId: string) => `sync:queue:${userId}`,
  syncChanges: (userId: string) => `sync:changes:${userId}`,
  syncChannel: (userId: string) => `sync:${userId}`,
  syncRate: (userId: string) => `sync:rate:${userId}`,
  syncMetrics: () => `sync:metrics:${new Date().toISOString().slice(0, 10)}`,
  syncDevices: (userId: string) => `sync:devices:${userId}`,
  mapMeta: (mapId: string, userId?: string) => userId ? `map:meta:${userId}:${mapId}` : `map:meta:${mapId}`,
  mapData: (mapId: string, userId?: string) => userId ? `map:data:${userId}:${mapId}` : `map:data:${mapId}`,
  // Per-user document ingestion concurrency reserve (atomic Lua INCR/DECR)
  docIngestActive: (userId: string) => `doc:ingest:active:${userId}`,
  // Hybrid (RRF) document search result cache (per user)
  searchHybrid: (userId: string) => `search:hybrid:${userId}`
}

/**
 * Generate a simple hash for text content
 * Used to create cache keys for embeddings
 */
export function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

// ─── Sync Utilities ────────────────────────────────────────────────

/**
 * Dedicated Redis subscriber instance (ioredis requires a separate connection for SUBSCRIBE mode)
 */
export function getSubscriber(): Redis {
  if (!globalForRedis.redisSubscriber) {
    globalForRedis.redisSubscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })
  }
  return globalForRedis.redisSubscriber
}

/**
 * Distributed lock for map sync operations
 */
/**
 * Lua script for atomic check-and-delete (only the lock owner can release)
 * This is redis.eval for server-side Lua on Redis — NOT JavaScript eval.
 */
const RELEASE_LOCK_LUA = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`

export const syncLock = {
  async acquire(mapId: string, deviceId: string, ttlSeconds: number = 10): Promise<boolean> {
    try {
      const key = cacheKeys.syncLock(mapId)
      const result = await redis.set(key, deviceId, 'EX', ttlSeconds, 'NX')
      return result === 'OK'
    } catch (error) {
      console.error('syncLock.acquire error:', error)
      return false
    }
  },

  async release(mapId: string, deviceId: string): Promise<void> {
    try {
      // Atomic: only deletes lock if caller is the owner
      // ioredis .eval() runs a Lua script on the Redis server
      const ioredis = redis as any
      await ioredis['eval'](RELEASE_LOCK_LUA, 1, cacheKeys.syncLock(mapId), deviceId)
    } catch (error) {
      console.error('syncLock.release error:', error)
    }
  }
}

/**
 * Atomic rate limit Lua script — INCR + EXPIRE in one round-trip
 * Prevents race where key is incremented but never expires
 */
const RATE_LIMIT_LUA = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return count
`

/**
 * Rate limiter using atomic Lua script
 */
export async function checkRateLimit(
  key: string,
  max: number = 120,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    // The caller supplies the fully-qualified Redis key (e.g. 'ai:<userId>',
    // 'sync:rate:<userId>'). Use it verbatim so each purpose gets an isolated
    // bucket instead of colliding under a single shared 'sync:rate:' namespace.
    // redis.eval executes Lua atomically on Redis server — this is the standard
    // ioredis pattern for atomic INCR+EXPIRE, not arbitrary code evaluation
    const count = await (redis as any).eval(RATE_LIMIT_LUA, 1, key, windowSeconds) as number
    return { allowed: count <= max, remaining: Math.max(0, max - count) }
  } catch (error) {
    console.error('checkRateLimit error:', error)
    return { allowed: false, remaining: 0 } // Fail closed — block on Redis outage
  }
}

/**
 * Atomic ingestion-reserve Lua script — claim one concurrency slot for a user.
 *
 * INCRs the per-user active-ingestion counter, sets a TTL on first claim (so a
 * crashed worker that never releases can't permanently wedge the user out), and
 * — critically — if the new count would EXCEED the cap, DECRs back to undo the
 * speculative claim and returns -1. This keeps the check-and-claim atomic: two
 * concurrent confirms can never both squeeze past the cap. ARGV[1]=cap,
 * ARGV[2]=ttlSeconds. Returns the post-claim count, or -1 when over cap.
 *
 * This is redis.eval (server-side Lua on Redis) — NOT JavaScript eval.
 */
const RESERVE_INGEST_LUA = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  end
  if count > tonumber(ARGV[1]) then
    redis.call('DECR', KEYS[1])
    return -1
  end
  return count
`

/**
 * Atomic ingestion-release Lua script — free one concurrency slot, floored at 0.
 *
 * Never lets the counter go negative (a double-release or a release without a
 * matching reserve must not create phantom free capacity that lets a user
 * exceed the cap). Refreshes the TTL while a slot is still held so long-running
 * ingestion can't have its key expire out from under it. KEYS[1]=counter key,
 * ARGV[1]=ttlSeconds. Returns the post-release count.
 */
const RELEASE_INGEST_LUA = `
  local count = redis.call('GET', KEYS[1])
  if not count or tonumber(count) <= 0 then
    redis.call('SET', KEYS[1], 0)
    return 0
  end
  local next = redis.call('DECR', KEYS[1])
  if next > 0 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return next
`

/**
 * Reserve one document-ingestion concurrency slot for a user.
 *
 * Atomic INCR+cap-check+EXPIRE in a single Lua round-trip (mirrors
 * checkRateLimit / syncLock). Returns `{ ok, current }`:
 *  - ok=true  → slot claimed; `current` is the user's active count (≤ cap).
 *  - ok=false → at/over cap (the speculative INCR was rolled back); the caller
 *    should respond 429. `current` reports the observed count (cap on overflow).
 *
 * Fails CLOSED on a Redis error (`ok:false`) so an outage cannot be used to
 * bypass the per-user concurrency ceiling — consistent with checkRateLimit.
 *
 * The TTL is a safety net: it auto-frees a slot whose worker died before
 * calling releaseIngest, preventing a permanent lockout.
 */
export async function reserveIngest(
  userId: string,
  cap: number = 3,
  ttlSec: number = 900
): Promise<{ ok: boolean; current: number }> {
  try {
    const key = cacheKeys.docIngestActive(userId)
    // redis.eval executes Lua atomically on the Redis server — standard ioredis
    // pattern for an atomic INCR+EXPIRE+cap-check, not arbitrary code evaluation.
    const count = await (redis as any).eval(RESERVE_INGEST_LUA, 1, key, cap, ttlSec) as number
    if (count === -1) {
      // Over cap: the claim was rolled back inside Lua. Report the ceiling.
      return { ok: false, current: cap }
    }
    return { ok: true, current: count }
  } catch (error) {
    console.error('reserveIngest error:', error)
    return { ok: false, current: 0 } // Fail closed — never let a Redis outage open the gate
  }
}

/**
 * Release one document-ingestion concurrency slot for a user.
 *
 * Atomic DECR floored at 0 (a double-release or orphaned release cannot drive
 * the counter negative and silently grant extra capacity). Callers MUST invoke
 * this on EVERY post-reserve exit path (success and every 4xx), ideally in a
 * `finally`, per the implementation plan §2/P2.
 *
 * Swallows Redis errors (best-effort cleanup); the reserve TTL is the backstop
 * that reclaims the slot if this never lands.
 */
export async function releaseIngest(userId: string, ttlSec: number = 900): Promise<void> {
  try {
    const key = cacheKeys.docIngestActive(userId)
    await (redis as any).eval(RELEASE_INGEST_LUA, 1, key, ttlSec)
  } catch (error) {
    console.error('releaseIngest error:', error)
  }
}

/**
 * Redis Streams for sync event log
 */
export const syncStream = {
  async addEntry(userId: string, entry: Record<string, string>): Promise<string | null> {
    try {
      const key = cacheKeys.syncChanges(userId)
      const id = await redis.xadd(key, 'MAXLEN', '~', '1000', '*', ...Object.entries(entry).flat())
      return id
    } catch (error) {
      console.error('syncStream.addEntry error:', error)
      return null
    }
  },

  async readSince(userId: string, lastId: string = '0'): Promise<Array<{ id: string; data: Record<string, string> }>> {
    try {
      const key = cacheKeys.syncChanges(userId)
      const results = await redis.xread('COUNT', '100', 'BLOCK', '0', 'STREAMS', key, lastId)
      if (!results) return []

      const entries: Array<{ id: string; data: Record<string, string> }> = []
      for (const [, messages] of results) {
        for (const [id, fields] of messages) {
          const data: Record<string, string> = {}
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]!] = fields[i + 1]!
          }
          entries.push({ id, data })
        }
      }
      return entries
    } catch (error) {
      console.error('syncStream.readSince error:', error)
      return []
    }
  }
}

/**
 * Sync state stored as Redis hash for fast access
 */
export const syncStateCache = {
  async get(userId: string): Promise<Record<string, string> | null> {
    try {
      const key = cacheKeys.syncState(userId)
      const data = await redis.hgetall(key)
      return Object.keys(data).length > 0 ? data : null
    } catch (error) {
      console.error('syncStateCache.get error:', error)
      return null
    }
  },

  async update(userId: string, fields: Record<string, string | number>): Promise<void> {
    try {
      const key = cacheKeys.syncState(userId)
      const flat: string[] = []
      for (const [k, v] of Object.entries(fields)) {
        flat.push(k, String(v))
      }
      await redis.hset(key, ...flat)
      await redis.expire(key, 86400) // 24h TTL
    } catch (error) {
      console.error('syncStateCache.update error:', error)
    }
  }
}

/**
 * Track sync metrics (daily counters)
 */
export async function trackSyncMetric(metric: string, increment: number = 1): Promise<void> {
  try {
    const key = cacheKeys.syncMetrics()
    await redis.hincrby(key, metric, increment)
    await redis.expire(key, 172800) // 48h TTL
  } catch (error) {
    console.error('trackSyncMetric error:', error)
  }
}
