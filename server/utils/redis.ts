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
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
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
  mapMeta: (mapId: string) => `map:meta:${mapId}`,
  mapData: (mapId: string) => `map:data:${mapId}`
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

  async release(mapId: string): Promise<void> {
    try {
      await redis.del(cacheKeys.syncLock(mapId))
    } catch (error) {
      console.error('syncLock.release error:', error)
    }
  }
}

/**
 * Rate limiter using INCR + EXPIRE pattern
 */
export async function checkRateLimit(
  userId: string,
  max: number = 120,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const key = cacheKeys.syncRate(userId)
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSeconds)
    }
    return { allowed: count <= max, remaining: Math.max(0, max - count) }
  } catch (error) {
    console.error('checkRateLimit error:', error)
    return { allowed: true, remaining: max } // Fail open
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
