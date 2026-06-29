import { describe, it, expect } from 'vitest'
import { dotProductSimilarity, rankHybridSearch } from '~/utils/hybridSearch'

// L2-normalised stand-ins so dot product == cosine and lands in [-1, 1].
const ZERO = [0, 0, 0, 0]
const Q = [1, 0, 0, 0]
const NEAR = [0.9701425, 0.2425356, 0, 0] // ~0.97 similarity to Q
const FAR = [0, 0, 0, 1] // 0 similarity to Q

describe('dotProductSimilarity', () => {
  it('computes the dot product (handles non-multiple-of-4 lengths)', () => {
    expect(dotProductSimilarity([1, 2, 3], [4, 5, 6])).toBeCloseTo(32)
    expect(dotProductSimilarity([1, 0, 0, 0, 1], [1, 0, 0, 0, 1])).toBeCloseTo(2)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(dotProductSimilarity(Q, FAR)).toBeCloseTo(0)
  })
})

describe('rankHybridSearch', () => {
  // The bug: on the desktop SPA the query "abu dhabi" found nothing. A plain
  // text/substring match must work even when the semantic score is 0, so search
  // never depends solely on embedding quality.
  it('finds a node by substring match with zero semantic signal', () => {
    const results = rankHybridSearch(
      'abu dhabi',
      [{ id: 'n1', content: 'Abu Dhabi GP — tyre strategy', embedding: ZERO }],
      ZERO,
    )
    expect(results).toHaveLength(1)
    expect(results[0]!.nodeId).toBe('n1')
    expect(results[0]!.matchType).toBe('exact')
    expect(results[0]!.similarity).toBeGreaterThan(0.15)
  })

  it('scores an exact (whole-string, case-insensitive) match highest', () => {
    const results = rankHybridSearch(
      'abu dhabi',
      [
        { id: 'exact', content: 'Abu Dhabi', embedding: ZERO },
        { id: 'partial', content: 'Abu Dhabi GP strategy notes', embedding: ZERO },
      ],
      ZERO,
    )
    expect(results[0]!.nodeId).toBe('exact')
  })

  it('classifies a pure embedding hit (no text overlap) as semantic', () => {
    const results = rankHybridSearch(
      'finale race',
      [{ id: 'n1', content: 'Yas Marina circuit', embedding: NEAR }],
      Q,
    )
    expect(results).toHaveLength(1)
    expect(results[0]!.matchType).toBe('semantic')
  })

  it('classifies a text + semantic hit as hybrid', () => {
    const results = rankHybridSearch(
      'abu dhabi',
      [{ id: 'n1', content: 'Abu Dhabi finale', embedding: NEAR }],
      Q,
    )
    expect(results[0]!.matchType).toBe('hybrid')
  })

  it('drops nodes below the relevance threshold (no text, no semantic)', () => {
    const results = rankHybridSearch(
      'monaco',
      [{ id: 'n1', content: 'Singapore night race', embedding: FAR }],
      Q,
    )
    expect(results).toHaveLength(0)
  })

  it('sorts by similarity descending and respects topK', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`,
      content: `lap ${i} abu dhabi`,
      embedding: ZERO,
    }))
    const results = rankHybridSearch('abu dhabi', nodes, ZERO, 3)
    expect(results).toHaveLength(3)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.similarity).toBeGreaterThanOrEqual(results[i]!.similarity)
    }
  })

  it('returns an empty array for an empty node set', () => {
    expect(rankHybridSearch('anything', [], Q)).toEqual([])
  })

  // Regression: a node passed in before it's embedded ([]) must still text-match
  // even when the QUERY is embedded — the old code multiplied num*undefined and
  // produced NaN, which silently dropped every not-yet-embedded node.
  it('text-matches a not-yet-embedded node even when the query is embedded', () => {
    const results = rankHybridSearch(
      'abu dhabi',
      [{ id: 'n1', content: 'Abu Dhabi GP', embedding: [] }],
      Q,
    )
    expect(results).toHaveLength(1)
    expect(results[0]!.nodeId).toBe('n1')
    expect(Number.isFinite(results[0]!.similarity)).toBe(true)
  })

  it('ignores a length-mismatched embedding (no NaN; text still ranks)', () => {
    const results = rankHybridSearch(
      'abu dhabi',
      [{ id: 'n1', content: 'Abu Dhabi', embedding: [1, 0] }],
      Q,
    )
    expect(results).toHaveLength(1)
    expect(Number.isFinite(results[0]!.similarity)).toBe(true)
  })
})
