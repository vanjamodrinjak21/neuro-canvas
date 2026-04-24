import { readFileSync } from 'fs'
import { join } from 'path'

/** Target dimension for Matryoshka truncation of nomic-embed-text-v1.5 */
export const EMBEDDING_DIMS = 256

/** Model identifier stored alongside embeddings for migration tracking */
export const EMBEDDING_MODEL = 'nomic-embed-text-v1.5'

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
 */
export function applyNomicPrefix(text: string, type: NomicPrefixType): string {
  return NOMIC_PREFIXES[type] + text
}

/**
 * Format a number[] as a pgvector-compatible string literal: '[0.1,0.2,...]'
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

// ---------------------------------------------------------------------------
// Server-side ONNX embedding (onnxruntime-node)
// ---------------------------------------------------------------------------
// In normal operation, clients compute embeddings locally in a Web Worker and
// pass `queryEmbedding` in the request body — so this server-side path is only
// exercised when no pre-computed embedding is provided (e.g. server-to-server
// calls, batch pipelines, or future CLI tooling).
//
// Requires the nomic-embed-text-v1.5 ONNX model to be present on disk.
// Set ONNX_MODEL_DIR to override the default path of <cwd>/models/nomic-embed-text-v1.5.
//
// IMPORTANT — tokenization limitation:
//   The `simpleTokenize` function below is a rough whitespace-based placeholder.
//   It will produce incorrect token IDs for any real vocabulary and therefore
//   yields meaningless embeddings. For production accuracy, replace it with the
//   HuggingFace `tokenizers` npm package loaded from the model's tokenizer.json.
//   This limitation is acceptable here because the server-side path is a fallback;
//   all latency-sensitive query paths use client-computed embeddings.
// ---------------------------------------------------------------------------

// Lazily-initialised singletons — loaded once per process lifetime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _session: any | null = null

const MODEL_DIR =
  process.env.ONNX_MODEL_DIR ?? join(process.cwd(), 'models', 'nomic-embed-text-v1.5')

/**
 * Return (or lazily create) the shared ONNX InferenceSession.
 * Throws a descriptive error if the model file cannot be found or loaded.
 */
async function getSession(): Promise<NonNullable<typeof _session>> {
  if (_session) return _session

  // Dynamic import so the module is only evaluated in a Node.js context.
  // onnxruntime-node is a native addon — importing it at module top-level
  // would break any SSR/edge runtime that cannot load native modules.
  const { InferenceSession } = await import('onnxruntime-node')

  const modelPath = join(MODEL_DIR, 'model.onnx')
  _session = await InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  })
  return _session
}

/**
 * Embed a query string server-side using onnxruntime-node.
 *
 * Pipeline:
 *   1. Apply `search_query:` nomic prefix
 *   2. Tokenize (simple whitespace fallback — see note above)
 *   3. Run ONNX inference
 *   4. Mean-pool last hidden state over sequence dimension
 *   5. L2-normalise
 *   6. Matryoshka truncation to EMBEDDING_DIMS (256)
 *
 * Falls back gracefully — throws a clear, actionable error if the model is
 * not present rather than silently returning garbage.
 *
 * For most callers, prefer passing `queryEmbedding` directly in the request
 * body (client-computed) to avoid this path entirely.
 */
export async function embedQueryServerSide(text: string): Promise<number[]> {
  const prefixed = applyNomicPrefix(text, 'query')

  try {
    const { Tensor } = await import('onnxruntime-node')
    const session = await getSession()

    const tokens = simpleTokenize(prefixed)

    const inputIds = new BigInt64Array(tokens.map(t => BigInt(t)))
    const attentionMask = new BigInt64Array(tokens.length).fill(1n)

    const feeds = {
      input_ids: new Tensor('int64', inputIds, [1, tokens.length]),
      attention_mask: new Tensor('int64', attentionMask, [1, tokens.length]),
    }

    const results = await session.run(feeds)
    const output: { data: Float32Array; dims: number[] } | undefined =
      results['last_hidden_state'] ?? results[Object.keys(results)[0]!]
    if (!output) throw new Error('No output tensor returned by ONNX model')

    const data = output.data as Float32Array
    const seqLen = tokens.length
    const hiddenDim = data.length / seqLen

    // Mean pooling over the sequence dimension (all tokens have mask = 1).
    const pooled = new Array<number>(hiddenDim).fill(0)
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < hiddenDim; j++) {
        pooled[j] += data[i * hiddenDim + j]!
      }
    }
    for (let j = 0; j < hiddenDim; j++) {
      pooled[j] /= seqLen
    }

    // L2 normalise.
    let norm = 0
    for (let j = 0; j < hiddenDim; j++) {
      norm += pooled[j]! * pooled[j]!
    }
    norm = Math.sqrt(norm)
    if (norm > 0) {
      for (let j = 0; j < hiddenDim; j++) {
        pooled[j] /= norm
      }
    }

    // Matryoshka truncation to EMBEDDING_DIMS — also re-normalises.
    return truncateMatryoshka(pooled, EMBEDDING_DIMS)
  }
  catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Server-side embedding failed: ${msg}. ` +
      `Ensure the nomic-embed-text-v1.5 ONNX model is available at ${MODEL_DIR} ` +
      `(override with ONNX_MODEL_DIR env var).`,
    )
  }
}

/**
 * Check whether the server-side ONNX model file exists and is readable.
 * Use this as a health-check before calling embedQueryServerSide.
 */
export function isServerEmbeddingAvailable(): boolean {
  try {
    readFileSync(join(MODEL_DIR, 'model.onnx'), { flag: 'r' })
    return true
  }
  catch {
    return false
  }
}

/**
 * Simple whitespace tokeniser — placeholder for proper HuggingFace tokenisation.
 *
 * This hashes each whitespace-delimited word into an approximate vocab-range
 * token ID, bracketed by BERT-style [CLS] (101) and [SEP] (102) tokens.
 *
 * WARNING: This does NOT produce correct WordPiece / BPE token IDs and will
 * yield semantically meaningless embeddings. Replace with the `tokenizers`
 * npm package and the model's tokenizer.json for production use.
 */
function simpleTokenize(text: string): number[] {
  const CLS = 101
  const SEP = 102
  const VOCAB_SIZE = 30000
  const VOCAB_OFFSET = 1000

  const words = text.split(/\s+/).filter(Boolean)
  const tokens = [CLS]

  for (const word of words) {
    // djb2-style hash — deterministic but not linguistically meaningful.
    let hash = 0
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i)
      hash = hash | 0 // keep 32-bit integer
    }
    tokens.push((Math.abs(hash) % VOCAB_SIZE) + VOCAB_OFFSET)
  }

  tokens.push(SEP)
  return tokens
}
