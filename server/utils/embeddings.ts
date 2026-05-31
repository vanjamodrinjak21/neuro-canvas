// ---------------------------------------------------------------------------
// Embedding utilities (server-side helpers — pure functions only).
// ---------------------------------------------------------------------------
//
// As of AER-5 (rework of semantic-search backend) the server no longer hosts
// any text -> embedding code path. Embeddings are computed exclusively on the
// client (Web Worker + transformers.js, see `app/workers/ai.worker.ts`) and
// shipped to the server as raw 256-dim Float arrays via the embedding /
// search REST endpoints.
//
// Why no server-side embedding:
//   - The previous server-side ONNX path used a placeholder whitespace
//     tokenizer that produced semantically meaningless vectors. Keeping it
//     risked silently writing junk into pgvector or returning junk from
//     search.
//   - No production caller actually needed server-side embedding: every
//     latency-sensitive query already passes `queryEmbedding`, every write
//     already passes a precomputed `embedding` array. The dual pipeline only
//     created drift potential (tokenizer / normalisation differences) and
//     pulled in a heavy native dep (`onnxruntime-node`) for zero benefit.
//
// If a future requirement genuinely needs server-side embedding (cron-based
// reindex from raw text, batch ingest from CLI tooling, mobile build that
// cannot ship transformers.js), reintroduce it behind a real tokenizer
// (HuggingFace `tokenizers` npm package fed by the model's `tokenizer.json`)
// and gate it behind a parity test: client cosine similarity vs server
// cosine similarity must be >= 0.99 for the same input.
// ---------------------------------------------------------------------------

/** Target dimension for Matryoshka truncation of nomic-embed-text-v1.5. */
export const EMBEDDING_DIMS = 256

/** Model identifier stored alongside embeddings for migration tracking. */
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
 *
 * Kept exported because (a) it is referenced by the existing unit test and
 * (b) any reintroduced server-side embedding path would need it. Pure
 * function — safe to call in any runtime.
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
 * Pure function, used by integration tests that verify recall@k.
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
