// ---------------------------------------------------------------------------
// Batch embedding unit tests                                          (AER-5)
// ---------------------------------------------------------------------------
//
// Exercises `generateEmbeddingsFromTexts` — the batch variant that embeds many
// chunk texts in a SINGLE pipeline call and stride-slices the flat output
// tensor back into per-row 256d vectors.
//
// These tests MOCK the feature-extraction pipeline (via the `_test.injectPipeline`
// hook) so they run instantly with deterministic tensors — no ~111 MB model
// download, no ONNX runtime. The mock returns one flat Float32Array shaped
// `[batch, 768]`, exactly as transformers.js does after mean pooling.
//
// What we assert:
//   - the pipeline is invoked EXACTLY ONCE for a 32-text batch (the whole point)
//   - the output has `texts.length` rows, each 256d
//   - row i corresponds to text i (distinct per-row values, stride-sliced)
//   - empty input → [] without touching the pipeline
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  generateEmbeddingsFromTexts,
  applyNomicPrefix,
  EMBEDDING_DIMS,
  EMBEDDING_NATIVE_DIMS,
  _test as embeddingsTestHooks,
} from '../embeddings'

interface FeatureExtractionCallOptions {
  pooling?: 'none' | 'mean' | 'cls'
  normalize?: boolean
}
interface FeatureExtractionOutput {
  data: Float32Array
  dims?: number[]
}

/**
 * Build a mock pipeline that, for a batch of N texts, returns a flat
 * Float32Array of length N * 768 with `dims = [N, 768]`. Row r is filled with
 * the constant value `rowValue(r)` so that after stride-slicing + Matryoshka
 * truncation we can prove row r maps to text r (every entry within a row is
 * identical, so post-L2-norm each of the 256 entries equals 1/sqrt(256)).
 *
 * `rowValue` is derived from the prefixed text so that distinct texts produce
 * distinct (but here just constant) rows — the key property is that the row's
 * position in the flat buffer corresponds to the input index, which is what
 * stride-slicing must preserve.
 */
function makeMockPipeline(
  rowValue: (rowIndex: number, prefixedText: string) => number,
) {
  const calls: Array<{ texts: string[]; options?: FeatureExtractionCallOptions }> = []

  const fn = (
    text: string | string[],
    options?: FeatureExtractionCallOptions,
  ): Promise<FeatureExtractionOutput> => {
    const batch = Array.isArray(text) ? text : [text]
    calls.push({ texts: batch, options })

    const data = new Float32Array(batch.length * EMBEDDING_NATIVE_DIMS)
    for (let r = 0; r < batch.length; r++) {
      const v = rowValue(r, batch[r]!)
      for (let c = 0; c < EMBEDDING_NATIVE_DIMS; c++) {
        data[r * EMBEDDING_NATIVE_DIMS + c] = v
      }
    }
    return Promise.resolve({ data, dims: [batch.length, EMBEDDING_NATIVE_DIMS] })
  }

  return { fn, calls }
}

describe('generateEmbeddingsFromTexts', () => {
  beforeEach(() => {
    embeddingsTestHooks.injectPipeline(null)
  })
  afterEach(() => {
    embeddingsTestHooks.injectPipeline(null)
    vi.restoreAllMocks()
  })

  it('calls the pipeline EXACTLY ONCE for a 32-text batch', async () => {
    const { fn, calls } = makeMockPipeline(r => r + 1)
    const spy = vi.fn(fn)
    embeddingsTestHooks.injectPipeline(spy)

    const texts = Array.from({ length: 32 }, (_, i) => `chunk ${i}`)
    await generateEmbeddingsFromTexts(texts)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
    // The single call received the entire batch, not one text at a time.
    expect(calls[0]!.texts).toHaveLength(32)
    expect(calls[0]!.options).toEqual({ pooling: 'mean', normalize: true })
  })

  it('returns one 256d L2-normalised vector per input (32 rows × 256)', async () => {
    const { fn } = makeMockPipeline(r => r + 1)
    embeddingsTestHooks.injectPipeline(fn)

    const texts = Array.from({ length: 32 }, (_, i) => `chunk ${i}`)
    const out = await generateEmbeddingsFromTexts(texts)

    expect(out).toHaveLength(32)
    for (const row of out) {
      expect(row).toHaveLength(EMBEDDING_DIMS)
      const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0))
      expect(norm).toBeCloseTo(1.0, 5)
    }
  })

  it('applies the document prefix to every text in the batch', async () => {
    const { fn, calls } = makeMockPipeline(r => r + 1)
    embeddingsTestHooks.injectPipeline(fn)

    const texts = ['alpha', 'beta', 'gamma']
    await generateEmbeddingsFromTexts(texts, 'document')

    expect(calls[0]!.texts).toEqual([
      applyNomicPrefix('alpha', 'document'),
      applyNomicPrefix('beta', 'document'),
      applyNomicPrefix('gamma', 'document'),
    ])
  })

  it('applies a non-default prefix (query) to every text', async () => {
    const { fn, calls } = makeMockPipeline(r => r + 1)
    embeddingsTestHooks.injectPipeline(fn)

    await generateEmbeddingsFromTexts(['needle'], 'query')

    expect(calls[0]!.texts).toEqual([applyNomicPrefix('needle', 'query')])
  })

  it('maps row i to text i via correct stride-slicing (distinct per-row values)', async () => {
    // Give each row a DISTINCT sign so a mis-strided slice would be detectable:
    // even rows positive, odd rows negative. After L2 norm the magnitude is
    // identical (1/sqrt(256)) but the SIGN is preserved and unique per parity.
    const { fn } = makeMockPipeline(r => (r % 2 === 0 ? r + 1 : -(r + 1)))
    embeddingsTestHooks.injectPipeline(fn)

    const texts = Array.from({ length: 8 }, (_, i) => `t${i}`)
    const out = await generateEmbeddingsFromTexts(texts)

    const expectedMag = 1 / Math.sqrt(EMBEDDING_DIMS)
    for (let r = 0; r < texts.length; r++) {
      const expectedSign = r % 2 === 0 ? 1 : -1
      for (const v of out[r]!) {
        expect(v).toBeCloseTo(expectedSign * expectedMag, 6)
      }
    }
  })

  it('preserves per-row ordering when each text yields a unique vector pattern', async () => {
    // Encode the row index into the FIRST native component only, leaving the
    // rest constant. The first 256 components survive truncation, so the
    // (renormalised) first component is a deterministic function of the row —
    // proving order is preserved through stride-slice + truncate.
    const calls: Array<string[]> = []
    const fn = (
      text: string | string[],
    ): Promise<FeatureExtractionOutput> => {
      const batch = Array.isArray(text) ? text : [text]
      calls.push(batch)
      const data = new Float32Array(batch.length * EMBEDDING_NATIVE_DIMS)
      for (let r = 0; r < batch.length; r++) {
        for (let c = 0; c < EMBEDDING_NATIVE_DIMS; c++) {
          // First component scales with (r+2); others fixed at 1. Distinct r
          // ⇒ distinct first-to-rest ratio ⇒ distinct normalised vector.
          data[r * EMBEDDING_NATIVE_DIMS + c] = c === 0 ? r + 2 : 1
        }
      }
      return Promise.resolve({ data, dims: [batch.length, EMBEDDING_NATIVE_DIMS] })
    }
    embeddingsTestHooks.injectPipeline(fn)

    const texts = Array.from({ length: 5 }, (_, i) => `row${i}`)
    const out = await generateEmbeddingsFromTexts(texts)

    // Recompute the expected normalised first component for each row and check
    // it lands at exactly that row index (not shuffled / off-by-one).
    for (let r = 0; r < texts.length; r++) {
      const first = r + 2
      const norm = Math.sqrt(first * first + (EMBEDDING_DIMS - 1) * 1 * 1)
      expect(out[r]![0]).toBeCloseTo(first / norm, 6)
    }
    // Strictly increasing first-component ⇒ ordering preserved.
    for (let r = 1; r < texts.length; r++) {
      expect(out[r]![0]!).toBeGreaterThan(out[r - 1]![0]!)
    }
  })

  it('returns [] for an empty array WITHOUT invoking the pipeline', async () => {
    const { fn, calls } = makeMockPipeline(r => r + 1)
    const spy = vi.fn(fn)
    embeddingsTestHooks.injectPipeline(spy)

    const out = await generateEmbeddingsFromTexts([])

    expect(out).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it('throws when any text is empty after trimming', async () => {
    const { fn } = makeMockPipeline(r => r + 1)
    embeddingsTestHooks.injectPipeline(fn)

    await expect(
      generateEmbeddingsFromTexts(['ok', '   ', 'also ok']),
    ).rejects.toThrow(/texts\[1\] must be a non-empty string/)
  })

  it('throws when the flat tensor length does not match batch × stride', async () => {
    // dims report the correct 768 stride, but the data buffer holds only 2.5
    // rows worth of floats for a 3-text batch — a malformed shape that must
    // fail loud rather than silently slice past the buffer end.
    const fn = (): Promise<FeatureExtractionOutput> => {
      const data = new Float32Array(2 * EMBEDDING_NATIVE_DIMS + 64)
      return Promise.resolve({ data, dims: [3, EMBEDDING_NATIVE_DIMS] })
    }
    embeddingsTestHooks.injectPipeline(fn)

    await expect(
      generateEmbeddingsFromTexts(['a', 'b', 'c']),
    ).rejects.toThrow(/does not match/)
  })

  it('throws when the native dim is not 768 (wrong model loaded)', async () => {
    const fn = (
      text: string | string[],
    ): Promise<FeatureExtractionOutput> => {
      const batch = Array.isArray(text) ? text : [text]
      const data = new Float32Array(batch.length * 512)
      return Promise.resolve({ data, dims: [batch.length, 512] })
    }
    embeddingsTestHooks.injectPipeline(fn)

    await expect(
      generateEmbeddingsFromTexts(['x']),
    ).rejects.toThrow(/unexpected native dim 512/)
  })

  it('throws on an empty output tensor', async () => {
    const fn = (): Promise<FeatureExtractionOutput> =>
      Promise.resolve({ data: new Float32Array(0), dims: [0, EMBEDDING_NATIVE_DIMS] })
    embeddingsTestHooks.injectPipeline(fn)

    await expect(
      generateEmbeddingsFromTexts(['x']),
    ).rejects.toThrow(/no output tensor/)
  })
})
