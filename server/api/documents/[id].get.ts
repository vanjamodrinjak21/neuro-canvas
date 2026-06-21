// ---------------------------------------------------------------------------
// GET /api/documents/:id  (Document detail — §8)
// ---------------------------------------------------------------------------
//
// Single-document fetch for the detail view. Same userId-scoped, storage-safe
// SELECT and same links partitioning (GENERATED map + ATTACHED maps) as the
// list endpoint. 404 if the document does not exist, is soft-deleted, or
// belongs to another user — the ownership scope is enforced in the WHERE, so a
// forged id from another tenant is indistinguishable from "not found".
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`doc:get:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Document ID required' })
  }

  const doc = await prisma.document.findFirst({
    where: { id, userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      filename: true,
      mimeType: true,
      status: true,
      source: true,
      chunkCount: true,
      pageCount: true,
      byteSize: true,
      createdAt: true,
      updatedAt: true,
      links: {
        select: {
          mapId: true,
          linkType: true,
          map: { select: { id: true, title: true } },
        },
      },
    },
  })

  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  const { links, ...rest } = doc
  const generatedLink = links.find((l) => l.linkType === 'GENERATED')
  const attachedMaps = links
    .filter((l) => l.linkType === 'ATTACHED')
    .map((l) => ({ id: l.map.id, title: l.map.title }))

  return {
    document: {
      ...rest,
      generatedMap: generatedLink
        ? { id: generatedLink.map.id, title: generatedLink.map.title }
        : null,
      attachedMaps,
    },
  }
})
