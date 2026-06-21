// Unit tests for the Document RAG ingestion schemas (presign → confirm).
// Pure schema validation — no DB, no Redis, no R2.

import { describe, it, expect } from 'vitest'
import {
  cuidStrict,
  documentPresignSchema,
  documentConfirmSchema,
} from '../validation'

// A real Prisma cuid: leading 'c' + 24 base36 chars (25 total).
const VALID_CUID = 'ckz1a2b3c4d5e6f7g8h9i0j1k'

describe('cuidStrict', () => {
  it('accepts a valid cuid', () => {
    const result = cuidStrict.safeParse(VALID_CUID)
    expect(result.success).toBe(true)
  })

  it('rejects junk', () => {
    expect(cuidStrict.safeParse('').success).toBe(false)
    expect(cuidStrict.safeParse('not-a-cuid').success).toBe(false)
    expect(cuidStrict.safeParse('C' + VALID_CUID.slice(1)).success).toBe(false) // uppercase leading
    expect(cuidStrict.safeParse(VALID_CUID.toUpperCase()).success).toBe(false)
    expect(cuidStrict.safeParse(VALID_CUID + 'x').success).toBe(false) // too long
    expect(cuidStrict.safeParse(VALID_CUID.slice(0, -1)).success).toBe(false) // too short
    expect(cuidStrict.safeParse('x' + VALID_CUID.slice(1)).success).toBe(false) // wrong prefix
    expect(cuidStrict.safeParse(123 as unknown).success).toBe(false)
  })
})

describe('documentPresignSchema', () => {
  const base = {
    filename: 'paper.pdf',
    declaredMime: 'application/pdf' as const,
    sizeBytes: 1024,
  }

  it('accepts a well-formed payload and defaults intent to none', () => {
    const result = documentPresignSchema.safeParse(base)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.intent).toBe('none')
      expect(result.data.attachToMapId).toBeUndefined()
    }
  })

  it('accepts each allowed MIME type', () => {
    for (const declaredMime of [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'text/plain',
    ] as const) {
      expect(documentPresignSchema.safeParse({ ...base, declaredMime }).success).toBe(true)
    }
  })

  it('rejects a disallowed MIME type (image/png)', () => {
    const result = documentPresignSchema.safeParse({ ...base, declaredMime: 'image/png' })
    expect(result.success).toBe(false)
  })

  it('rejects sizes over the 20MB cap', () => {
    const over = documentPresignSchema.safeParse({ ...base, sizeBytes: 20 * 1024 * 1024 + 1 })
    expect(over.success).toBe(false)
  })

  it('accepts exactly the 20MB cap', () => {
    const atCap = documentPresignSchema.safeParse({ ...base, sizeBytes: 20 * 1024 * 1024 })
    expect(atCap.success).toBe(true)
  })

  it('rejects non-positive / non-integer sizes', () => {
    expect(documentPresignSchema.safeParse({ ...base, sizeBytes: 0 }).success).toBe(false)
    expect(documentPresignSchema.safeParse({ ...base, sizeBytes: -1 }).success).toBe(false)
    expect(documentPresignSchema.safeParse({ ...base, sizeBytes: 1.5 }).success).toBe(false)
  })

  it('rejects an empty or overlong filename', () => {
    expect(documentPresignSchema.safeParse({ ...base, filename: '' }).success).toBe(false)
    expect(documentPresignSchema.safeParse({ ...base, filename: 'a'.repeat(256) }).success).toBe(false)
  })

  it('accepts a valid intent + attachToMapId', () => {
    const result = documentPresignSchema.safeParse({
      ...base,
      intent: 'attach_source',
      attachToMapId: VALID_CUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed attachToMapId', () => {
    const result = documentPresignSchema.safeParse({
      ...base,
      intent: 'attach_source',
      attachToMapId: 'not-a-cuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown intent', () => {
    const result = documentPresignSchema.safeParse({ ...base, intent: 'wat' })
    expect(result.success).toBe(false)
  })
})

describe('documentConfirmSchema', () => {
  it('accepts an empty body', () => {
    expect(documentConfirmSchema.safeParse({}).success).toBe(true)
  })
})
