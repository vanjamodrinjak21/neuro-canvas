// Request deduplication and batching

type PendingRequest<T> = {
  promise: Promise<T>
  timestamp: number
}

/**
 * Deduplicates identical in-flight requests.
 * If the same request key is already pending, returns the existing promise.
 */
export class BatchOptimizer {
  private pending = new Map<string, PendingRequest<unknown>>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Periodically clean stale entries (older than 60s)
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 30000)
    }
  }

  /**
   * Execute a function with deduplication.
   * If an identical request (same key) is already in-flight, returns the same promise.
   */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as PendingRequest<T> | undefined
    if (existing) {
      return existing.promise
    }

    const promise = fn().finally(() => {
      this.pending.delete(key)
    })

    this.pending.set(key, { promise, timestamp: Date.now() })
    return promise
  }

  /**
   * Generate a dedup key from request parameters.
   */
  static makeKey(params: Record<string, unknown>): string {
    return JSON.stringify(params, Object.keys(params).sort())
  }

  /**
   * Get count of in-flight requests.
   */
  get pendingCount(): number {
    return this.pending.size
  }

  private cleanup(): void {
    const now = Date.now()
    const maxAge = 60000 // 60 seconds

    for (const [key, req] of this.pending) {
      if (now - req.timestamp > maxAge) {
        this.pending.delete(key)
      }
    }
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.pending.clear()
  }
}

// Singleton instance
let _instance: BatchOptimizer | null = null

export function getBatchOptimizer(): BatchOptimizer {
  if (!_instance) {
    _instance = new BatchOptimizer()
  }
  return _instance
}
