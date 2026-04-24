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
