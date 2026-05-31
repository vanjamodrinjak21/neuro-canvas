// ---------------------------------------------------------------------------
// POST /api/embeddings  (AER-5)
// ---------------------------------------------------------------------------
//
// Bulk-upsert pre-computed embeddings for nodes belonging to a single map.
// The server NEVER computes embeddings from text — clients are responsible
// for embedding via the in-browser Web Worker (nomic-embed-text-v1.5,
// 768d -> 256d Matryoshka, L2-normalised). The server only validates,
// stores, and indexes.
//
// Request body (application/json):
//   {
//     mapId:      string (cuid),
//     embeddings: Array<{
//       nodeId:      string (1..128 chars),
//       text:        string (1..50_000 chars)  // stored as sourceText for debug/RAG context
//       embedding:   number[256]                // EXACTLY 256 finite numbers
//       contentHash: string (1..64 chars)       // client-computed dedupe hash
//     }> (1..500 entries)
//   }
//
// Validation:
//   - Zod schema (`embeddingPostSchema`) enforces shape, lengths, ranges.
//   - Each `embedding` is additionally validated by `validateEmbedding()`
//     which guarantees length === 256 and every entry is a finite number.
//     Mismatched dimensions / NaN / Infinity all produce a 400 with a
//     precise `embeddings[<i>].embedding: <reason>` message.
//
// Auth + rate limits:
//   - Requires an authenticated session (`requireAuthSession`).
//   - Caller must own the target map (404 otherwise).
//   - 60 writes / 60s / user (HNSW upserts are expensive).
//
// Response:
//   200 -> { success: true, stored: <count> }
//   400 -> Validation failed: <path> -- <reason>
//   401 -> Unauthorized
//   404 -> Map not found
//   429 -> Too many embedding writes
//
// Side effects:
//   - Each row is upserted into the pgvector-backed `NodeEmbedding` table
//     via `INSERT ... ON CONFLICT (mapId, nodeId) DO UPDATE`.
//   - The Redis hot cache entry for each (mapId, nodeId) is refreshed with
//     a 7-day TTL so subsequent reads avoid the DB.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'
import { cache, cacheKeys, checkRateLimit } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, embeddingPostSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import {
  toPgVector,
  validateEmbedding,
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
} from '../../utils/embeddings'

const EMBEDDING_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // Bulk pgvector upsert — expensive and amplifies pgvector index work.
  const { allowed } = await checkRateLimit(`embeddings:write:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many embedding writes' })
  }

  const body = validateBody(embeddingPostSchema, await readBody(event))
  const { mapId, embeddings } = body

  // Per-entry dimension/finiteness check. The zod schema already restricts
  // the array shape, but it cannot assert `length === 256` for every entry
  // without per-row refinements, and we want a precise error message that
  // identifies the offending index.
  for (let i = 0; i < embeddings.length; i++) {
    const check = validateEmbedding(embeddings[i]!.embedding)
    if (!check.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation failed: embeddings[${i}].embedding -- ${check.reason}`,
      })
    }
  }

  // Verify map ownership
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // Upsert embeddings to pgvector via raw SQL (Prisma doesn't support
  // Unsupported types in mutations). Template form auto-parameterizes
  // every interpolation so future edits can't drift into injection.
  for (const entry of embeddings) {
    const vectorStr = toPgVector(entry.embedding)
    const id = randomUUID()

    await prisma.$executeRaw`
      INSERT INTO "NodeEmbedding" ("id", "mapId", "nodeId", "embedding", "contentHash", "modelVersion", "dimensions", "sourceText", "createdAt", "updatedAt")
      VALUES (${id}, ${mapId}, ${entry.nodeId}, ${vectorStr}::vector, ${entry.contentHash}, ${EMBEDDING_MODEL}, ${EMBEDDING_DIMS}, ${entry.text}, NOW(), NOW())
      ON CONFLICT ("mapId", "nodeId")
      DO UPDATE SET
        "embedding" = EXCLUDED."embedding",
        "contentHash" = EXCLUDED."contentHash",
        "sourceText" = EXCLUDED."sourceText",
        "modelVersion" = EXCLUDED."modelVersion",
        "updatedAt" = NOW()
    `

    // Update Redis hot cache
    await cache.set(
      cacheKeys.embeddingByNode(mapId, entry.nodeId),
      { embedding: entry.embedding, contentHash: entry.contentHash },
      EMBEDDING_CACHE_TTL
    )
  }

  return { success: true, stored: embeddings.length }
})
