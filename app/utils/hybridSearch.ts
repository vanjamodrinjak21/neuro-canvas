// ---------------------------------------------------------------------------
// Hybrid (text + semantic) node ranking — the single shared implementation.
//
// Two callers run this with IDENTICAL logic so web and desktop rank the same:
//   • the web AI worker (browser), and
//   • the main-thread native path in useAI (Tauri/Capacitor). The native shell
//     is a static SPA with no Nitro backend — no pgvector/HNSW and no web
//     worker — so it embeds the query on-device via ONNX (tauriML.embed) and
//     scores here instead of posting to the worker.
//
// Pure + dependency-free so it stays fast and unit-testable.
// ---------------------------------------------------------------------------

export interface HybridSearchResult {
  nodeId: string
  content: string
  similarity: number
  matchType: 'exact' | 'semantic' | 'hybrid'
}

/**
 * Dot product of two equal-length vectors. For L2-normalised embeddings this
 * equals cosine similarity. Manually unrolled ×4 to stay cheap on hot paths.
 */
export function dotProductSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const len = a.length
  let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0
  const limit = len - (len % 4)

  for (let i = 0; i < limit; i += 4) {
    sum0 += a[i]! * b[i]!
    sum1 += a[i + 1]! * b[i + 1]!
    sum2 += a[i + 2]! * b[i + 2]!
    sum3 += a[i + 3]! * b[i + 3]!
  }

  let sum = sum0 + sum1 + sum2 + sum3
  for (let i = limit; i < len; i++) {
    sum += a[i]! * b[i]!
  }

  return sum
}

/**
 * Combines fuzzy text substring match with semantic similarity.
 *
 * The text leg works with a zero-vector embedding, so a plain substring query
 * (e.g. "abu dhabi") always matches the relevant node even when the semantic
 * signal is weak or unavailable.
 */
export function rankHybridSearch(
  query: string,
  nodes: Array<{ id: string; content: string; embedding: number[] }>,
  queryEmbedding: number[],
  topK = 10
): HybridSearchResult[] {
  const queryLower = query.toLowerCase().trim()
  const results: HybridSearchResult[] = []

  for (const node of nodes) {
    const contentLower = node.content.toLowerCase()

    // Text match score (0-1)
    let textScore = 0
    if (contentLower === queryLower) {
      textScore = 1.0
    } else if (contentLower.includes(queryLower)) {
      textScore = 0.8
    } else if (queryLower.split(/\s+/).some(word => contentLower.includes(word))) {
      textScore = 0.4
    }

    // Semantic score
    const semanticScore = dotProductSimilarity(queryEmbedding, node.embedding)

    // Combined score with weights
    const textWeight = 0.4
    const semanticWeight = 0.6
    const combinedScore = textScore * textWeight + semanticScore * semanticWeight

    // Determine match type
    let matchType: 'exact' | 'semantic' | 'hybrid' = 'semantic'
    if (textScore > 0 && semanticScore >= 0.3) {
      matchType = 'hybrid'
    } else if (textScore > 0) {
      matchType = 'exact'
    }

    if (combinedScore > 0.15) {
      results.push({
        nodeId: node.id,
        content: node.content,
        similarity: combinedScore,
        matchType
      })
    }
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}
