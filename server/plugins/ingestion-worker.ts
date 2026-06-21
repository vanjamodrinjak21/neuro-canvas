// ---------------------------------------------------------------------------
// BullMQ CONSUMER seam for document ingestion (Document RAG — §P4 / §0(b)).
//
// See docs/architecture/document-rag-implementation-plan.md §0(b). This is the
// CONSUMER half of the producer seam in server/utils/documentQueue.ts. The
// producer (`enqueueIngestionJob`) and this consumer MUST agree on the queue
// name + keyspace prefix or jobs are silently never picked up:
//   - queue name : 'doc-ingest'  (INGEST_QUEUE_NAME, exported by documentQueue.ts)
//   - prefix     : 'neurocanvas' (BullMQ `prefix`, NEVER ioredis keyPrefix)
//   - connection : a DEDICATED ioredis client from REDIS_URL with
//                  maxRetriesPerRequest: null (BullMQ mandates this; we never
//                  reuse the shared `redis` singleton which sets retries to 3).
//
// KEY DESIGN — one build, two roles. This is the SAME Nitro build deployed as a
// SECOND Railway service with INGESTION_WORKER=true. On that worker service this
// plugin starts a BullMQ Worker at boot and consumes 'doc-ingest'. On the WEB
// service (INGESTION_WORKER unset) it is a hard no-op: it returns before any
// BullMQ import is even reached, so the web service never opens a consumer Redis
// connection and never competes for jobs. The producer routes to the queue only
// when INGESTION_MODE === 'bullmq' (see documentIngestion.ts), so the GA wiring
// is: web service has INGESTION_MODE=bullmq, worker service has
// INGESTION_WORKER=true (and the same REDIS_URL).
//
// DEPLOY NOTE (env, not code): the worker Railway service should also set
//   RAILWAY_DEPLOYMENT_DRAINING_SECONDS=300
// so Railway holds the old deploy open after SIGTERM long enough for in-flight
// jobs to finish during the graceful shutdown below.
//
// Lock handling: we set lockDuration: 60000 and rely on BullMQ's BUILT-IN lock
// renewal (it auto-renews an active job's lock every lockDuration/2 = 30s).
// 60s comfortably exceeds a typical chunk → batch-embed → bulk-insert cycle, so
// we deliberately do NOT hand-roll job.extendLock — adding it would risk a
// double-renew / wrong-token bug for no benefit. stalledInterval + maxStalledCount
// govern recovery if the process truly dies mid-job.
// ---------------------------------------------------------------------------

export default defineNitroPlugin(async () => {
  // (1) ROLE GATE — only the worker service runs a consumer. On the web service
  // (flag unset) this is a true no-op: we return BEFORE importing BullMQ, so the
  // web build never constructs a Worker or opens a consumer Redis connection.
  if (process.env.INGESTION_WORKER !== 'true') return

  // (2) FEATURE GATE — if documents are disabled there is nothing to ingest.
  const config = useRuntimeConfig()
  if (!config.documentsEnabled) {
    console.warn(
      '[ingestion-worker] INGESTION_WORKER=true but documentsEnabled is false — ' +
        'not starting the BullMQ worker. Set DOCUMENTS_ENABLED=true on this service.',
    )
    return
  }

  // Imports are deferred to here so the web service never pulls in BullMQ/ioredis
  // for the worker role. INGEST_QUEUE_NAME is reused VERBATIM from the producer so
  // the name can never drift between the two sides.
  const { Worker } = await import('bullmq')
  const { default: IORedis } = await import('ioredis')
  const { INGEST_QUEUE_NAME } = await import('../utils/documentQueue')
  const { processDocument } = await import('../utils/documentIngestion')

  // The GA worker MUST use the SAME prefix as the producer (documentQueue.ts).
  // It is not exported from there, so we replicate the exact literal here.
  const INGEST_QUEUE_PREFIX = 'neurocanvas'

  // Dedicated consumer connection — mirrors documentQueue.ts getConnection():
  // REDIS_URL, maxRetriesPerRequest: null (REQUIRED by BullMQ workers).
  //
  // IMPORTANT: read process.env.REDIS_URL FIRST, NOT config.redisUrl. Nuxt
  // runtimeConfig is BAKED AT BUILD TIME — during the Docker build REDIS_URL is
  // unset, so config.redisUrl bakes to the 'redis://localhost:6379' fallback and
  // is only overridable at runtime by a NUXT_-prefixed var (NUXT_REDIS_URL).
  // Preferring config.redisUrl made the worker dial localhost:6379 inside its own
  // container → ECONNREFUSED loop. redis.ts + documentQueue.ts both read
  // process.env.REDIS_URL directly; this MUST match them.
  const redisUrl =
    process.env.REDIS_URL || (config.redisUrl as string) || 'redis://localhost:6379'
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  })
  // Positive, secret-free connection signal (host only — never the credentials).
  let redisHost = 'unknown'
  try {
    redisHost = `${new URL(redisUrl).hostname}:${new URL(redisUrl).port || '6379'}`
  } catch {
    /* keep 'unknown' */
  }
  connection.once('ready', () => {
    console.log(`[ingestion-worker] redis ready (${redisHost})`)
  })

  const concurrency = Number(process.env.INGEST_CONCURRENCY || '10')

  // (3) The Worker. Processor just delegates to the shared orchestrator; the job
  // payload carries only the documentId (IngestJobData), and processDocument
  // re-reads the row + atomically claims it (multi-replica / restart safe).
  const worker = new Worker<{ documentId: string }>(
    INGEST_QUEUE_NAME,
    async (job) => {
      await processDocument(job.data.documentId)
    },
    {
      connection,
      prefix: INGEST_QUEUE_PREFIX,
      concurrency,
      lockDuration: 60000,
      stalledInterval: 30000,
      maxStalledCount: 2,
    },
  )

  // (4) Concise, secret-free event logging.
  worker.on('completed', (job) => {
    console.log(`[ingestion-worker] completed job ${job.id} (doc ${job.data?.documentId})`)
  })
  worker.on('failed', (job, err) => {
    console.warn(
      `[ingestion-worker] failed job ${job?.id} (doc ${job?.data?.documentId}): ` +
        (err instanceof Error ? err.message : String(err)),
    )
  })
  // Surface enough detail that a connection failure isn't a blind, empty-message
  // loop (an ECONNREFUSED Error can carry its detail on .code, not .message).
  worker.on('error', (err) => {
    const e = err as { message?: string; code?: string; name?: string; address?: string; port?: number }
    const detail =
      [e?.name, e?.code, e?.message, e?.address && `${e.address}:${e.port ?? ''}`]
        .filter(Boolean)
        .join(' ') || '(no detail)'
    console.warn(`[ingestion-worker] worker error: ${detail}`)
  })
  worker.on('stalled', (jobId) => {
    console.warn(`[ingestion-worker] stalled job ${jobId}`)
  })

  console.log(
    `[ingestion-worker] started — queue "${INGEST_QUEUE_NAME}" prefix "${INGEST_QUEUE_PREFIX}" concurrency ${concurrency}`,
  )

  // (5) GRACEFUL SHUTDOWN. Railway sends SIGTERM on redeploy; honor SIGINT too.
  // worker.close() stops fetching new jobs and waits for active ones to settle
  // (bounded by RAILWAY_DEPLOYMENT_DRAINING_SECONDS=300 on the worker service).
  const shutdown = async (signal: string) => {
    console.log(`[ingestion-worker] ${signal} received — draining worker…`)
    try {
      await worker.close()
    } catch (err) {
      console.warn(
        '[ingestion-worker] error during shutdown: ' +
          (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      process.exit(0)
    }
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
})
