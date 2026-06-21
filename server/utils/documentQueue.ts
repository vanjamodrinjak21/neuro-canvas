// ---------------------------------------------------------------------------
// BullMQ producer seam for document ingestion (Document RAG — §P4 / §0(b)).
//
// See docs/architecture/document-rag-implementation-plan.md §0(b) (BullMQ GA
// target, in-process MVP behind a seam). This module is the OPT-IN producer
// half of that seam: it builds a single 'doc-ingest' Queue lazily and exposes a
// fire-and-forget `enqueueIngestionJob(documentId)` helper.
//
// IMPORTANT — this is NOT the default path. `enqueueIngestion` in
// documentIngestion.ts only routes here when INGESTION_MODE === 'bullmq'. With
// the flag unset (the SAFE DEFAULT), nothing in this file is ever imported or
// constructed, so no BullMQ Queue / Redis producer connection is opened. That
// keeps the in-process MVP fully functional until a dedicated worker service
// (the BullMQ CONSUMER half, §0(b)) is actually deployed.
//
// Wiring notes:
//   - The connection is a DEDICATED ioredis client built from REDIS_URL
//     (config.redisUrl). BullMQ requires `maxRetriesPerRequest: null` on its
//     connection, so we do NOT reuse the shared `redis` singleton from redis.ts
//     (which sets maxRetriesPerRequest: 3).
//   - We namespace via the BullMQ `prefix: 'neurocanvas'` Queue option — NEVER
//     ioredis `keyPrefix`. BullMQ uses Lua scripts with hash-tagged keys and is
//     explicitly incompatible with ioredis keyPrefix; using `prefix` is the
//     supported way to isolate its keyspace. The future worker service MUST use
//     the same prefix + queue name to consume these jobs.
// ---------------------------------------------------------------------------

import { Queue } from 'bullmq'
import IORedis, { type Redis } from 'ioredis'

/** Stable queue name. The GA worker service MUST consume from this exact name. */
export const INGEST_QUEUE_NAME = 'doc-ingest'

/** BullMQ keyspace prefix. The GA worker MUST use this exact prefix. */
const INGEST_QUEUE_PREFIX = 'neurocanvas'

/** The job payload — just the document id; the worker re-reads the row. */
export interface IngestJobData {
  documentId: string
}

// Lazily-built singletons. Nothing here is constructed until the first opt-in
// enqueue, so the in-process default never opens a producer connection.
let queue: Queue<IngestJobData> | null = null
let connection: Redis | null = null

/**
 * Build (once) the dedicated ioredis connection for the producer.
 *
 * BullMQ mandates `maxRetriesPerRequest: null` on its Redis connection, so this
 * is a separate client from the shared app singleton in redis.ts. `lazyConnect`
 * defers the actual socket until the first command (the first `queue.add`).
 */
function getConnection(): Redis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
  }
  return connection
}

/**
 * Lazily build the 'doc-ingest' BullMQ Queue on a dedicated ioredis connection.
 *
 * Namespaced with the BullMQ `prefix` option (NEVER ioredis keyPrefix). Safe to
 * call repeatedly — the Queue is memoized for the process lifetime.
 */
export function getIngestQueue(): Queue<IngestJobData> {
  if (!queue) {
    queue = new Queue<IngestJobData>(INGEST_QUEUE_NAME, {
      prefix: INGEST_QUEUE_PREFIX,
      connection: getConnection(),
    })
  }
  return queue
}

/**
 * Enqueue one document for ingestion onto the BullMQ queue.
 *
 * Job options:
 *   - deduplication.id = documentId → a duplicate enqueue while a job for this
 *     doc is still in flight is ignored (idempotent producer; matches the
 *     in-process atomic-claim guarantee on the consumer side).
 *   - attempts: 3 with exponential backoff (5s base) → transient failures retry.
 *   - removeOnComplete / removeOnFail → bound the completed/failed key growth.
 *
 * Returns the underlying `queue.add` promise so the caller can attach a single
 * catch+log; the caller treats producing as fire-and-forget (a failed enqueue
 * must never 500 the confirm endpoint).
 */
export function enqueueIngestionJob(documentId: string): Promise<unknown> {
  return getIngestQueue().add(
    INGEST_QUEUE_NAME,
    { documentId },
    {
      deduplication: { id: documentId },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  )
}
