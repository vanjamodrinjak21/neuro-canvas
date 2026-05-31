// Unit tests for the AER-5 hardening of embedding helpers + zod schemas.
// These run with no external services (no DB, no Redis) — pure functions
// and pure schema validation.

import { describe, it, expect } from 'vitest'
import {
  validateEmbedding,
  cosineSimilarity,
  EMBEDDING_DIMS,
} from '../embeddings'
import {
  embeddingPostSchema,
  semanticSearchSchema,
  embeddingsReindexSchema,
} from '../validation'

function unitVector(length: number, seed = 1): number[] {
  // Simple deterministic non-zero vector then L2-normalise.
  const v = new Array<number>(length)
  for (let i = 0; i < length; i++) v[i] = Math.sin(seed * (i + 1))
  let norm = 0
  for (let i = 0; i < length; i++) norm += v[i]! * v[i]!
  norm = Math.sqrt(norm)
  for (let i = 0; i < length; i++) v[i] = v[i]! / norm
  return v
}

describe('validateEmbedding', () => {
  it('accepts an array of exactly EMBEDDING_DIMS finite numbers', () => {
    const v = unitVector(EMBEDDING_DIMS)
    const result = validateEmbedding(v)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.embedding).toHaveLength(EMBEDDING_DIMS)
  })

  it('rejects non-arrays', () => {
    expect(validateEmbedding('not-an-array').ok).toBe(false)
    expect(validateEmbedding(null).ok).toBe(false)
    expect(validateEmbedding(undefined).ok).toBe(false)
    expect(validateEmbedding({}).ok).toBe(false)
  })

  it('rejects wrong-length arrays with a precise message', () => {
    const tooShort = validateEmbedding(unitVector(128))
    expect(tooShort.ok).toBe(false)
    if (!tooShort.ok) expect(tooShort.reason).toMatch(/exactly 256/)

    const tooLong = validateEmbedding(unitVector(512))
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) expect(tooLong.reason).toMatch(/exactly 256/)
  })

  it('rejects NaN / Infinity / non-number entries with the offending index', () => {
    const v = unitVector(EMBEDDING_DIMS)
    v[42] = Number.NaN
    const r1 = validateEmbedding(v)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.reason).toMatch(/\[42\]/)

    const w = unitVector(EMBEDDING_DIMS)
    w[7] = Number.POSITIVE_INFINITY
    const r2 = validateEmbedding(w)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.reason).toMatch(/\[7\]/)

    const x = unitVector(EMBEDDING_DIMS) as Array<number | string>
    x[100] = 'not-a-number'
    const r3 = validateEmbedding(x)
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.reason).toMatch(/\[100\]/)
  })
})

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical unit vectors', () => {
    const v = unitVector(EMBEDDING_DIMS, 3)
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = new Array<number>(4).fill(0); a[0] = 1
    const b = new Array<number>(4).fill(0); b[1] = 1
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10)
  })

  it('returns -1 for opposite vectors', () => {
    const v = unitVector(EMBEDDING_DIMS, 5)
    const neg = v.map(x => -x)
    expect(cosineSimilarity(v, neg)).toBeCloseTo(-1.0, 5)
  })

  it('returns 0 (not NaN) when either vector is zero-magnitude', () => {
    const z = new Array<number>(EMBEDDING_DIMS).fill(0)
    const v = unitVector(EMBEDDING_DIMS)
    expect(cosineSimilarity(z, v)).toBe(0)
    expect(cosineSimilarity(v, z)).toBe(0)
  })

  it('returns 0 for mismatched-length inputs', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0)
  })
})

describe('embeddingPostSchema', () => {
  const validEntry = () => ({
    nodeId: 'node-1',
    text: 'hello world',
    embedding: unitVector(EMBEDDING_DIMS),
    contentHash: 'abc123',
  })

  it('accepts a well-formed payload', () => {
    const result = embeddingPostSchema.safeParse({
      mapId: 'cuid-abc',
      embeddings: [validEntry(), validEntry()],
    })
    expect(result.success).toBe(true)
  })

  it('rejects payloads with wrong-dim embeddings', () => {
    const bad = validEntry()
    bad.embedding = unitVector(128)
    const result = embeddingPostSchema.safeParse({
      mapId: 'cuid-abc',
      embeddings: [bad],
    })
    expect(result.success).toBe(false)
  })

  it('rejects payloads with non-finite numbers', () => {
    const bad = validEntry()
    bad.embedding[0] = Number.NaN
    const result = embeddingPostSchema.safeParse({
      mapId: 'cuid-abc',
      embeddings: [bad],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty embeddings array', () => {
    const result = embeddingPostSchema.safeParse({
      mapId: 'cuid-abc',
      embeddings: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('semanticSearchSchema', () => {
  it('accepts a well-formed search request', () => {
    const result = semanticSearchSchema.safeParse({
      query: 'find me things',
      queryEmbedding: unitVector(EMBEDDING_DIMS),
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topK).toBe(20)
      expect(result.data.threshold).toBe(0.3)
    }
  })

  it('rejects a search with the wrong queryEmbedding dimension', () => {
    const result = semanticSearchSchema.safeParse({
      query: 'whatever',
      queryEmbedding: unitVector(384),
    })
    expect(result.success).toBe(false)
  })
})

describe('embeddingsReindexSchema', () => {
  it('defaults force to false', () => {
    const result = embeddingsReindexSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.force).toBe(false)
  })

  it('accepts force: true', () => {
    const result = embeddingsReindexSchema.safeParse({ force: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.force).toBe(true)
  })

  it('rejects non-boolean force', () => {
    const result = embeddingsReindexSchema.safeParse({ force: 'yes' })
    expect(result.success).toBe(false)
  })
})
