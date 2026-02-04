import { getServerSession } from '#auth'
import { cache, cacheKeys, hashText } from '../../utils/redis'

// TTL for embeddings: 7 days
const EMBEDDING_TTL = 7 * 24 * 60 * 60

interface EmbeddingEntry {
  nodeId: string
  text: string
  embedding: number[]
}

interface RequestBody {
  mapId: string
  embeddings: EmbeddingEntry[]
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)

  if (!session?.user?.email) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.mapId || !Array.isArray(body.embeddings)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing mapId or embeddings array'
    })
  }

  const { mapId, embeddings } = body

  // Store each embedding with two keys:
  // 1. By text hash (for content-based lookup)
  // 2. By node ID within map (for map-specific lookup)
  let storedCount = 0

  for (const entry of embeddings) {
    if (!entry.nodeId || !entry.text || !entry.embedding) {
      continue
    }

    const textHash = hashText(entry.text)

    // Store by text hash (content-addressable)
    await cache.set(
      cacheKeys.embedding(textHash),
      { embedding: entry.embedding, text: entry.text },
      EMBEDDING_TTL
    )

    // Store by node ID within map (map-specific)
    await cache.set(
      cacheKeys.embeddingByNode(mapId, entry.nodeId),
      { embedding: entry.embedding, textHash },
      EMBEDDING_TTL
    )

    storedCount++
  }

  return {
    success: true,
    stored: storedCount
  }
})
