// Retry strategy with exponential backoff and fallback providers

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  multiplier: number
  retryableErrors: Set<string>
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  multiplier: 2,
  retryableErrors: new Set([
    'rate_limit',
    'timeout',
    'server_error',
    '529',
    '429',
    '500',
    '502',
    '503',
    '504',
    'ECONNRESET',
    'ETIMEDOUT',
    'fetch failed'
  ])
}

function isRetryable(error: Error, config: RetryConfig): boolean {
  const msg = error.message.toLowerCase()
  for (const pattern of config.retryableErrors) {
    if (msg.includes(pattern.toLowerCase())) return true
  }
  return false
}

function computeDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelayMs * Math.pow(config.multiplier, attempt)
  // Add jitter (10-30% random)
  const jitter = delay * (0.1 + Math.random() * 0.2)
  return Math.min(delay + jitter, config.maxDelayMs)
}

/**
 * Execute an async function with exponential backoff retry.
 * Optionally falls back to alternative functions on exhaustion.
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  fallbacks: Array<() => Promise<T>> = []
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  let lastError: Error = new Error('No attempts made')

  // Try primary
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))

      if (attempt < cfg.maxRetries && isRetryable(lastError, cfg)) {
        const delay = computeDelay(attempt, cfg)
        cfg.onRetry?.(attempt + 1, lastError, delay)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (!isRetryable(lastError, cfg)) {
        // Non-retryable error — skip to fallbacks immediately
        break
      }
    }
  }

  // Try fallbacks
  for (const fallback of fallbacks) {
    try {
      return await fallback()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastError
}
