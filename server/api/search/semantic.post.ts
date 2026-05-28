import { Prisma } from '@prisma/client'
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
