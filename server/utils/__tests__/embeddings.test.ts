import { describe, it, expect } from 'vitest'
import { truncateMatryoshka, applyNomicPrefix } from '../embeddings'

describe('truncateMatryoshka', () => {
  it('truncates to target dimensions and re-normalizes', () => {
    const input = new Array(768).fill(0)
    input[0] = 1.0

    const result = truncateMatryoshka(input, 256)

    expect(result).toHaveLength(256)
    const norm = Math.sqrt(result.reduce((s: number, v: number) => s + v * v, 0))
    expect(norm).toBeCloseTo(1.0, 5)
  })

  it('preserves relative values after truncation', () => {
    const input = new Array(768).fill(0)
    input[0] = 0.5
    input[1] = 0.5
    input[2] = 0.5
    input[3] = 0.5

    const result = truncateMatryoshka(input, 256)

    expect(result[0]).toBeCloseTo(result[1]!, 10)
    expect(result[1]).toBeCloseTo(result[2]!, 10)
    expect(result[10]).toBe(0)
  })

  it('handles already-correct dimensions (no-op)', () => {
    const input = new Array(256).fill(0)
    input[0] = 1.0

    const result = truncateMatryoshka(input, 256)

    expect(result).toHaveLength(256)
    const norm = Math.sqrt(result.reduce((s: number, v: number) => s + v * v, 0))
    expect(norm).toBeCloseTo(1.0, 5)
  })
})

describe('applyNomicPrefix', () => {
  it('applies search_document prefix for indexing', () => {
    expect(applyNomicPrefix('hello world', 'document')).toBe('search_document: hello world')
  })

  it('applies search_query prefix for queries', () => {
    expect(applyNomicPrefix('hello world', 'query')).toBe('search_query: hello world')
  })

  it('applies clustering prefix', () => {
    expect(applyNomicPrefix('hello world', 'clustering')).toBe('clustering: hello world')
  })
})
