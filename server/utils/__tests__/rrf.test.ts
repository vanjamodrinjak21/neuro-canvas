// TDD step 1 for AER-53 — Reciprocal Rank Fusion (RRF) pure util.
//
// These tests target a not-yet-existing module `../rrf` and are EXPECTED TO
// FAIL until `server/utils/rrf.ts` is implemented. RRF fuses two ranked legs
// (HNSW semantic + GIN full-text — see plan §5) entirely in the app layer,
// scoring each chunk by the sum over the legs it appears in of 1/(k + rank),
// where ranks are 1-based. Per plan §0.1(e): k = 60, app-layer fusion, branch
// weights multiply 1/(k+r) (never raw cosine/ts_rank — those are
// incommensurable). Pure function: no DB, no Redis, no network.

import { describe, it, expect } from 'vitest'
import { rrfFuse } from '../rrf'

describe('rrfFuse — Reciprocal Rank Fusion (AER-53)', () => {
  it('returns [] for empty + empty legs', () => {
    const result = rrfFuse(new Map(), new Map(), 60, 10)
    expect(result).toEqual([])
  })

  it('single leg, rank-1, k=60 => score 1/61', () => {
    const semanticRanks = new Map<string, number>([['chunk-a', 1]])
    const ftsRanks = new Map<string, number>()

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 10)

    expect(result).toHaveLength(1)
    expect(result[0]!.chunkId).toBe('chunk-a')
    expect(result[0]!.rrfScore).toBeCloseTo(1 / 61, 12)
    expect(result[0]!.sources).toEqual({ semantic: true, fulltext: false })
  })

  it('both legs rank-1 => score 2/61 with both source flags set', () => {
    const semanticRanks = new Map<string, number>([['chunk-a', 1]])
    const ftsRanks = new Map<string, number>([['chunk-a', 1]])

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 10)

    expect(result).toHaveLength(1)
    expect(result[0]!.chunkId).toBe('chunk-a')
    expect(result[0]!.rrfScore).toBeCloseTo(2 / 61, 12)
    expect(result[0]!.sources).toEqual({ semantic: true, fulltext: true })
  })

  it('sums the per-leg contributions for a chunk present in both legs at different ranks', () => {
    // semantic rank 2 -> 1/62 ; fts rank 3 -> 1/63
    const semanticRanks = new Map<string, number>([['chunk-a', 2]])
    const ftsRanks = new Map<string, number>([['chunk-a', 3]])

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 10)

    expect(result).toHaveLength(1)
    expect(result[0]!.rrfScore).toBeCloseTo(1 / 62 + 1 / 63, 12)
    expect(result[0]!.sources).toEqual({ semantic: true, fulltext: true })
  })

  it('sorts results descending by rrfScore', () => {
    // chunk-a: both legs rank 1 -> 2/61 (highest)
    // chunk-b: semantic rank 2 only -> 1/62
    // chunk-c: fts rank 3 only -> 1/63 (lowest)
    const semanticRanks = new Map<string, number>([
      ['chunk-a', 1],
      ['chunk-b', 2],
    ])
    const ftsRanks = new Map<string, number>([
      ['chunk-a', 1],
      ['chunk-c', 3],
    ])

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 10)

    expect(result.map((r) => r.chunkId)).toEqual(['chunk-a', 'chunk-b', 'chunk-c'])
    // strictly descending
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.rrfScore).toBeGreaterThanOrEqual(result[i]!.rrfScore)
    }
  })

  it('respects the topK cap, keeping the highest-scoring chunks', () => {
    const semanticRanks = new Map<string, number>([
      ['chunk-a', 1],
      ['chunk-b', 2],
      ['chunk-c', 3],
      ['chunk-d', 4],
    ])
    const ftsRanks = new Map<string, number>()

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 2)

    expect(result).toHaveLength(2)
    // top-2 by rank are chunk-a (1/61) then chunk-b (1/62)
    expect(result.map((r) => r.chunkId)).toEqual(['chunk-a', 'chunk-b'])
  })

  it('sets source flags correctly per leg', () => {
    // chunk-sem only in semantic; chunk-fts only in fts; chunk-both in both
    const semanticRanks = new Map<string, number>([
      ['chunk-sem', 1],
      ['chunk-both', 2],
    ])
    const ftsRanks = new Map<string, number>([
      ['chunk-fts', 1],
      ['chunk-both', 2],
    ])

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 10)
    const byId = new Map(result.map((r) => [r.chunkId, r] as const))

    expect(byId.get('chunk-sem')!.sources).toEqual({ semantic: true, fulltext: false })
    expect(byId.get('chunk-fts')!.sources).toEqual({ semantic: false, fulltext: true })
    expect(byId.get('chunk-both')!.sources).toEqual({ semantic: true, fulltext: true })
  })

  it('includes a chunk that appears in only one leg', () => {
    const semanticRanks = new Map<string, number>([['only-semantic', 5]])
    const ftsRanks = new Map<string, number>([['only-fts', 7]])

    const result = rrfFuse(semanticRanks, ftsRanks, 60, 10)
    const ids = result.map((r) => r.chunkId)

    expect(ids).toContain('only-semantic')
    expect(ids).toContain('only-fts')
    expect(result).toHaveLength(2)

    const byId = new Map(result.map((r) => [r.chunkId, r] as const))
    expect(byId.get('only-semantic')!.rrfScore).toBeCloseTo(1 / 65, 12)
    expect(byId.get('only-fts')!.rrfScore).toBeCloseTo(1 / 67, 12)
  })
})
