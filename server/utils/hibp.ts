import { createHash } from 'node:crypto'

/**
 * Check if a password has been found in data breaches using the
 * HaveIBeenPwned Passwords API with k-anonymity (range search).
 *
 * Only the first 5 characters of the SHA-1 hash are sent to the API.
 * The full hash never leaves the server.
 *
 * @returns Number of times the password appeared in breaches, or 0 if clean
 */
export async function checkBreachedPassword(password: string): Promise<number> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'NeuroCanvas-PasswordCheck',
        'Add-Padding': 'true' // Pad response to prevent size-based analysis
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    if (!response.ok) {
      // API unavailable — don't block the user, just skip the check
      return 0
    }

    const text = await response.text()
    const lines = text.split('\n')

    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(':')
      if (hashSuffix === suffix) {
        return Number.parseInt(count, 10) || 1
      }
    }

    return 0
  } catch {
    // Network error or timeout — fail open (don't block password changes)
    return 0
  }
}
