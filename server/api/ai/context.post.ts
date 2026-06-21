import { Prisma } from '../../generated/prisma'
import { requireAuthSession } from '../../utils/syncHelpers'
import { validateBody, ragContextSchema } from '../../utils/validation'
import { prisma } from '../../utils/prisma'
import { toPgVector, generateEmbeddingFromText } from '../../utils/embeddings'
import { checkRateLimit } from '../../utils/redis'
import { buildDocumentKnowledge } from '../../utils/ragPromptGuard'

interface ContextRow {
  nodeId: string
  sourceText: string
  similarity: number
}

// One retrieved document chunk. `source` is a hard-coded discriminant so the
// downstream prompt assembler (ragPromptGuard) can tell document-derived,
// UNTRUSTED text apart from the map's own node context — the two arrays are
// deliberately NOT merged.
interface DocumentChunkRow {
  chunkId: string
  documentId: string
  text: string
  page: number | null
}

// Max document chunks pulled into a single context response (plan §6). Well
// under ragPromptGuard's RAG_MAX_CHUNKS=40 ceiling — the guard still caps.
const MAX_DOC_CHUNKS = 12

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuthSession(event)

  const { allowed } = await checkRateLimit(`ai:context:${userId}`, 120, 60)
  if (!allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many context requests' })
  }

  const body = validateBody(ragContextSchema, await readBody(event))
  const { query, mapId, queryEmbedding, maxNodes, threshold, includeNeighbors, documentIds } = body

  // Verify map ownership
  const map = await prisma.map.findFirst({
    where: { id: mapId, userId, deletedAt: null },
    select: { id: true, data: true }
  })
  if (!map) {
    throw createError({ statusCode: 404, statusMessage: 'Map not found' })
  }

  const vectorStr = toPgVector(queryEmbedding)

  // Template form auto-parameterizes every interpolation, so future edits
  // can't accidentally splice user input into the SQL string.
  const rows = await prisma.$queryRaw<ContextRow[]>`
    SELECT "nodeId", "sourceText",
           1 - ("embedding" <=> ${vectorStr}::vector) AS similarity
    FROM "NodeEmbedding"
    WHERE "mapId" = ${mapId}
      AND 1 - ("embedding" <=> ${vectorStr}::vector) >= ${threshold}
    ORDER BY "embedding" <=> ${vectorStr}::vector
    LIMIT ${maxNodes}
  `

  const context: Array<{
    nodeId: string
    text: string
    similarity: number
    isNeighbor: boolean
  }> = rows.map(row => ({
    nodeId: row.nodeId,
    text: row.sourceText,
    similarity: Number(row.similarity),
    isNeighbor: false
  }))

  // Optionally include graph-connected neighbor nodes
  if (includeNeighbors && context.length > 0) {
    const mapData = map.data as { edges?: Record<string, { source: string; target: string }> }
    const edges = mapData.edges ? Object.values(mapData.edges) : []
    const matchedNodeIds = new Set(context.map(c => c.nodeId))
    const neighborIds = new Set<string>()

    for (const edge of edges) {
      if (matchedNodeIds.has(edge.source) && !matchedNodeIds.has(edge.target)) {
        neighborIds.add(edge.target)
      }
      if (matchedNodeIds.has(edge.target) && !matchedNodeIds.has(edge.source)) {
        neighborIds.add(edge.source)
      }
    }

    // Fetch neighbor texts from pgvector. Prisma.join parameterizes the
    // IN-list so a future code change can't drift into injection.
    if (neighborIds.size > 0) {
      const neighborList = Array.from(neighborIds).slice(0, 20)
      const neighborRows = await prisma.$queryRaw<Array<{ nodeId: string; sourceText: string }>>`
        SELECT "nodeId", "sourceText" FROM "NodeEmbedding"
        WHERE "mapId" = ${mapId} AND "nodeId" IN (${Prisma.join(neighborList)})
      `

      for (const row of neighborRows) {
        context.push({
          nodeId: row.nodeId,
          text: row.sourceText,
          similarity: 0,
          isNeighbor: true
        })
      }
    }
  }

  // --------------------------------------------------------------------------
  // Document-RAG context (optional). Kept in a SEPARATE array from the map's
  // own node context: node text is the user's own trusted graph, whereas
  // document chunks are UNTRUSTED extracted text that the downstream prompt
  // assembler (server/utils/ragPromptGuard.ts) must escape + wrap. Merging the
  // two would let untrusted document text masquerade as trusted node context.
  // --------------------------------------------------------------------------
  const documentContext: Array<{
    source: 'chunk'
    documentId: string
    chunkId: string
    text: string
    page: number | null
  }> = []

  if (documentIds && documentIds.length > 0) {
    // De-dup so the IN-list and the owned-set check stay 1:1 with the request.
    const requestedIds = Array.from(new Set(documentIds))

    // Pre-flight: every requested document must be owned by the caller, not
    // soft-deleted, and fully ingested (READY). Anything else → 403. We do NOT
    // silently drop unowned/not-ready ids: leaking which ids exist (404 vs 403)
    // or partial-answering on a not-ready doc are both worse than a hard reject.
    const ownedReady = await prisma.document.findMany({
      where: {
        id: { in: requestedIds },
        userId,
        deletedAt: null,
        status: 'READY',
      },
      select: { id: true },
    })

    if (ownedReady.length !== requestedIds.length) {
      throw createError({
        statusCode: 403,
        statusMessage: 'One or more documents are not owned by you or not ready',
      })
    }

    // Compute the query embedding SERVER-SIDE from the raw query text. We never
    // trust a client-supplied document embedding (§0(f)): the client's
    // `queryEmbedding` is validated for node retrieval, but document retrieval
    // re-embeds here so a forged/poisoned vector can't steer chunk selection.
    const docQueryEmbedding = await generateEmbeddingFromText(query, 'query')
    const docVectorStr = toPgVector(docQueryEmbedding)

    // Semantic retrieval scoped to BOTH the requested documentIds AND the
    // caller's userId (defense-in-depth alongside the ownership pre-flight —
    // the denormalized dc.userId column is the mandatory tenant-isolation
    // filter). Prisma.join parameterizes the IN-list; the vector and limit are
    // interpolated as bound params, so nothing is concatenated into the SQL.
    const docRows = await prisma.$queryRaw<DocumentChunkRow[]>`
      SELECT dc."id" AS "chunkId",
             dc."documentId" AS "documentId",
             dc."text" AS "text",
             dc."page" AS "page"
      FROM "DocumentChunk" dc
      WHERE dc."userId" = ${userId}
        AND dc."documentId" IN (${Prisma.join(requestedIds)})
      ORDER BY dc."embedding" <=> ${docVectorStr}::vector
      LIMIT ${MAX_DOC_CHUNKS}
    `

    for (const row of docRows) {
      documentContext.push({
        source: 'chunk',
        documentId: row.documentId,
        chunkId: row.chunkId,
        text: row.text,
        page: row.page,
      })
    }
  }

  // Estimate token count (~4 chars per token) across BOTH context channels.
  const nodeTokens = context.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0)
  const docTokens = documentContext.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0)
  const totalTokensEstimate = nodeTokens + docTokens

  // SERVER-SIDE prompt-injection wrapping (plan §0(f), §6). When document chunks
  // were retrieved, we assemble the SAFE, escaped, source-attributed block here —
  // NEVER trusting the client to do it. The client injects `documentKnowledge`
  // VERBATIM into the system prompt; `documentContext[]` stays as raw reference
  // data and must NOT be sent to the LLM. With no chunks this is '' (empty), and
  // the rest of the response is byte-for-byte the legacy shape — additive only.
  const documentKnowledge = buildDocumentKnowledge(documentContext.map(c => c.text))

  return { context, documentContext, totalTokensEstimate, documentKnowledge }
})
