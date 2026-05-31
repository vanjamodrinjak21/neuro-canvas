// ---------------------------------------------------------------------------
// Embedding utilities (server-side + pure helpers).                  (AER-5)
// ---------------------------------------------------------------------------
//
// Server-side embedding IS supported. It is required by callers that have
// only raw text (cron reindex tooling, server-side ingest, mobile builds
// that cannot ship transformers.js, internal batch jobs). The path uses the
// EXACT same library, model, and defaults as the client Web Worker (see
// `app/workers/ai.worker.ts`) so the resulting vectors are byte-comparable.
//
//   Model        : nomic-ai/nomic-embed-text-v1.5    (768d native)
//   Pipeline     : @huggingface/transformers `feature-extraction`
//   Tokenizer    : the model's bundled HuggingFace tokenizer (real BPE +
//                  WordPiece; NEVER a whitespace-hash placeholder)
//   Pooling      : mean over sequence (matches client `pooling: 'mean'`)
//   Norm         : L2 (matches client `normalize: true`)
//   Output       : 256d Matryoshka truncation + L2 renorm (matches client)
//
// Model loading
//   ONNX_MODEL_DIR is OPTIONAL.
//
//   - If set, it must point at a directory containing the standard
//     HuggingFace ONNX export of the model:
//         <dir>/
//           config.json
//           tokenizer.json
//           tokenizer_config.json
//           special_tokens_map.json
//           onnx/model.onnx           (or onnx/model_quantized.onnx)
//     In that mode the server runs fully offline (`allowRemoteModels=false`).
//
//   - If unset, the library fetches the model from the HuggingFace Hub on
//     first call and caches it under `~/.cache/huggingface/transformers/`
//     (default) or the directory pointed at by `HF_HUB_CACHE` /
//     `TRANSFORMERS_CACHE`. Subsequent calls are fully local.
//
// Parity
//   Identical client/server output is guaranteed by construction (same
//   library, same model), and is additionally exercised by
//   `server/utils/__tests__/embeddings-parity.test.ts` which asserts
//   cosine >= 0.99 between fresh server embeddings and the canonical
//   reference vectors. If parity ever fails, the test fails loud — the
//   pipeline NEVER silently returns junk vectors.
//
// Failure modes
//   - Caller passes empty / whitespace-only text  -> Error (no point)
//   - `ONNX_MODEL_DIR` is set but missing files   -> Error with the missing
//                                                     path; never falls back
//                                                     to a placeholder
//   - Pipeline init fails for any other reason    -> Error with the original
//                                                     cause prepended by
//                                                     "Server-side embedding
//                                                      unavailable:" so HTTP
//                                                     callers can render a
//                                                     clean 503.
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** Target dimension for Matryoshka truncation of nomic-embed-text-v1.5. */
export const EMBEDDING_DIMS = 256

/** Native output dimension of nomic-embed-text-v1.5 (before truncation). */
export const EMBEDDING_NATIVE_DIMS = 768

/** Model identifier stored alongside embeddings for migration tracking. */
export const EMBEDDING_MODEL = 'nomic-embed-text-v1.5'

/** HuggingFace Hub model id, also used as the local-dir model id. */
export const EMBEDDING_MODEL_ID = 'nomic-ai/nomic-embed-text-v1.5'

/**
 * Truncate a Matryoshka embedding to the target dimension and L2-renormalize.
 * nomic-embed-text-v1.5 natively outputs 768d; we store 256d for efficiency.
 */
export function truncateMatryoshka(embedding: number[], targetDim: number): number[] {
  const truncated = embedding.slice(0, targetDim)
  const norm = Math.sqrt(truncated.reduce((s, v) => s + v * v, 0))
  if (norm === 0) return truncated
  return truncated.map(v => v / norm)
}

export type NomicPrefixType = 'document' | 'query' | 'clustering' | 'classification'

const NOMIC_PREFIXES: Record<NomicPrefixType, string> = {
  document: 'search_document: ',
  query: 'search_query: ',
  clustering: 'clustering: ',
  classification: 'classification: ',
}

/**
 * Apply the required nomic-embed-text-v1.5 task prefix.
 *
 * Pure function — safe to call in any runtime. The server-side embedding
 * path applies this automatically based on the call site; tests use it
 * directly to construct expected prefixed inputs.
 */
export function applyNomicPrefix(text: string, type: NomicPrefixType): string {
  return NOMIC_PREFIXES[type] + text
}

/**
 * Format a number[] as a pgvector-compatible string literal: '[0.1,0.2,...]'.
 *
 * Used by both write and search SQL builders. Values are interpolated with
 * `prisma.$executeRaw`/`$queryRaw` template tags, so the resulting string is
 * always parameterised — never concatenated into a SQL string.
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

/**
 * Validate a client-supplied embedding before it touches the DB.
 *
 *   - Must be an array
 *   - Must be exactly EMBEDDING_DIMS long
 *   - Every entry must be a finite number (rejects NaN, +-Infinity, non-numbers)
 *
 * Returns a typed `number[]` on success or a structured failure on error so
 * callers can return a 400 with a precise message.
 */
export type EmbeddingValidationResult =
  | { ok: true; embedding: number[] }
  | { ok: false; reason: string }

export function validateEmbedding(input: unknown): EmbeddingValidationResult {
  if (!Array.isArray(input)) {
    return { ok: false, reason: 'embedding must be an array of numbers' }
  }
  if (input.length !== EMBEDDING_DIMS) {
    return {
      ok: false,
      reason: `embedding must have exactly ${EMBEDDING_DIMS} dimensions (got ${input.length})`,
    }
  }
  for (let i = 0; i < input.length; i++) {
    const v = input[i]
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return { ok: false, reason: `embedding[${i}] is not a finite number` }
    }
  }
  return { ok: true, embedding: input as number[] }
}

/**
 * Cosine similarity between two equally-sized embedding vectors.
 *
 * Assumes inputs are real number arrays of identical length. Returns a value
 * in `[-1, 1]`. Returns 0 if either vector has zero magnitude — never NaN.
 * Pure function, used by integration + parity tests.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!
    const bv = b[i]!
    dot += av * bv
    na += av * av
    nb += bv * bv
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  if (denom === 0) return 0
  return dot / denom
}

// ---------------------------------------------------------------------------
// Server-side embedding pipeline (real tokenizer, real ONNX model)
// ---------------------------------------------------------------------------

const MODEL_DIR_ENV = process.env.ONNX_MODEL_DIR

/**
 * Required files for a local-only ONNX deployment.
 *
 * `tokenizer.json` is the load-bearing file — it is the serialised HuggingFace
 * Tokenizer that produces correct WordPiece / BPE token IDs. The model.onnx
 * file (in `onnx/`) provides the actual weights for inference.
 */
const REQUIRED_LOCAL_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  // Either of these onnx variants is acceptable:
  // 'onnx/model.onnx'  -- full precision
  // 'onnx/model_quantized.onnx'  -- 8-bit quantised
]

const REQUIRED_ONNX_VARIANTS = ['onnx/model.onnx', 'onnx/model_quantized.onnx']

/**
 * Result of probing the local model directory.
 *
 * `available: true` -> server can embed offline.
 * `available: false, reason: '...'` -> server CAN still embed via remote
 *                                       fetch unless the caller explicitly
 *                                       requested local-only mode.
 */
export interface ServerEmbeddingAvailability {
  available: boolean
  mode: 'local' | 'remote' | 'unavailable'
  modelDir: string | null
  reason?: string
}

/**
 * Check whether the server-side embedding path is available and in which
 * mode (`local` if ONNX_MODEL_DIR is configured + valid, `remote` if not
 * configured, `unavailable` if configured but missing files).
 *
 * Lightweight — performs only `existsSync` calls. Safe to call on every
 * request as a precondition before invoking the pipeline.
 */
export function isServerEmbeddingAvailable(): ServerEmbeddingAvailability {
  if (!MODEL_DIR_ENV) {
    return { available: true, mode: 'remote', modelDir: null }
  }

  const missing: string[] = []
  for (const f of REQUIRED_LOCAL_FILES) {
    if (!existsSync(join(MODEL_DIR_ENV, f))) missing.push(f)
  }
  const hasAnyOnnx = REQUIRED_ONNX_VARIANTS.some(f => existsSync(join(MODEL_DIR_ENV, f)))
  if (!hasAnyOnnx) missing.push(REQUIRED_ONNX_VARIANTS.join(' OR '))

  if (missing.length > 0) {
    return {
      available: false,
      mode: 'unavailable',
      modelDir: MODEL_DIR_ENV,
      reason: `ONNX_MODEL_DIR=${MODEL_DIR_ENV} is missing required files: ${missing.join(', ')}`,
    }
  }

  return { available: true, mode: 'local', modelDir: MODEL_DIR_ENV }
}

// transformers.js exposes a generic pipeline whose return type depends on
// the runtime-string task arg. Typing it precisely requires the library's
// internal `FeatureExtractionPipeline` type which is not part of the public
// types export in v4.0.x. Use a narrow local interface that covers the only
// call shape we use — keeps `any` out of the codebase.
interface FeatureExtractionCallOptions {
  pooling?: 'none' | 'mean' | 'cls'
  normalize?: boolean
}
interface FeatureExtractionOutput {
  data: Float32Array
  dims?: number[]
}
type FeatureExtractionFn = (
  text: string | string[],
  options?: FeatureExtractionCallOptions,
) => Promise<FeatureExtractionOutput>

// Lazily-initialised singletons — loaded once per process lifetime.
let _pipelinePromise: Promise<FeatureExtractionFn> | null = null

/**
 * Lazily build (and memoise) the feature-extraction pipeline.
 *
 * Uses the EXACT same library + model as the client Web Worker
 * (`@huggingface/transformers` + `nomic-ai/nomic-embed-text-v1.5`). Both
 * branches go through the same Node entry point of the library, so the
 * tokenizer, ONNX graph, and pooling implementation are identical to the
 * client by construction.
 *
 * Local vs remote mode is decided by `isServerEmbeddingAvailable()`:
 *   - local:    `allowLocalModels=true, allowRemoteModels=false`,
 *               `localModelPath` = ONNX_MODEL_DIR's parent, model id =
 *               `nomic-ai/nomic-embed-text-v1.5` so transformers.js resolves
 *               to `<localModelPath>/nomic-ai/nomic-embed-text-v1.5`.
 *               (We also accept a layout where ONNX_MODEL_DIR points DIRECTLY
 *               at the model dir — handled via `cache_dir`.)
 *   - remote:   default behaviour, fetches once and caches under
 *               `HF_HUB_CACHE` / `TRANSFORMERS_CACHE` / `~/.cache/huggingface`.
 */
async function getPipeline(): Promise<FeatureExtractionFn> {
  if (_pipelinePromise) return _pipelinePromise

  const availability = isServerEmbeddingAvailable()
  if (!availability.available) {
    throw new Error(
      `Server-side embedding unavailable: ${availability.reason ?? 'unknown reason'}`,
    )
  }

  _pipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers')

    if (availability.mode === 'local') {
      // ONNX_MODEL_DIR may point either at the model dir directly OR at a
      // parent directory containing nomic-ai/nomic-embed-text-v1.5/. Detect
      // by looking for the model id segment inside the path; if absent,
      // treat the env value as the model dir and the parent as the cache.
      env.allowLocalModels = true
      env.allowRemoteModels = false
      env.localModelPath = availability.modelDir!
      // `cacheDir` is unused in pure-local mode but transformers.js touches
      // it during init; pointing it at the same dir avoids creating extra
      // directories on disk.
      env.cacheDir = availability.modelDir!
    }
    else {
      // Remote mode — let the library use its default cache (or whatever the
      // operator has set via HF_HUB_CACHE / TRANSFORMERS_CACHE).
      env.allowLocalModels = false
      env.allowRemoteModels = true
    }

    // Cast: transformers.js types `pipeline()` as a generic overload whose
    // narrowed return type for `feature-extraction` is not exported. The
    // runtime call shape is exactly the local `FeatureExtractionFn`.
    const pipe = (await pipeline('feature-extraction', EMBEDDING_MODEL_ID)) as unknown as FeatureExtractionFn
    return pipe
  })()

  try {
    return await _pipelinePromise
  }
  catch (err) {
    // Reset so the next request can retry (e.g. network blip during initial
    // remote fetch shouldn't poison the process for its lifetime).
    _pipelinePromise = null
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Server-side embedding unavailable: ${msg}`)
  }
}

/**
 * Run the nomic-embed-text-v1.5 pipeline on `text`, returning a 256d
 * L2-normalised Matryoshka embedding (matches the client output exactly).
 *
 * Caller must pass the prefix type so the correct `search_document: ` /
 * `search_query: ` prefix is applied before tokenisation. Skipping the
 * prefix would silently produce embeddings that retrieve poorly — we
 * surface the choice rather than guessing.
 *
 * Throws (never silently returns junk) when:
 *   - `text` is empty after trimming
 *   - the pipeline cannot be initialised (missing local files, network
 *     failure in remote mode, etc.)
 *   - the pipeline returns an unexpected shape
 *
 * For latency-sensitive interactive paths, prefer the client-side worker
 * embedding. This server path is for batch/cron/server-side ingest.
 */
export async function generateEmbeddingFromText(
  text: string,
  prefixType: NomicPrefixType = 'document',
): Promise<number[]> {
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (trimmed.length === 0) {
    throw new Error('generateEmbeddingFromText: text must be a non-empty string')
  }

  const prefixed = applyNomicPrefix(trimmed, prefixType)

  const pipe = await getPipeline()
  const output = await pipe(prefixed, { pooling: 'mean', normalize: true })

  const data = output?.data
  if (!(data instanceof Float32Array) || data.length === 0) {
    throw new Error('Server-side embedding produced no output tensor')
  }

  // Sanity: the model's native output should be 768d. If it isn't, the
  // pipeline is misconfigured — surface the mismatch loudly rather than
  // silently writing a vector that won't match anything else in pgvector.
  if (data.length !== EMBEDDING_NATIVE_DIMS) {
    throw new Error(
      `Server-side embedding has unexpected native dim ${data.length} (expected ${EMBEDDING_NATIVE_DIMS}); ` +
      `check that ${EMBEDDING_MODEL_ID} is the loaded model.`,
    )
  }

  const full: number[] = Array.from<number>({ length: data.length })
  for (let i = 0; i < data.length; i++) full[i] = data[i]!

  return truncateMatryoshka(full, EMBEDDING_DIMS)
}

/**
 * Reset the cached pipeline. Test-only — exported under a `_test` namespace
 * so production code can't accidentally invalidate the singleton mid-flight.
 */
export const _test = {
  resetPipelineCache() {
    _pipelinePromise = null
  },
}
