// ---------------------------------------------------------------------------
// POST /api/search/hybrid  (AER-53)
// ---------------------------------------------------------------------------
//
// Hybrid retrieval over DocumentChunk: an HNSW cosine semantic leg + a GIN
// websearch_to_tsquery full-text leg, fused in the app layer via Reciprocal
// Rank Fusion (server/utils/rrf.ts). See docs/architecture/
// document-rag-implementation-plan.md §5 and §0(a,e).
//
// Tenant isolation is enforced in THREE places:
//   1. A pre-flight ownership + readiness check on every requested documentId.
//   2. `dc."userId" = ${userId}` predicate in BOTH SQL legs.
//   3. `userId` scope on the hydration query.
//
// §0(e): this deployment has NO PgBouncer, so the two CTE legs run as a SINGLE
// autocommit `$queryRaw` statement prefixed with `SET hnsw.ef_search = 100;`.
// We do NOT use `$transaction` + `SET LOCAL` — that would require a pooled
// session and could leak the GUC across pooled connections.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, hybridSearchSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { generateEmbeddingFromText, toPgVector, EMBEDDING_MODEL } from '../../utils/embeddings'
import { checkRateLimit, cache, cacheKeys } from '../../utils/redis'
import { rrfFuse } from '../../utils/rrf'

// Per-leg candidate pool size. Each leg surfaces up to this many ranked
// chunks before RRF fuses + truncates to topK. Matches the plan's default.
const LEG_LIMIT = 60

// One row per (leg, chunk) from the UNION ALL — `rank` is the 1-based position
// of the chunk within its leg (best = 1).
interface LegRankRow {
  leg: 'semantic' | 'fts'
  id: string
  rank: bigint | number
}

interface HydratedChunk {
  id: string
  documentId: string
  text: string
  page: number | null
  chunkIndex: number
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // Two HNSW probes + a GIN scan per call — CPU-bound on the DB. 30/min is
  // generous for an interactive RAG session while protecting the database.
  const { allowed } = await checkRateLimit(cacheKeys.searchHybrid(userId), 30, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many search requests' })
  }

  const body = validateBody(hybridSearchSchema, await readBody(event))
  const { queryText, documentIds, topK, rrfK, minRrfScore } = body

  // --- Ownership + readiness pre-flight ----------------------------------
  // Every requested document must belong to the caller, be non-deleted, AND
  // be READY. Anything else short-circuits with 403 before any SQL/embedding.
  const ownedReady = await prisma.document.findMany({
    where: { id: { in: documentIds }, userId, deletedAt: null, status: 'READY' },
    select: { id: true },
  })
  const allReady = ownedReady.length === documentIds.length
  if (!allReady) {
    // Don't leak which specific docs are missing/unowned/not-ready.
    throw createError({
      statusCode: 403,
      statusMessage: 'One or more documents are not owned by you or not ready for search',
    })
  }

  // --- Query embedding ----------------------------------------------------
  // Prefer a client-supplied 256d vector; otherwise embed server-side.
  const qvec = body.queryEmbedding ?? await generateEmbeddingFromText(queryText, 'query')
  const vectorStr = toPgVector(qvec)

  // --- Redis cache (only safe when every requested doc is READY) ----------
  // Key is a stable hash of the inputs that determine the result set. Sorting
  // documentIds makes the key order-insensitive.
  const sortedDocIds = [...documentIds].sort()
  const cacheKeyHash = createHash('sha256')
    .update(JSON.stringify({ u: userId, q: queryText, d: sortedDocIds, topK, rrfK }))
    .digest('hex')
  const resultCacheKey = `${cacheKeys.searchHybrid(userId)}:${cacheKeyHash}`

  const cached = await cache.get<{ results: unknown[] }>(resultCacheKey)
  if (cached) return cached

  // --- Single autocommit hybrid query (no $transaction; SET, not SET LOCAL) -
  // Template form auto-parameterizes every interpolation; Prisma.join handles
  // the variable-length IN-list. Both legs carry the userId + documentId
  // predicates so tenant isolation holds even if the pre-flight is ever wrong.
  const rows = await prisma.$queryRaw<LegRankRow[]>`
    SET hnsw.ef_search = 100;
    WITH semantic_leg AS (
      SELECT dc.id,
             ROW_NUMBER() OVER (ORDER BY dc.embedding <=> ${vectorStr}::vector) AS rank
      FROM "DocumentChunk" dc
      WHERE dc."userId" = ${userId}
        AND dc."modelVersion" = ${EMBEDDING_MODEL}
        AND dc."documentId" IN (${Prisma.join(documentIds)})
      ORDER BY dc.embedding <=> ${vectorStr}::vector
      LIMIT ${LEG_LIMIT}
    ),
    fts_leg AS (
      SELECT dc.id,
             ROW_NUMBER() OVER (
               ORDER BY ts_rank_cd(dc.fts, websearch_to_tsquery('english', ${queryText})) DESC
             ) AS rank
      FROM "DocumentChunk" dc
      WHERE dc.fts @@ websearch_to_tsquery('english', ${queryText})
        AND dc."userId" = ${userId}
        AND dc."documentId" IN (${Prisma.join(documentIds)})
      LIMIT ${LEG_LIMIT}
    )
    SELECT 'semantic' AS leg, id, rank FROM semantic_leg
    UNION ALL
    SELECT 'fts' AS leg, id, rank FROM fts_leg
  `

  // --- Fuse the two legs via RRF -----------------------------------------
  const semanticRanks = new Map<string, number>()
  const ftsRanks = new Map<string, number>()
  for (const row of rows) {
    const rank = Number(row.rank)
    if (row.leg === 'semantic') semanticRanks.set(row.id, rank)
    else ftsRanks.set(row.id, rank)
  }

  const fused = rrfFuse(semanticRanks, ftsRanks, rrfK, topK)
    .filter(r => r.rrfScore >= minRrfScore)

  if (fused.length === 0) {
    const empty = { results: [] as unknown[] }
    if (allReady) await cache.set(resultCacheKey, empty, 300)
    return empty
  }

  // --- Hydrate (userId-scoped) and return in RRF order --------------------
  const topIds = fused.map(r => r.chunkId)
  const chunks = await prisma.documentChunk.findMany({
    where: { id: { in: topIds }, userId },
    select: { id: true, documentId: true, text: true, page: true, chunkIndex: true },
  })
  const byId = new Map<string, HydratedChunk>(chunks.map(c => [c.id, c]))

  const results = fused
    .map((r) => {
      const c = byId.get(r.chunkId)
      if (!c) return null
      return {
        chunkId: c.id,
        documentId: c.documentId,
        text: c.text,
        page: c.page,
        chunkIndex: c.chunkIndex,
        rrfScore: r.rrfScore,
        sources: r.sources,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  const payload = { results }
  if (allReady) await cache.set(resultCacheKey, payload, 300)
  return payload
})
