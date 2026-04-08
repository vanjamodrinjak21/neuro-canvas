import { describe, it, expect } from 'vitest'
import { levenshteinDistance, normalizedSimilarity, fuzzyFindBestMatch } from '../fuzzyMatch'

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0)
  })

  it('returns string length for empty comparison', () => {
    expect(levenshteinDistance('hello', '')).toBe(5)
    expect(levenshteinDistance('', 'world')).toBe(5)
  })

  it('counts single character edits', () => {
    expect(levenshteinDistance('cat', 'car')).toBe(1)
    expect(levenshteinDistance('cat', 'cats')).toBe(1)
    expect(levenshteinDistance('cat', 'at')).toBe(1)
  })

  it('handles multi-edit distances', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
  })
})

describe('normalizedSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(normalizedSimilarity('hello', 'hello')).toBe(1)
  })

  it('returns 0 for completely different strings', () => {
    expect(normalizedSimilarity('abc', 'xyz')).toBe(0)
  })

  it('is case-insensitive', () => {
    expect(normalizedSimilarity('Hello', 'hello')).toBe(1)
  })

  it('trims whitespace', () => {
    expect(normalizedSimilarity('  hello  ', 'hello')).toBe(1)
  })

  it('returns value between 0 and 1 for partial matches', () => {
    const sim = normalizedSimilarity('Photosynthesis', 'Photosyntheis')
    expect(sim).toBeGreaterThan(0.8)
    expect(sim).toBeLessThan(1)
  })
})

describe('fuzzyFindBestMatch', () => {
  const candidates = ['Photosynthesis', 'Cellular Respiration', 'Mitosis', 'DNA Replication']

  it('returns exact match when available', () => {
    const result = fuzzyFindBestMatch('Photosynthesis', candidates)
    expect(result).not.toBeNull()
    expect(result!.match).toBe('Photosynthesis')
    expect(result!.similarity).toBe(1)
  })

  it('returns fuzzy match above threshold', () => {
    const result = fuzzyFindBestMatch('Photosyntheis', candidates, 0.8)
    expect(result).not.toBeNull()
    expect(result!.match).toBe('Photosynthesis')
    expect(result!.similarity).toBeGreaterThan(0.8)
  })

  it('returns null when no match meets threshold', () => {
    const result = fuzzyFindBestMatch('Completely Different Topic', candidates, 0.8)
    expect(result).toBeNull()
  })

  it('is case-insensitive', () => {
    const result = fuzzyFindBestMatch('photosynthesis', candidates, 0.8)
    expect(result).not.toBeNull()
    expect(result!.match).toBe('Photosynthesis')
  })

  it('returns best match when multiple candidates are similar', () => {
    const result = fuzzyFindBestMatch('DNA Replicaton', candidates, 0.8)
    expect(result).not.toBeNull()
    expect(result!.match).toBe('DNA Replication')
  })
})
