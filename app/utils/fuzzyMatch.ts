/**
 * Compute Levenshtein edit distance between two strings.
 * Uses the classic DP algorithm with O(min(m,n)) space.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) [a, b] = [b, a]

  const m = a.length
  const n = b.length
  let prev = Array.from({ length: m + 1 }, (_, i) => i)
  let curr = new Array(m + 1)

  for (let j = 1; j <= n; j++) {
    curr[0] = j
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[i] = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[m]
}

/**
 * Normalized similarity between two strings (0 = no match, 1 = identical).
 * Case-insensitive, trims whitespace.
 */
export function normalizedSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase()
  const nb = b.trim().toLowerCase()
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(na, nb) / maxLen
}

/**
 * Find the best fuzzy match for `query` among `candidates`.
 * Returns null if no candidate meets the similarity threshold.
 */
export function fuzzyFindBestMatch(
  query: string,
  candidates: string[],
  threshold: number = 0.8
): { match: string; similarity: number; index: number } | null {
  let bestMatch: string | null = null
  let bestSimilarity = 0
  let bestIndex = -1

  for (let i = 0; i < candidates.length; i++) {
    const sim = normalizedSimilarity(query, candidates[i]!)
    if (sim > bestSimilarity) {
      bestSimilarity = sim
      bestMatch = candidates[i]!
      bestIndex = i
    }
  }

  if (bestMatch && bestSimilarity >= threshold) {
    return { match: bestMatch, similarity: bestSimilarity, index: bestIndex }
  }

  return null
}
