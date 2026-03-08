// Semantic cache for AI responses — Redis (web) + IndexedDB (Tauri) fallback

interface CacheEntry {
  key: string
  systemPrompt: string
  userPrompt: string
  response: string
  usage?: unknown
  createdAt: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

interface CacheStats {
  hits: number
  misses: number
  entries: number
  hitRate: number
}

const TTL_MAP: { [key: string]: number; default: number } = {
  expand: 3600,          // 1 hour (seconds for Redis)
  connect: 3600,         // 1 hour
  describe: 86400,       // 24 hours
  generate: 1800,        // 30 minutes
  insight: 3600,         // 1 hour
  default: 3600          // 1 hour
}

const MAX_LOCAL_ENTRIES = 200

/**
 * Hash a string for cache keys.
 */
function hashKey(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

export class SemanticCache {
  private localCache = new Map<string, CacheEntry>()
  private stats = { hits: 0, misses: 0 }
  private useRedis: boolean

  constructor() {
    this.useRedis = !isTauriEnvironment()
  }

  /**
   * Get a cached response. Checks Redis first (web), falls back to local.
   */
  async get(systemPrompt: string, userPrompt: string): Promise<{ response: string; usage?: unknown } | null> {
    const hash = hashKey(systemPrompt + '||' + userPrompt)

    // Try Redis first (web mode)
    if (this.useRedis) {
      try {
        const result = await $fetch<{
          hit: boolean
          response: string | null
          usage: unknown
        }>('/api/ai/cache', {
          method: 'GET',
          query: { hash }
        })

        if (result.hit && result.response) {
          this.stats.hits++
          // Also cache locally for faster subsequent hits
          this.localCache.set(hash, {
            key: hash,
            systemPrompt,
            userPrompt,
            response: result.response,
            usage: result.usage ?? undefined,
            createdAt: Date.now(),
            ttl: TTL_MAP.default * 1000,
            accessCount: 1,
            lastAccessed: Date.now()
          })
          return { response: result.response, usage: result.usage }
        }
      } catch {
        // Redis unavailable — fall through to local
      }
    }

    // Check local cache
    const entry = this.localCache.get(hash)
    if (entry) {
      const ttlMs = entry.ttl > 100000 ? entry.ttl : entry.ttl * 1000 // handle both ms and seconds
      if (Date.now() - entry.createdAt > ttlMs) {
        this.localCache.delete(hash)
        this.stats.misses++
        return null
      }
      entry.accessCount++
      entry.lastAccessed = Date.now()
      this.stats.hits++
      return { response: entry.response, usage: entry.usage }
    }

    this.stats.misses++
    return null
  }

  /**
   * Cache a response. Stores in Redis (web) and locally.
   */
  async set(
    systemPrompt: string,
    userPrompt: string,
    response: string,
    usage?: unknown,
    type: string = 'default'
  ): Promise<void> {
    const hash = hashKey(systemPrompt + '||' + userPrompt)
    const ttlSeconds: number = TTL_MAP[type] ?? TTL_MAP.default

    // Store in Redis (web mode)
    if (this.useRedis) {
      try {
        await $fetch('/api/ai/cache', {
          method: 'POST',
          body: { hash, response, usage, ttlSeconds }
        })
      } catch {
        // Redis unavailable — store locally only
      }
    }

    // Also store locally
    if (this.localCache.size >= MAX_LOCAL_ENTRIES) {
      this.evictLRU()
    }

    const now = Date.now()
    this.localCache.set(hash, {
      key: hash,
      systemPrompt,
      userPrompt,
      response,
      usage,
      createdAt: now,
      ttl: ttlSeconds * 1000,
      accessCount: 0,
      lastAccessed: now
    })
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      entries: this.localCache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    }
  }

  /**
   * Clear local cache.
   */
  clear(): void {
    this.localCache.clear()
    this.stats = { hits: 0, misses: 0 }
  }

  private evictLRU(): void {
    let oldest: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.localCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldest = key
      }
    }

    if (oldest) {
      this.localCache.delete(oldest)
    }
  }
}

// Singleton instance
let _instance: SemanticCache | null = null

export function getSemanticCache(): SemanticCache {
  if (!_instance) {
    _instance = new SemanticCache()
  }
  return _instance
}
