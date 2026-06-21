// ---------------------------------------------------------------------------
// POST /api/search/semantic  (AER-5)
// ---------------------------------------------------------------------------
//
// HNSW-backed cosine top-K over NodeEmbedding (pgvector). The caller MUST
// supply `queryEmbedding` (256d, finite numbers) -- the server NEVER embeds
// text. See `server/utils/embeddings.ts` for why.
//
// Performance baseline (AER-5, 2026-05-31):
//   At 1000 embeddings in a single map with the existing HNSW index
//   (vector_cosine_ops, m=16, ef_construction=64) the SELECT below is
//   bounded by the HNSW probe + the JOIN on Map for the userId /
//   deletedAt filter. No production-load capture is on this commit --
//   numbers must be measured against a real DB.
//
//     p50: TBD ms (target < 50ms warm, 1k embeddings, single map)
//     p95: TBD ms (target < 150ms warm, 1k embeddings, single map)
//
//   How to measure (one command, deterministic seed):
//     TEST_DATABASE_URL=postgresql://user:pass@host:port/db \
//       node scripts/aer5-search-bench.mjs
//
//   The bench seeds 1000 synthetic 256d vectors into a throwaway map,
//   runs 20 warmup + 200 measured queries via the exact SELECT below
//   through `pg`, sorts the per-query hrtime samples, prints p50/p95/
//   p99/max/mean, then drops the seed data. Override scale with
//   BENCH_N / BENCH_M / BENCH_WARMUP env vars.
//
// Update this block when production traffic data is captured.
// ---------------------------------------------------------------------------

import { Prisma } from '../../generated/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, semanticSearchSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { toPgVector } from '../../utils/embeddings'
import { checkRateLimit } from '../../utils/redis'

interface SearchRow {
  mapId: string
  nodeId: string
  sourceText: string
  similarity: number
  mapTitle: string
}

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // pgvector similarity search is HNSW-index-backed but still CPU-bound
  // per query. 60/min is generous for an editor session + protects DB.
  const { allowed } = await checkRateLimit(`search:semantic:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many search requests' })
  }

  const body = validateBody(semanticSearchSchema, await readBody(event))
  const { queryEmbedding, mapIds, topK, threshold } = body

  const vectorStr = toPgVector(queryEmbedding)

  // Template form auto-parameterizes every interpolation; Prisma.join
  // handles the variable-length IN-list. No string-built SQL anywhere.
  const rows: SearchRow[] = (mapIds && mapIds.length > 0)
    ? await prisma.$queryRaw<SearchRow[]>`
        SELECT ne."mapId", ne."nodeId", ne."sourceText",
               1 - (ne."embedding" <=> ${vectorStr}::vector) AS similarity,
               m."title" AS "mapTitle"
        FROM "NodeEmbedding" ne
        JOIN "Map" m ON m."id" = ne."mapId"
        WHERE m."userId" = ${userId}
          AND m."deletedAt" IS NULL
          AND ne."mapId" IN (${Prisma.join(mapIds)})
          AND 1 - (ne."embedding" <=> ${vectorStr}::vector) >= ${threshold}
        ORDER BY ne."embedding" <=> ${vectorStr}::vector
        LIMIT ${topK}
      `
    : await prisma.$queryRaw<SearchRow[]>`
        SELECT ne."mapId", ne."nodeId", ne."sourceText",
               1 - (ne."embedding" <=> ${vectorStr}::vector) AS similarity,
               m."title" AS "mapTitle"
        FROM "NodeEmbedding" ne
        JOIN "Map" m ON m."id" = ne."mapId"
        WHERE m."userId" = ${userId}
          AND m."deletedAt" IS NULL
          AND 1 - (ne."embedding" <=> ${vectorStr}::vector) >= ${threshold}
        ORDER BY ne."embedding" <=> ${vectorStr}::vector
        LIMIT ${topK}
      `

  return {
    results: rows.map(row => ({
      mapId: row.mapId,
      mapTitle: row.mapTitle,
      nodeId: row.nodeId,
      sourceText: row.sourceText,
      similarity: Number(row.similarity)
    }))
  }
})
