// ---------------------------------------------------------------------------
// POST /api/embeddings/reindex/:mapId  (AER-5)
// ---------------------------------------------------------------------------
//
// Wipe every NodeEmbedding row for a map plus its Redis hot cache. Used when
// the embedding model version, dimensions, or HNSW parameters change and
// existing vectors become orphans / non-comparable.
//
// NOTE: This endpoint deletes only. The client is expected to re-embed all
// nodes locally (Web Worker) and re-POST them via `POST /api/embeddings`.
// We deliberately do not re-embed server-side — see
// `server/utils/embeddings.ts` for why.
//
// Request body:
//   { force?: boolean }     // currently informational; reserved for future
//                              "skip if same model/dims" optimisation.
//
// Auth + rate limits:
//   - Authenticated session required (`requireAuthSession`).
//   - Caller must own the target map (404 otherwise).
//   - 10 reindexes / 60s / user — this is a heavy operation that drops
//     pgvector rows + invalidates cache, so the cap is much lower than the
//     30/min on plain DELETE.
//
// Response:
//   200 -> { deleted: <count>, mapId: <id>, force: <bool> }
//   400 -> Missing mapId / validation failure
//   401 -> Unauthorized
//   404 -> Map not found
//   429 -> Too many reindex requests
// ---------------------------------------------------------------------------

import { cache, cacheKeys, checkRateLimit } from '../../../utils/redis'
import { requireAuthSession } from '../../../utils/syncHelpers'
import { validateBody, embeddingsReindexSchema } from '../../../utils/validation'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)
  const mapId = getRouterParam(event, 'mapId')

  // Tight rate limit — reindex drops every row for a map and invalidates
  // the entire Redis cache key range for that map.
  const { allowed } = await checkRateLimit(`embeddings:reindex:${userId}`, 10, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many reindex requests' })
  }

  if (!mapId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing mapId' })
  }

  // Body is optional; default to `{ force: false }`. Parsing even an empty
  // body lets us add more flags later without breaking the contract.
  let rawBody: unknown = {}
  try {
    rawBody = (await readBody(event)) ?? {}
  }
  catch {
    rawBody = {}
  }
  const { force } = validateBody(embeddingsReindexSchema, rawBody)

  // Verify map ownership before mutating anything.
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // pgvector wipe. Template form auto-parameterises the mapId — future
  // edits cannot drift into string-concat SQL.
  // Client must re-embed every node and re-POST /api/embeddings.
  const deleted = await prisma.$executeRaw`
    DELETE FROM "NodeEmbedding" WHERE "mapId" = ${mapId}
  `

  // Drop the hot cache for this map (SCAN-based, production-safe).
  await cache.delPattern(cacheKeys.embeddingsByMap(mapId))

  return {
    mapId,
    deleted: Number(deleted),
    force,
  }
})
