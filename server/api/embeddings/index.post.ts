import { cache, cacheKeys, hashText } from '../../utils/redis'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, embeddingPostSchema } from '../../utils/validation'

const EMBEDDING_TTL = 7 * 24 * 60 * 60

export default defineEventHandler(async (event) => {
  await requireAuthSession(event)

  const body = validateBody(embeddingPostSchema, await readBody(event))
  const { mapId, embeddings } = body

  let storedCount = 0

  for (const entry of embeddings) {
    const textHash = hashText(entry.text)

    await cache.set(
      cacheKeys.embedding(textHash),
      { embedding: entry.embedding, text: entry.text },
      EMBEDDING_TTL
    )

    await cache.set(
      cacheKeys.embeddingByNode(mapId, entry.nodeId),
      { embedding: entry.embedding, textHash },
      EMBEDDING_TTL
    )

    storedCount++
  }

  return { success: true, stored: storedCount }
})
