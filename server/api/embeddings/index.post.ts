import { cache, cacheKeys } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, embeddingPostSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { toPgVector, EMBEDDING_MODEL, EMBEDDING_DIMS } from '../../utils/embeddings'
import { randomUUID } from 'crypto'

const EMBEDDING_CACHE_TTL = 7 * 24 * 60 * 60 // 7 days

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const body = validateBody(embeddingPostSchema, await readBody(event))
  const { mapId, embeddings } = body

  // Verify map ownership
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  // Upsert embeddings to pgvector via raw SQL (Prisma doesn't support Unsupported types in mutations)
  for (const entry of embeddings) {
    const vectorStr = toPgVector(entry.embedding)

    await prisma.$executeRawUnsafe(
      `INSERT INTO "NodeEmbedding" ("id", "mapId", "nodeId", "embedding", "contentHash", "modelVersion", "dimensions", "sourceText", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT ("mapId", "nodeId")
       DO UPDATE SET
         "embedding" = EXCLUDED."embedding",
         "contentHash" = EXCLUDED."contentHash",
         "sourceText" = EXCLUDED."sourceText",
         "modelVersion" = EXCLUDED."modelVersion",
         "updatedAt" = NOW()`,
      randomUUID(),
      mapId,
      entry.nodeId,
      vectorStr,
      entry.contentHash,
      EMBEDDING_MODEL,
      EMBEDDING_DIMS,
      entry.text
    )

    // Update Redis hot cache
    await cache.set(
      cacheKeys.embeddingByNode(mapId, entry.nodeId),
      { embedding: entry.embedding, contentHash: entry.contentHash },
      EMBEDDING_CACHE_TTL
    )
  }

  return { success: true, stored: embeddings.length }
})
