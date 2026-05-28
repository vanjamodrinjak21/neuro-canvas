import { cache, cacheKeys, checkRateLimit } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, embeddingPostSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { toPgVector, EMBEDDING_MODEL, EMBEDDING_DIMS } from '../../utils/embeddings'
import { randomUUID } from 'crypto'

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
