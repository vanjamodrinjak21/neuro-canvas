import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Tests for the BullMQ CONSUMER plugin (server/plugins/ingestion-worker.ts).
//
// The plugin is the worker half of the §0(b) producer/consumer seam. It:
//   - is a hard NO-OP unless INGESTION_WORKER === 'true' (web service path),
//   - otherwise constructs a BullMQ Worker on queue 'doc-ingest' under prefix
//     'neurocanvas' with a dedicated ioredis connection (maxRetriesPerRequest:
//     null), whose processor delegates to processDocument(job.data.documentId).
//
// `defineNitroPlugin` and `useRuntimeConfig` are Nuxt auto-imports (runtime
// globals). We stub them on globalThis: defineNitroPlugin simply returns the
// callback so the test can invoke the plugin body on demand with full control
// over env + config.
// ---------------------------------------------------------------------------

// --- BullMQ mock: capture Worker ctor args + the processor fn. Use a real
// function (not an arrow) so it is constructible with `new`. ---
const workerInstances: Array<{
  on: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}> = []
const WorkerCtor = vi.fn(function (
  this: unknown,
  _name: string,
  _processor: unknown,
  _opts: unknown,
) {
  const instance = { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) }
  workerInstances.push(instance)
  return instance
})
vi.mock('bullmq', () => ({ Worker: WorkerCtor }))

// --- ioredis mock: constructible (used with `new`); capture ctor args. ---
const IORedisCtor = vi.fn(function (this: unknown, _url: string, _opts: unknown) {
  return { __ioredis: true }
})
vi.mock('ioredis', () => ({ default: IORedisCtor }))

// --- documentQueue: reuse the REAL exported queue name so the test enforces
// that producer + consumer agree on it (no drift). ---
vi.mock('../../utils/documentQueue', () => ({ INGEST_QUEUE_NAME: 'doc-ingest' }))

// --- documentIngestion: the processor must call this. ---
const processDocumentMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../utils/documentIngestion', () => ({
  processDocument: processDocumentMock,
}))

// Capture the plugin callback registered via defineNitroPlugin.
let registeredPlugin: (() => Promise<void> | void) | null = null

const setRuntimeConfig = (config: Record<string, unknown>) => {
  ;(globalThis as unknown as { useRuntimeConfig: () => Record<string, unknown> }).useRuntimeConfig =
    () => config
}

// Import the plugin fresh so its top-level defineNitroPlugin call re-runs and
// re-captures the callback against the current global stubs.
async function loadPlugin() {
  registeredPlugin = null
  vi.resetModules()
  await import('../ingestion-worker')
  expect(registeredPlugin).toBeTypeOf('function')
  return registeredPlugin!
}

beforeEach(() => {
  workerInstances.length = 0
  WorkerCtor.mockClear()
  IORedisCtor.mockClear()
  processDocumentMock.mockClear()
  delete process.env.INGESTION_WORKER
  delete process.env.INGEST_CONCURRENCY
  process.env.REDIS_URL = 'redis://test-host:6379'

  ;(globalThis as unknown as { defineNitroPlugin: (fn: () => unknown) => unknown }).defineNitroPlugin =
    (fn) => {
      registeredPlugin = fn as () => Promise<void> | void
      return fn
    }
  setRuntimeConfig({ documentsEnabled: true, redisUrl: 'redis://config-host:6379' })
})

afterEach(() => {
  delete process.env.INGESTION_WORKER
  delete process.env.INGEST_CONCURRENCY
  vi.restoreAllMocks()
})

describe('ingestion-worker plugin', () => {
  it('is a no-op on the web service (INGESTION_WORKER unset): Worker is never constructed', async () => {
    // INGESTION_WORKER deliberately unset.
    const plugin = await loadPlugin()
    await plugin()

    expect(WorkerCtor).not.toHaveBeenCalled()
    expect(IORedisCtor).not.toHaveBeenCalled()
  })

  it('does not construct a Worker when INGESTION_WORKER!="true" even with documents enabled', async () => {
    process.env.INGESTION_WORKER = 'false'
    const plugin = await loadPlugin()
    await plugin()

    expect(WorkerCtor).not.toHaveBeenCalled()
  })

  it('does not construct a Worker when documentsEnabled is false', async () => {
    process.env.INGESTION_WORKER = 'true'
    setRuntimeConfig({ documentsEnabled: false, redisUrl: 'redis://config-host:6379' })
    const plugin = await loadPlugin()
    await plugin()

    expect(WorkerCtor).not.toHaveBeenCalled()
    expect(IORedisCtor).not.toHaveBeenCalled()
  })

  it('constructs the Worker with queue "doc-ingest", prefix "neurocanvas", and a maxRetriesPerRequest:null connection', async () => {
    process.env.INGESTION_WORKER = 'true'
    const plugin = await loadPlugin()
    await plugin()

    expect(WorkerCtor).toHaveBeenCalledTimes(1)
    const [name, processor, opts] = WorkerCtor.mock.calls[0]!
    expect(name).toBe('doc-ingest')
    expect(typeof processor).toBe('function')
    expect((opts as { prefix: string }).prefix).toBe('neurocanvas')
    expect((opts as { lockDuration: number }).lockDuration).toBe(60000)
    expect((opts as { stalledInterval: number }).stalledInterval).toBe(30000)
    expect((opts as { maxStalledCount: number }).maxStalledCount).toBe(2)

    // Dedicated ioredis connection built with maxRetriesPerRequest: null.
    expect(IORedisCtor).toHaveBeenCalledTimes(1)
    const [, redisOpts] = IORedisCtor.mock.calls[0]!
    expect((redisOpts as { maxRetriesPerRequest: number | null }).maxRetriesPerRequest).toBe(null)

    // The connection passed to the Worker is the one we just built.
    expect((opts as { connection: unknown }).connection).toEqual({ __ioredis: true })
  })

  it('processor calls processDocument(job.data.documentId)', async () => {
    process.env.INGESTION_WORKER = 'true'
    const plugin = await loadPlugin()
    await plugin()

    const [, processor] = WorkerCtor.mock.calls[0]!
    await (processor as (job: { data: { documentId: string } }) => Promise<void>)({
      data: { documentId: 'doc-123' },
    })

    expect(processDocumentMock).toHaveBeenCalledTimes(1)
    expect(processDocumentMock).toHaveBeenCalledWith('doc-123')
  })

  it('honors INGEST_CONCURRENCY (default 10)', async () => {
    process.env.INGESTION_WORKER = 'true'
    const plugin = await loadPlugin()
    await plugin()
    expect((WorkerCtor.mock.calls[0]![2] as { concurrency: number }).concurrency).toBe(10)

    WorkerCtor.mockClear()
    IORedisCtor.mockClear()
    process.env.INGEST_CONCURRENCY = '4'
    const plugin2 = await loadPlugin()
    await plugin2()
    expect((WorkerCtor.mock.calls[0]![2] as { concurrency: number }).concurrency).toBe(4)
  })

  it('registers completed/failed/error/stalled event handlers', async () => {
    process.env.INGESTION_WORKER = 'true'
    const plugin = await loadPlugin()
    await plugin()

    const worker = workerInstances[0]!
    const events = worker.on.mock.calls.map((c) => c[0])
    expect(events).toEqual(
      expect.arrayContaining(['completed', 'failed', 'error', 'stalled']),
    )
  })
})
