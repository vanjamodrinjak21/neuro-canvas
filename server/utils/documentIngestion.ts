// ---------------------------------------------------------------------------
// Document ingestion worker (Document RAG — §P4).
//
// See docs/architecture/document-rag-implementation-plan.md §3/§5 + §0(b,d,g)
// and document-rag-research-guidance.md §3 (parsing) + §5 (jobs).
//
// `processDocument(documentId)` is the orchestrator: it atomically CLAIMs a
// QUEUED row, fetches the bytes from R2, parses + chunks + batch-embeds them,
// bulk-inserts the chunks (with their pgvector embeddings) and flips the row to
// READY — or FAILED with a sanitized message. The concurrency slot reserved by
// `confirm.post.ts` is ALWAYS released in a finally (but only for the invocation
// that actually claimed the row — see the atomic-claim note below).
//
// `enqueueIngestion(documentId)` is the PRODUCER SEAM. The SAFE DEFAULT body is
// a fire-and-forget in-process call; setting INGESTION_MODE='bullmq' flips it to
// the opt-in BullMQ producer (`enqueueIngestionJob` in documentQueue.ts) that a
// dedicated Railway worker service (§0(b)) consumes. The signature is kept
// stable so the swap is a flag flip, not a rewrite — and the in-process path
// stays the default so nothing breaks until that worker service is deployed.
//
// Reconciled hardening folded in:
//   - §0(b): atomic QUEUED→PROCESSING claim (multi-replica / restart safe).
//   - §0(d): batched embeddings (one ONNX pass per 32-text batch), R2 SDK
//            GetObject (no signed-URL self-fetch → no SSRF surface).
//   - §0(g): parse runs under parseInWorkerThread — an isolated worker_thread
//            (256 MB heap cap) hard-terminated on timeout via
//            setTimeout+worker.terminate(). This hardens BOTH the in-process
//            MVP and the future BullMQ worker: a CPU-bound malicious doc can no
//            longer block the Nitro loop or OOM the process. parseWithTimeout
//            stays exported as an in-process fallback.
//   - SEC: errorMessage is ALWAYS a sanitized typed code — never an r2Key, a
//          stack, or a raw library error.
//   - The bulk INSERT mirrors the semantic.post.ts idiom — every interpolation
//          is parameterized via the Prisma template tag / Prisma.join; the
//          GENERATED `fts` column is NEVER written (Postgres rejects that).
//
//   // TODO(P4-GA): replace the worker_thread-less in-process parse/embed with a
//   // dedicated Railway worker service running BullMQ. The producer seam below
//   // (`enqueueIngestion`) is built so only its body changes.
// ---------------------------------------------------------------------------

import { randomUUID, createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getObjectBuffer } from './r2'
import { releaseIngest } from './redis'
import {
  parseInWorkerThread,
  DocumentParseError,
  DEFAULT_PARSE_TIMEOUT_MS,
  type ParsedPage,
} from './documentParser'
import { chunkText } from './documentChunker'
import {
  generateEmbeddingsFromTexts,
  toPgVector,
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
} from './embeddings'

/** Embedding batch size — one ONNX pass per group of this many chunk texts. */
const EMBED_BATCH_SIZE = 32

/** Max rows per bulk-INSERT statement (bounds statement size + HNSW lock span). */
const INSERT_BATCH_ROWS = 200

/**
 * Postgres unique-violation code. The Document.sha256 update can collide with
 * the partial-unique `(userId, sha256) WHERE deletedAt IS NULL` index when the
 * SAME user already has an active copy of these exact bytes.
 */
const PG_UNIQUE_VIOLATION = 'P2002'

/** Prisma "record to update not found" — the doc was cascade-deleted mid-flight. */
const PG_RECORD_NOT_FOUND = 'P2025'

type PrismaErr = { code?: string }

function prismaErrorCode(err: unknown): string | undefined {
  return (err as PrismaErr | null)?.code
}

/**
 * A chunk ready to persist: its monotonic index, text, approx token count, and
 * 1-based source page. Carried from the parsed pages through embedding so the
 * page number survives into the row.
 */
interface PreparedChunk {
  chunkIndex: number
  text: string
  tokenCount: number
  page: number
}

/**
 * Concatenate parsed pages into chunks while carrying each chunk's source page.
 *
 * We chunk EACH page independently (re-basing the chunk index to be monotonic
 * across the whole document) so a chunk's `page` is exact — a chunk never spans
 * two pages. The chunker's own overlap is per-call; cross-page overlap is not
 * needed because page boundaries are themselves semantic boundaries.
 */
function chunkPages(pages: ParsedPage[]): PreparedChunk[] {
  const out: PreparedChunk[] = []
  let nextIndex = 0
  for (const { page, text } of pages) {
    const chunks = chunkText(text)
    for (const c of chunks) {
      out.push({
        chunkIndex: nextIndex++,
        text: c.text,
        tokenCount: c.approxTokens,
        page,
      })
    }
  }
  return out
}

/**
 * Embed chunk texts in batches of {@link EMBED_BATCH_SIZE}, returning a 256d
 * vector per chunk (order-preserving). One pipeline pass per batch — the §0(d)
 * performance requirement — instead of N serial single-text calls.
 */
async function embedChunkTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE)
    const embedded = await generateEmbeddingsFromTexts(batch, 'document')
    for (const v of embedded) vectors.push(v)
  }
  return vectors
}

/**
 * Bulk-insert chunk rows in sub-batches of ≤{@link INSERT_BATCH_ROWS}. Each row
 * is a parameterized `Prisma.sql` fragment; `Prisma.join` assembles the
 * multi-row VALUES list. The GENERATED `fts` column is intentionally OMITTED.
 * `ON CONFLICT (documentId, chunkIndex) DO NOTHING` makes a re-run idempotent
 * (crash-resume safe).
 */
async function insertChunks(
  documentId: string,
  userId: string,
  chunks: PreparedChunk[],
  vectors: number[][],
): Promise<void> {
  for (let start = 0; start < chunks.length; start += INSERT_BATCH_ROWS) {
    const slice = chunks.slice(start, start + INSERT_BATCH_ROWS)

    const rows = slice.map((c, j) => {
      const vectorStr = toPgVector(vectors[start + j]!)
      // Column order MUST match the VALUES list in the INSERT below.
      return Prisma.sql`(
        ${randomUUID()},
        ${documentId},
        ${userId},
        ${c.chunkIndex},
        ${c.text},
        ${c.tokenCount},
        ${c.page},
        ${vectorStr}::vector,
        ${EMBEDDING_MODEL},
        ${EMBEDDING_DIMS}
      )`
    })

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (
        "id", "documentId", "userId", "chunkIndex", "text",
        "tokenCount", "page", "embedding", "modelVersion", "dimensions"
      )
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("documentId", "chunkIndex") DO NOTHING
    `
  }
}

/**
 * Map any thrown error to a SHORT, SANITIZED message for `Document.errorMessage`.
 * Typed parse errors surface their code; everything else collapses to a generic
 * message. NEVER returns an r2Key, a stack, or a raw library error string.
 */
function sanitizeErrorMessage(err: unknown): string {
  if (err instanceof DocumentParseError) {
    return `parse_error:${err.code}`
  }
  return 'Ingestion failed'
}

/**
 * Orchestrate ingestion for one document. Idempotent and crash-resumable.
 *
 * Lifecycle (each step's failure mode is handled below):
 *   1. ATOMIC CLAIM — updateMany QUEUED→PROCESSING. 0 rows ⇒ already claimed by
 *      another replica/restart (or never queued) ⇒ return WITHOUT releasing the
 *      reserve (the claimer owns the slot).
 *   2. Load the Document (userId, r2Key, mimeType, byteSize).
 *   3. Fetch bytes from R2 via the SDK (no signed-URL self-fetch).
 *   4. Parse in an isolated worker_thread via parseInWorkerThread(...).
 *   5. Compute the REAL sha256 and replace the presign sentinel. A unique
 *      violation (same user already has these active bytes) ⇒ FAILED('duplicate').
 *   6. Chunk the concatenated pages (carrying page numbers).
 *   7. Batch-embed the chunk texts (32/batch).
 *   8. Bulk-insert chunks (≤200/statement), ON CONFLICT DO NOTHING.
 *   9. Flip to READY with chunkCount + pageCount.
 *  10. ALWAYS releaseIngest(userId) in finally (only when WE claimed the row);
 *      on any error set status=FAILED + sanitized errorMessage and still release.
 */
export async function processDocument(documentId: string): Promise<void> {
  // (1) ATOMIC CLAIM. This is the FIRST DB op — only the invocation that flips
  // QUEUED→PROCESSING owns the slot reserved at confirm-time. If count===0 the
  // row was already claimed (or isn't QUEUED): exit clean, do NOT release.
  const claim = await prisma.document.updateMany({
    where: { id: documentId, status: 'QUEUED' },
    data: { status: 'PROCESSING' },
  })
  if (claim.count === 0) return

  // From here the slot is ours — release on EVERY exit path.
  let claimUserId: string | null = null

  try {
    // (2) Load the row we just claimed.
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { userId: true, r2Key: true, mimeType: true, byteSize: true },
    })
    if (!doc) {
      // Cascade-deleted between the claim and the read — nothing to do. We still
      // need to release the slot, so fall through the finally; record the userId
      // if we can (we can't here), so this is a best-effort clean exit.
      return
    }
    claimUserId = doc.userId

    // (3) Fetch bytes from R2 (bounded by the confirm-time ≤20 MB HEAD gate).
    const buffer = await getObjectBuffer(doc.r2Key)

    // (4) Parse in an ISOLATED worker_thread (§0(g)). This is the safe ceiling:
    // a CPU-bound or memory-bombing parse runs in its own V8 isolate (256 MB
    // heap cap) and is HARD-terminated via setTimeout+worker.terminate() on
    // timeout — so it can neither block the Nitro event loop nor OOM this
    // process. parseDocument's internal Promise.race only stops *waiting*;
    // parseInWorkerThread is what actually stops the work. parseWithTimeout
    // remains exported as an in-process fallback.
    const pages = await parseInWorkerThread(
      buffer,
      doc.mimeType,
      DEFAULT_PARSE_TIMEOUT_MS,
    )

    // (5) Compute the REAL sha256 of the bytes and replace the presign sentinel.
    // A P2002 here means another ACTIVE document for this user already holds
    // these exact bytes → mark THIS one FAILED('duplicate') and stop.
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { sha256 },
      })
    } catch (err) {
      if (prismaErrorCode(err) === PG_UNIQUE_VIOLATION) {
        await prisma.document
          .update({
            where: { id: documentId },
            data: { status: 'FAILED', errorMessage: 'duplicate' },
          })
          .catch(() => {})
        return
      }
      throw err
    }

    // (6) Chunk the parsed pages (page numbers carried).
    const chunks = chunkPages(pages)
    if (chunks.length === 0) {
      // Parser asserts non-empty text, so an empty chunk set is only possible if
      // every page was below the chunk floor. Treat as no-text rather than a
      // silent empty-READY.
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', errorMessage: 'parse_error:no_text' },
      })
      return
    }

    // (7) Batch-embed.
    const vectors = await embedChunkTexts(chunks.map((c) => c.text))
    if (vectors.length !== chunks.length) {
      throw new Error('embedding count does not match chunk count')
    }

    // (8) Bulk-insert (idempotent).
    await insertChunks(documentId, doc.userId, chunks, vectors)

    // (9) READY.
    const pageCount =
      pages.length > 0 ? Math.max(...pages.map((p) => p.page)) : 0
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'READY',
        chunkCount: chunks.length,
        pageCount,
        errorMessage: null,
      },
    })
  } catch (err) {
    // Any failure → FAILED with a sanitized message. Swallow the FAILED write's
    // own errors (e.g. P2025 if the doc was cascade-deleted mid-flight) so the
    // finally still releases the slot.
    if (prismaErrorCode(err) !== PG_RECORD_NOT_FOUND) {
      await prisma.document
        .update({
          where: { id: documentId },
          data: { status: 'FAILED', errorMessage: sanitizeErrorMessage(err) },
        })
        .catch(() => {})
    }
    console.error('[ingestion] processing failed', documentId, sanitizeErrorMessage(err))
  } finally {
    // (10) ALWAYS release the slot we claimed. If we never resolved the userId
    // (doc vanished before the read), fall back to releasing by re-reading; the
    // reserve TTL is the ultimate backstop if even that is unavailable.
    if (claimUserId) {
      await releaseIngest(claimUserId)
    } else {
      const owner = await prisma.document
        .findUnique({ where: { id: documentId }, select: { userId: true } })
        .catch(() => null)
      if (owner?.userId) await releaseIngest(owner.userId)
    }
  }
}

/**
 * PRODUCER SEAM — enqueue a confirmed document for ingestion.
 *
 * Fire-and-forget either way: errors are logged, never thrown (the caller is the
 * confirm endpoint, which has already flipped the row to QUEUED and must not 500
 * because a background job failed to start).
 *
 * Routing (§0(b)):
 *   - INGESTION_MODE === 'bullmq' (OPT-IN): hand the job to the BullMQ producer
 *     (`enqueueIngestionJob`), consumed by a dedicated Railway worker service.
 *     The `import('./documentQueue')` is dynamic so the BullMQ Queue + its Redis
 *     producer connection are only ever built when this mode is explicitly on.
 *   - otherwise (the SAFE DEFAULT): keep the in-process MVP path verbatim. This
 *     remains the default precisely so nothing breaks until the worker service
 *     is actually deployed — no opt-in flag means no BullMQ dependency at all.
 */
export function enqueueIngestion(documentId: string): void {
  const useBullmq = process.env.INGESTION_MODE === 'bullmq'

  if (useBullmq) {
    // Opt-in BullMQ producer. Dynamic import keeps the queue/connection out of
    // the default in-process path. Add is fire-and-forget: catch + log only.
    void import('./documentQueue')
      .then(({ enqueueIngestionJob }) => enqueueIngestionJob(documentId))
      .catch((err) =>
        console.error('[ingestion] enqueue (bullmq) failed', documentId, err),
      )
    return
  }

  // SAFE DEFAULT — in-process MVP (unchanged).
  void processDocument(documentId).catch((err) =>
    console.error('[ingestion] failed', documentId, err),
  )
}
