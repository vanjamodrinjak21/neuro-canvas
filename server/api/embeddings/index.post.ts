// ---------------------------------------------------------------------------
// POST /api/embeddings  (AER-5)
// ---------------------------------------------------------------------------
//
// Bulk-upsert embeddings for nodes belonging to a single map.
//
// Each entry MUST carry the source `text`. The `embedding` field is OPTIONAL:
//
//   - If `embedding` is present (client-computed in the Web Worker), the
//     server validates dimensions / finiteness and stores it as-is. This is
//     the hot path used by the live editor.
//
//   - If `embedding` is absent, the server runs the local nomic-embed
//     pipeline on `text` (with the `search_document:` prefix) and stores the
//     resulting 256d L2-normalised vector. This path is for cron-style
//     reindex jobs, server-side ingest, or clients that cannot run
//     transformers.js. It returns 503 if the server-side pipeline is
//     misconfigured (missing local model files).
//
// You may freely mix client-precomputed and server-computed entries inside
// a single POST — the per-entry decision is made independently.
//
// Request body (application/json):
//   {
//     mapId:      string (cuid),
//     embeddings: Array<{
//       nodeId:      string (1..128 chars),
//       text:        string (1..50_000 chars)  // stored as sourceText
//       embedding?:  number[256]                // OPTIONAL — finite floats
//       contentHash: string (1..64 chars)       // client-computed dedupe hash
//     }> (1..500 entries)
//   }
//
// Validation:
//   - Zod schema (`embeddingPostSchema`) enforces shape, lengths, ranges.
//   - When `embedding` is provided, `validateEmbedding()` additionally
//     checks length === 256 and every entry is a finite number. Mismatched
//     dimensions / NaN / Infinity all produce a 400 with a precise
//     `embeddings[<i>].embedding: <reason>` message.
//
// Auth + rate limits:
//   - Requires an authenticated session (`requireAuthSession`).
//   - Caller must own the target map (404 otherwise).
//   - 60 writes / 60s / user (HNSW upserts are expensive).
//   - Server-side embedding tightens the limit further (20 writes / 60s)
//     because each entry triggers a model inference.
//
// Response:
//   200 -> { success: true, stored: <count>, embeddedServerSide: <count> }
//   400 -> Validation failed: <path> -- <reason>
//   401 -> Unauthorized
//   404 -> Map not found
//   429 -> Too many embedding writes
//   503 -> Server-side embedding unavailable: <reason>
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
  generateEmbeddingFromText,
  isServerEmbeddingAvailable,
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

  // Partition by who needs to embed. Indices kept so error messages are
  // precise about which entry in the original payload failed.
  const needsServerEmbed: number[] = []
  for (let i = 0; i < embeddings.length; i++) {
    const entry = embeddings[i]!
    if (entry.embedding === undefined) {
      needsServerEmbed.push(i)
      continue
    }
    const check = validateEmbedding(entry.embedding)
    if (!check.ok) {
      throw createError({
        statusCode: 400,
        statusMessage: `Validation failed: embeddings[${i}].embedding -- ${check.reason}`,
      })
    }
  }

  // If any entries require server-side embedding, gate on:
  //   1. A tighter per-user rate limit (inference is expensive)
  //   2. Pipeline availability — return 503 BEFORE doing any DB work so
  //      the caller can switch to client-side embedding.
  if (needsServerEmbed.length > 0) {
    const { allowed: embedAllowed } = await checkRateLimit(
      `embeddings:server-embed:${userId}`,
      20,
      60,
    )
    if (!embedAllowed) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many server-side embedding requests',
      })
    }

    const availability = isServerEmbeddingAvailable()
    if (!availability.available) {
      throw createError({
        statusCode: 503,
        statusMessage: `Server-side embedding unavailable: ${availability.reason ?? 'unknown reason'}`,
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

  // Resolve every entry to a concrete embedding (either supplied or computed).
  // Done sequentially so we don't fan out N concurrent ONNX inferences on a
  // single user request — the model is CPU-bound and serialising keeps
  // latency predictable.
  const resolved: Array<{ nodeId: string; text: string; embedding: number[]; contentHash: string }> = []
  let embeddedServerSide = 0
  for (let i = 0; i < embeddings.length; i++) {
    const entry = embeddings[i]!
    let vec: number[]
    if (entry.embedding !== undefined) {
      vec = entry.embedding
    }
    else {
      try {
        vec = await generateEmbeddingFromText(entry.text, 'document')
      }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Pipeline init failures surface as 503; per-input failures (e.g.
        // empty text after trimming) surface as 400 with the index.
        const isUnavailable = msg.includes('unavailable')
        throw createError({
          statusCode: isUnavailable ? 503 : 400,
          statusMessage: `embeddings[${i}].text -- ${msg}`,
        })
      }
      embeddedServerSide++
    }
    resolved.push({
      nodeId: entry.nodeId,
      text: entry.text,
      embedding: vec,
      contentHash: entry.contentHash,
    })
  }

  // Upsert embeddings to pgvector via raw SQL (Prisma doesn't support
  // Unsupported types in mutations). Template form auto-parameterizes
  // every interpolation so future edits can't drift into injection.
  for (const entry of resolved) {
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

  return {
    success: true,
    stored: resolved.length,
    embeddedServerSide,
  }
})
