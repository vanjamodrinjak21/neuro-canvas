// ---------------------------------------------------------------------------
// GET /api/documents  (Document list — §8)
// ---------------------------------------------------------------------------
//
// Lists the caller's non-deleted documents for the documents library page.
// Mirrors the auth → rate-limit → userId-scoped prisma shape of
// search/semantic.post.ts. Every column that touches storage internals
// (r2Key, sha256) is intentionally excluded from the SELECT so it can never
// leak to the client.
//
// Each row carries its linked maps shaped for the UI: the single GENERATED map
// (the map produced FROM this document) plus any ATTACHED maps (maps this
// document was attached to as a source). The DocumentMapLink unique key is
// (documentId, mapId, linkType), so the same pair can legitimately appear under
// both link types — we partition by linkType below.
// ---------------------------------------------------------------------------

import { requireAuthSession } from '../../utils/syncHelpers'
import { prisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/redis'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  // 60/min/user — comfortable for a library page that re-fetches on focus.
  const { allowed } = await checkRateLimit(`doc:list:${userId}`, 60, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }

  const docs = await prisma.document.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
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

  return {
    documents: docs.map((doc) => {
      const { links, ...rest } = doc
      const generatedLink = links.find((l) => l.linkType === 'GENERATED')
      const attachedMaps = links
        .filter((l) => l.linkType === 'ATTACHED')
        .map((l) => ({ id: l.map.id, title: l.map.title }))
      return {
        ...rest,
        generatedMap: generatedLink
          ? { id: generatedLink.map.id, title: generatedLink.map.title }
          : null,
        attachedMaps,
      }
    }),
  }
})
