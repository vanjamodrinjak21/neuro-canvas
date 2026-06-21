// Reciprocal Rank Fusion (RRF) — pure app-layer fusion of two ranked retrieval
// legs (HNSW semantic + GIN full-text). See docs/architecture/
// document-rag-implementation-plan.md §5 and §0.1(e).
//
// Each leg supplies a Map<chunkId, rank> where `rank` is 1-based (best = 1).
// A chunk's RRF score is the sum, over the legs in which it appears, of
// 1/(k + rank). Scores are commensurable across legs (unlike raw cosine /
// ts_rank), so they can be summed directly. Results are merged by chunkId,
// annotated with which legs contributed, sorted by descending score, and
// truncated to the top `topK`.
//
// Pure function: no DB, no Redis, no network, no shared state.

/** Which retrieval legs contributed to a fused result. */
export interface RrfSources {
  /** Present in the semantic (HNSW vector) leg. */
  semantic: boolean
  /** Present in the full-text (GIN) leg. */
  fulltext: boolean
}

/** A single fused, ranked chunk. */
export interface RrfResult {
  /** Stable chunk identifier shared across both legs. */
  chunkId: string
  /** Summed reciprocal-rank score across contributing legs. */
  rrfScore: number
  /** Per-leg contribution flags. */
  sources: RrfSources
}

/**
 * Fuse two ranked retrieval legs via Reciprocal Rank Fusion.
 *
 * @param semanticRanks Map of chunkId → 1-based rank in the semantic leg.
 * @param fulltextRanks Map of chunkId → 1-based rank in the full-text leg.
 * @param k             RRF damping constant (typically 60).
 * @param topK          Maximum number of fused results to return.
 * @returns Fused chunks sorted by descending rrfScore, capped at topK.
 */
export function rrfFuse(
  semanticRanks: ReadonlyMap<string, number>,
  fulltextRanks: ReadonlyMap<string, number>,
  k: number,
  topK: number,
): RrfResult[] {
  const fused = new Map<string, RrfResult>()

  const accumulate = (
    ranks: ReadonlyMap<string, number>,
    leg: keyof RrfSources,
  ): void => {
    for (const [chunkId, rank] of ranks) {
      const contribution = 1 / (k + rank)
      const existing = fused.get(chunkId)
      if (existing) {
        existing.rrfScore += contribution
        existing.sources[leg] = true
      } else {
        fused.set(chunkId, {
          chunkId,
          rrfScore: contribution,
          sources: { semantic: false, fulltext: false, [leg]: true },
        })
      }
    }
  }

  accumulate(semanticRanks, 'semantic')
  accumulate(fulltextRanks, 'fulltext')

  return Array.from(fused.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
}
