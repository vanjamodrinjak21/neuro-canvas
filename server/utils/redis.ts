import Redis from 'ioredis'

// Singleton pattern for Redis client
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
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
  embeddingsByMap: (mapId: string) => `emb:map:${mapId}:*`
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
