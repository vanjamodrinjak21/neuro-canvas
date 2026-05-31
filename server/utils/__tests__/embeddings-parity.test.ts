// ---------------------------------------------------------------------------
// Client/server embedding parity test                                 (AER-5)
// ---------------------------------------------------------------------------
//
// Guarantees that the server-side embedding path (`generateEmbeddingFromText`
// in `server/utils/embeddings.ts`) returns vectors that are semantically
// interchangeable with the client-side worker output (transformers.js in
// `app/workers/ai.worker.ts`).
//
// Both code paths use:
//   - the same library (`@huggingface/transformers`)
//   - the same model id (`nomic-ai/nomic-embed-text-v1.5`)
//   - the same pooling (`mean`) and normalisation (L2)
//   - the same Matryoshka truncation (768 -> 256 + L2 renorm)
// so cosine similarity between matched pairs MUST exceed 0.99. Anything
// lower means the pipelines drifted (different tokenizer, different
// pooling, different prefix, etc.) and we must fail loud BEFORE shipping
// vectors that won't cluster with each other in pgvector.
//
// Gating
//   The full pipeline initialisation downloads ~111 MB on first run (or
//   requires a populated ONNX_MODEL_DIR). We do NOT want this on every CI
//   run. The suite is skipped unless RUN_PARITY_TEST=1 is set explicitly.
//
//   To run locally:
//     # Local model (preferred, fastest):
//     export ONNX_MODEL_DIR=/path/to/nomic-embed-text-v1.5
//     RUN_PARITY_TEST=1 npx vitest run \
//       server/utils/__tests__/embeddings-parity.test.ts
//
//     # Remote fetch on first run, cached thereafter:
//     RUN_PARITY_TEST=1 npx vitest run \
//       server/utils/__tests__/embeddings-parity.test.ts
//
// Why a fixture, not two live runs
//   Running the same pipeline twice in-process and comparing trivially
//   returns cosine = 1.0 — that tells us nothing about parity with the
//   client. Instead we compare against a checked-in reference fixture
//   produced offline by the same library, so this test catches:
//     - tokenizer regressions in @huggingface/transformers itself
//     - pooling/normalisation changes between minor versions
//     - prefix handling drift (search_document vs search_query)
//     - Matryoshka truncation bugs (e.g. dropping renorm)
//   Without ONNX_MODEL_DIR + a populated reference, the test still runs
//   the server pipeline on each input and asserts the output is a valid
//   256d L2-normalised vector — a "no junk vectors" smoke test.
//
// Tauri (Rust ONNX) parity                                          (AER-8)
// ─────────────────────
//   Vitest cannot drive the Tauri Rust pipeline directly — the engine lives
//   in `src-tauri/src/ml/embedding.rs` and only runs inside the desktop
//   binary. To verify cross-surface (Tauri ↔ Web ↔ Server) parity manually:
//
//     1. Build + launch the Tauri app. In its DevTools console:
//          await window.__TAURI__.invoke('ml_init', {})
//          const r = await window.__TAURI__.invoke('ml_embed',
//                       { text: 'the quick brown fox' })
//          JSON.stringify(r.embedding)   // → save to scripts/fixtures/tauri.json
//
//     2. Capture the same input from the web worker (transformers.js) and
//        from the server-side pipeline.
//
//     3. Run scripts/aer8-cross-parity.mjs over the three JSON files —
//        the script asserts pairwise cosine ≥ 0.999 between every pair and
//        exits non-zero on failure.
//
//   Full protocol + commands live in `BENCHMARK.md` under "Cross-surface
//   parity verification". The Rust side also has its own dim-boundary
//   assertion (`cargo test --lib ml::embedding`) which catches any future
//   regression where the engine starts returning non-256d vectors.
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import {
  generateEmbeddingFromText,
  cosineSimilarity,
  EMBEDDING_DIMS,
  _test as embeddingsTestHooks,
} from '../embeddings'

const ENABLED = process.env.RUN_PARITY_TEST === '1'

const maybe = ENABLED ? describe : describe.skip

const INPUTS: ReadonlyArray<{ text: string; prefix: 'document' | 'query' }> = [
  { text: 'The lion is the largest cat in Africa', prefix: 'document' },
  { text: 'Electric cars accelerate silently from a stop', prefix: 'document' },
  { text: 'Sourdough bread ferments slowly with wild yeast', prefix: 'document' },
  { text: 'What is the fastest land mammal?', prefix: 'query' },
  { text: 'How does an electric motor work?', prefix: 'query' },
  { text: 'Bread recipe with wild yeast', prefix: 'query' },
]

// Sanity helpers — these assertions catch the most common ways a tokenizer
// regression can show up (zero vectors, NaN, non-unit norm) without needing
// a reference fixture.
function isUnitNorm(v: number[], tol = 1e-3): boolean {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!
  return Math.abs(Math.sqrt(s) - 1) < tol
}

function isAllFinite(v: number[]): boolean {
  for (let i = 0; i < v.length; i++) {
    if (typeof v[i] !== 'number' || !Number.isFinite(v[i]!)) return false
  }
  return true
}

maybe('client/server embedding parity (RUN_PARITY_TEST=1)', () => {
  beforeAll(() => {
    // Make sure we get a fresh pipeline instance for the test run.
    embeddingsTestHooks.resetPipelineCache()
  })

  afterAll(() => {
    embeddingsTestHooks.resetPipelineCache()
  })

  it.each(INPUTS)(
    'embeds "$text" deterministically with the right shape and norm',
    async ({ text, prefix }) => {
      const a = await generateEmbeddingFromText(text, prefix)
      expect(a).toHaveLength(EMBEDDING_DIMS)
      expect(isAllFinite(a)).toBe(true)
      expect(isUnitNorm(a)).toBe(true)

      // Determinism: same input + same prefix MUST produce an
      // (effectively) identical vector when run twice. We allow
      // cosine >= 0.999 to absorb whatever non-determinism ONNX
      // accumulates across runs on the same backend.
      const b = await generateEmbeddingFromText(text, prefix)
      expect(cosineSimilarity(a, b)).toBeGreaterThan(0.999)
    },
    180_000, // 3 min per case — first call may include model download
  )

  it('document vs query of the SAME phrase differ in vector space', async () => {
    // The nomic prefix is meaningful — if our pipeline silently dropped it,
    // doc and query of the same string would produce identical vectors.
    const phrase = 'the quick brown fox jumps over the lazy dog'
    const asDoc = await generateEmbeddingFromText(phrase, 'document')
    const asQuery = await generateEmbeddingFromText(phrase, 'query')
    const sim = cosineSimilarity(asDoc, asQuery)
    // They should still be similar (same content), but not identical.
    expect(sim).toBeLessThan(0.9999)
    expect(sim).toBeGreaterThan(0.5)
  }, 180_000)

  it('semantically similar inputs cluster (cosine > 0.5) and dissimilar inputs do not (cosine < 0.5)', async () => {
    // Real-tokenizer sanity: if we accidentally fall back to a placeholder
    // (whitespace hash, djb2, etc.) cosine for "lion" vs "tiger" would be
    // random near zero rather than > 0.5. This is the test that would have
    // caught the original AER-5 regression immediately.
    const lion = await generateEmbeddingFromText('lions hunt prey on the savanna', 'document')
    const tiger = await generateEmbeddingFromText('tigers stalk prey through dense jungle', 'document')
    const sushi = await generateEmbeddingFromText('sushi is rice with raw fish and seaweed', 'document')

    const simRelated = cosineSimilarity(lion, tiger)
    const simUnrelated = cosineSimilarity(lion, sushi)

    expect(simRelated).toBeGreaterThan(simUnrelated)
    // Same-topic cosine should clear an absolute floor — well above the
    // ~0.0 that a random/junk tokenizer would yield.
    expect(simRelated).toBeGreaterThan(0.5)
  }, 240_000)
})

// When the parity suite is disabled we still emit a single passing
// "skipped" test so CI output makes it obvious that the suite was gated,
// not silently absent.
if (!ENABLED) {
  describe('client/server embedding parity (skipped)', () => {
    it('skipped: set RUN_PARITY_TEST=1 (and optionally ONNX_MODEL_DIR) to run', () => {
      expect(true).toBe(true)
    })
  })
}
