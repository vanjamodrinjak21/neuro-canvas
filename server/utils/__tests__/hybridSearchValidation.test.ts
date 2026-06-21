// Unit tests for the hybrid (RRF) search schema (AER-53). Pure schema
// validation — no DB, no Redis, no embedding pipeline.

import { describe, it, expect } from 'vitest'
import { hybridSearchSchema } from '../validation'

// A real Prisma cuid: leading 'c' + 24 base36 chars (25 total).
const VALID_CUID = 'ckz1a2b3c4d5e6f7g8h9i0j1k'
const VALID_CUID_2 = 'cla1a2b3c4d5e6f7g8h9i0j1k'

const base = {
  queryText: 'photosynthesis light reactions',
  documentIds: [VALID_CUID],
}

describe('hybridSearchSchema', () => {
  it('accepts a minimal payload and applies defaults', () => {
    const result = hybridSearchSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topK).toBe(10)
      expect(result.data.rrfK).toBe(60)
      expect(result.data.minRrfScore).toBe(0)
      expect(result.data.queryEmbedding).toBeUndefined()
      expect(result.data.mapIds).toBeUndefined()
    }
  })

  it('trims queryText', () => {
    const result = hybridSearchSchema.safeParse({ ...base, queryText: '  hello world  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.queryText).toBe('hello world')
  })

  it('accepts an explicit 256d queryEmbedding', () => {
    const result = hybridSearchSchema.safeParse({
      ...base,
      queryEmbedding: Array(256).fill(0.01),
    })
    expect(result.success).toBe(true)
  })

  it('rejects a wrong-length queryEmbedding', () => {
    expect(hybridSearchSchema.safeParse({ ...base, queryEmbedding: Array(255).fill(0.01) }).success).toBe(false)
    expect(hybridSearchSchema.safeParse({ ...base, queryEmbedding: Array(257).fill(0.01) }).success).toBe(false)
  })

  it('rejects a non-finite queryEmbedding entry', () => {
    const v = Array(256).fill(0.01)
    v[0] = Number.NaN
    expect(hybridSearchSchema.safeParse({ ...base, queryEmbedding: v }).success).toBe(false)
  })

  describe('queryText', () => {
    it('rejects empty / whitespace-only', () => {
      expect(hybridSearchSchema.safeParse({ ...base, queryText: '' }).success).toBe(false)
      expect(hybridSearchSchema.safeParse({ ...base, queryText: '   ' }).success).toBe(false)
    })

    it('rejects > 500 chars', () => {
      expect(hybridSearchSchema.safeParse({ ...base, queryText: 'a'.repeat(501) }).success).toBe(false)
    })

    it('accepts exactly 500 chars', () => {
      expect(hybridSearchSchema.safeParse({ ...base, queryText: 'a'.repeat(500) }).success).toBe(true)
    })

    it('rejects a null byte', () => {
      expect(hybridSearchSchema.safeParse({ ...base, queryText: 'foo\x00bar' }).success).toBe(false)
    })
  })

  describe('documentIds', () => {
    it('rejects empty array', () => {
      expect(hybridSearchSchema.safeParse({ ...base, documentIds: [] }).success).toBe(false)
    })

    it('rejects a malformed cuid', () => {
      expect(hybridSearchSchema.safeParse({ ...base, documentIds: ['not-a-cuid'] }).success).toBe(false)
      expect(hybridSearchSchema.safeParse({ ...base, documentIds: [VALID_CUID.toUpperCase()] }).success).toBe(false)
    })

    it('rejects > 100 ids', () => {
      expect(hybridSearchSchema.safeParse({ ...base, documentIds: Array(101).fill(VALID_CUID) }).success).toBe(false)
    })

    it('accepts multiple valid ids', () => {
      expect(hybridSearchSchema.safeParse({ ...base, documentIds: [VALID_CUID, VALID_CUID_2] }).success).toBe(true)
    })
  })

  describe('mapIds', () => {
    it('accepts an empty array', () => {
      expect(hybridSearchSchema.safeParse({ ...base, mapIds: [] }).success).toBe(true)
    })

    it('rejects a malformed cuid', () => {
      expect(hybridSearchSchema.safeParse({ ...base, mapIds: ['nope'] }).success).toBe(false)
    })

    it('rejects > 100 ids', () => {
      expect(hybridSearchSchema.safeParse({ ...base, mapIds: Array(101).fill(VALID_CUID) }).success).toBe(false)
    })
  })

  describe('numeric bounds', () => {
    it('rejects topK out of [1,50]', () => {
      expect(hybridSearchSchema.safeParse({ ...base, topK: 0 }).success).toBe(false)
      expect(hybridSearchSchema.safeParse({ ...base, topK: 51 }).success).toBe(false)
      expect(hybridSearchSchema.safeParse({ ...base, topK: 1.5 }).success).toBe(false)
    })

    it('rejects rrfK out of [1,200]', () => {
      expect(hybridSearchSchema.safeParse({ ...base, rrfK: 0 }).success).toBe(false)
      expect(hybridSearchSchema.safeParse({ ...base, rrfK: 201 }).success).toBe(false)
    })

    it('rejects negative minRrfScore', () => {
      expect(hybridSearchSchema.safeParse({ ...base, minRrfScore: -0.1 }).success).toBe(false)
    })

    it('accepts the boundary values', () => {
      expect(hybridSearchSchema.safeParse({ ...base, topK: 50, rrfK: 200, minRrfScore: 0 }).success).toBe(true)
      expect(hybridSearchSchema.safeParse({ ...base, topK: 1, rrfK: 1 }).success).toBe(true)
    })
  })
})
