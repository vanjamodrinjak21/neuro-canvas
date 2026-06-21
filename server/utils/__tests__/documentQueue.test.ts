import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// BullMQ producer seam (§0(b)) — opt-in via INGESTION_MODE='bullmq'; the
// in-process MVP stays the SAFE DEFAULT.
//
// We mock 'bullmq' so the Queue never touches a real Redis: the Queue stub
// records every `add(...)` call. We mock 'ioredis' so building the dedicated
// producer connection is inert. And we mock the heavy ingestion leaf deps
// (Prisma / R2 / embeddings / parser) so importing documentIngestion is cheap.
//
// To assert WHICH path enqueueIngestion took we use observable signals rather
// than spying on the module-local `processDocument` binding (an ESM live
// binding the seam calls directly — a namespace spy cannot intercept it):
//   - in-process path → the FIRST thing processDocument does is
//     `prisma.document.updateMany(...)`, so that mocked spy firing proves the
//     in-process default ran.
//   - bullmq path → the mocked Queue's `add(...)` fires with the dedup option,
//     and prisma.document.updateMany is NEVER touched.
// ---------------------------------------------------------------------------

// Captures every queue.add(name, data, opts) so we can assert the job options.
const addMock = vi.fn().mockResolvedValue(undefined)
// Captures the Queue constructor args (name, opts) to assert prefix + name.
const queueCtor = vi.fn()

class FakeQueue {
  constructor(name: string, opts: unknown) {
    queueCtor(name, opts)
  }
  add = addMock
}

vi.mock('bullmq', () => ({ Queue: FakeQueue }))

// ioredis: a no-op stub so getConnection() builds something inert. The producer
// only ever calls queue.add (which is mocked), so the connection is never used.
class FakeRedis {
  constructor(public url: string, public opts: unknown) {}
}
vi.mock('ioredis', () => ({ default: FakeRedis, Redis: FakeRedis }))

// processDocument's first DB op is prisma.document.updateMany (the atomic claim).
// We make it an observable spy that returns count:0 so processDocument exits
// immediately after the claim (no further mocked deps are exercised).
const updateManyMock = vi.fn().mockResolvedValue({ count: 0 })
vi.mock('../prisma', () => ({
  prisma: { document: { updateMany: updateManyMock, findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('../r2', () => ({ getObjectBuffer: vi.fn() }))
vi.mock('../redis', () => ({ releaseIngest: vi.fn() }))
vi.mock('../documentChunker', () => ({ chunkText: vi.fn(() => []) }))
vi.mock('../embeddings', () => ({
  generateEmbeddingsFromTexts: vi.fn(),
  toPgVector: vi.fn(),
  EMBEDDING_MODEL: 'test-model',
  EMBEDDING_DIMS: 256,
}))
vi.mock('../documentParser', () => ({
  parseInWorkerThread: vi.fn(),
  parseDocument: vi.fn(),
  parseWithTimeout: vi.fn(),
  DocumentParseError: class extends Error {},
  DEFAULT_PARSE_TIMEOUT_MS: 30_000,
}))

// Let any pending microtasks (the dynamic import('./documentQueue') + add, or
// the fire-and-forget processDocument promise) settle before asserting.
const flush = () => new Promise((r) => setTimeout(r, 0))

describe('documentQueue producer + enqueueIngestion routing', () => {
  const ORIGINAL_MODE = process.env.INGESTION_MODE

  beforeEach(() => {
    vi.resetModules()
    addMock.mockClear()
    addMock.mockResolvedValue(undefined)
    queueCtor.mockClear()
    updateManyMock.mockClear()
    updateManyMock.mockResolvedValue({ count: 0 })
    delete process.env.INGESTION_MODE
  })

  afterEach(() => {
    if (ORIGINAL_MODE === undefined) delete process.env.INGESTION_MODE
    else process.env.INGESTION_MODE = ORIGINAL_MODE
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // documentQueue unit — the producer itself.
  // -------------------------------------------------------------------------

  it('enqueueIngestionJob adds a doc-ingest job with deduplication + retry policy', async () => {
    const { enqueueIngestionJob, INGEST_QUEUE_NAME } = await import('../documentQueue')

    await enqueueIngestionJob('doc-123')

    expect(addMock).toHaveBeenCalledTimes(1)
    const [jobName, data, opts] = addMock.mock.calls[0]!
    expect(jobName).toBe(INGEST_QUEUE_NAME)
    expect(data).toEqual({ documentId: 'doc-123' })
    expect(opts).toMatchObject({
      deduplication: { id: 'doc-123' },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    })
  })

  it('builds the Queue with BullMQ prefix (NOT ioredis keyPrefix) and a connection', async () => {
    const { getIngestQueue, INGEST_QUEUE_NAME } = await import('../documentQueue')

    getIngestQueue()

    expect(queueCtor).toHaveBeenCalledTimes(1)
    const [name, opts] = queueCtor.mock.calls[0]! as [string, Record<string, unknown>]
    expect(name).toBe(INGEST_QUEUE_NAME)
    // Namespacing is via the BullMQ `prefix` option, never ioredis keyPrefix.
    expect(opts.prefix).toBe('neurocanvas')
    expect(opts).not.toHaveProperty('keyPrefix')
    expect(opts.connection).toBeInstanceOf(FakeRedis)
  })

  it('memoizes the Queue across calls (one construction for the process)', async () => {
    const { getIngestQueue } = await import('../documentQueue')

    const a = getIngestQueue()
    const b = getIngestQueue()

    expect(a).toBe(b)
    expect(queueCtor).toHaveBeenCalledTimes(1)
  })

  it('the producer connection uses maxRetriesPerRequest: null (BullMQ requirement)', async () => {
    const { getIngestQueue } = await import('../documentQueue')

    getIngestQueue()
    const [, opts] = queueCtor.mock.calls[0]! as [string, { connection: FakeRedis }]
    expect(opts.connection.opts).toMatchObject({ maxRetriesPerRequest: null })
  })

  // -------------------------------------------------------------------------
  // enqueueIngestion routing — the seam.
  // -------------------------------------------------------------------------

  it("with INGESTION_MODE='bullmq' it enqueues via the queue (deduplication.id) and does NOT run in-process", async () => {
    process.env.INGESTION_MODE = 'bullmq'

    const { enqueueIngestion } = await import('../documentIngestion')
    enqueueIngestion('doc-456')

    // The dynamic import('./documentQueue') + queue.add resolve on microtasks.
    await flush()

    expect(addMock).toHaveBeenCalledTimes(1)
    const [, data, opts] = addMock.mock.calls[0]!
    expect(data).toEqual({ documentId: 'doc-456' })
    expect(opts).toMatchObject({ deduplication: { id: 'doc-456' } })

    // The SAFE-DEFAULT in-process path must NOT have run (no atomic claim).
    expect(updateManyMock).not.toHaveBeenCalled()
  })

  it('WITHOUT the flag it uses the in-process default and NEVER touches the queue', async () => {
    // INGESTION_MODE is unset (deleted in beforeEach) — the safe default.
    const { enqueueIngestion } = await import('../documentIngestion')
    enqueueIngestion('doc-789')

    await flush()

    // In-process path taken: processDocument issued its atomic-claim updateMany.
    expect(updateManyMock).toHaveBeenCalledTimes(1)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: 'doc-789', status: 'QUEUED' },
      data: { status: 'PROCESSING' },
    })
    // ...and the BullMQ queue was never touched (no Queue built, no add).
    expect(addMock).not.toHaveBeenCalled()
    expect(queueCtor).not.toHaveBeenCalled()
  })

  it('any other INGESTION_MODE value falls back to the in-process default', async () => {
    process.env.INGESTION_MODE = 'in-process'

    const { enqueueIngestion } = await import('../documentIngestion')
    enqueueIngestion('doc-abc')

    await flush()

    expect(updateManyMock).toHaveBeenCalledTimes(1)
    expect(addMock).not.toHaveBeenCalled()
    expect(queueCtor).not.toHaveBeenCalled()
  })
})
