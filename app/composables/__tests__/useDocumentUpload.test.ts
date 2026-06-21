import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'
import { useDocumentUpload } from '../useDocumentUpload'

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------
//
// The composable is pure client logic that orchestrates these collaborators:
//   1. $fetch — Nuxt's global fetch (presign + confirm + status poll)
//   2. XMLHttpRequest — used for the R2 PUT on WEB (upload.onprogress events)
//   3. timers + document.hidden — backoff polling that pauses when hidden
//   4. usePlatform() — decides WEB (XHR) vs NATIVE (CapacitorHttp / Tauri HTTP)
//   5. @capacitor/core + @tauri-apps/plugin-http — native PUT transports
//
// We stub them all so the flow is fully deterministic. $fetch is dispatched by
// URL + method so a single mock can serve all three API endpoints.
// ---------------------------------------------------------------------------

// ── usePlatform mock — controllable platform flags ───────────────────────────
// Defaults to web; native tests flip these refs before constructing the
// composable. usePlatform() reads them once at construction.
const platformFlags = {
  isWeb: ref(true),
  isCapacitor: ref(false),
  isTauri: ref(false),
  isNative: ref(false),
}
function setPlatform(p: 'web' | 'capacitor' | 'tauri') {
  platformFlags.isWeb.value = p === 'web'
  platformFlags.isCapacitor.value = p === 'capacitor'
  platformFlags.isTauri.value = p === 'tauri'
  platformFlags.isNative.value = p !== 'web'
}
vi.mock('../usePlatform', () => ({
  usePlatform: () => platformFlags,
}))

// ── Native HTTP transport mocks ──────────────────────────────────────────────
// Both are dynamically imported inside putBytesNative; vi.mock intercepts the
// module so we can assert the native path is taken and inspect the PUT.
const capacitorHttpRequest = vi.fn()
vi.mock('@capacitor/core', () => ({
  CapacitorHttp: { request: (...args: unknown[]) => capacitorHttpRequest(...args) },
}))

const tauriFetch = vi.fn()
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => tauriFetch(...args),
}))

/** Build a fake File with a controllable size + type (happy-dom File honours both). */
function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['x'], name, { type })
  // happy-dom derives size from the blob parts; override for size-gate tests.
  Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true })
  // The native PUT path calls file.arrayBuffer(); give it deterministic bytes
  // so arrayBufferToBase64 has something to encode.
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
    configurable: true,
  })
  return file
}

const PDF_MIME = 'application/pdf'

/** A controllable fake XMLHttpRequest capturing the last instance. */
class FakeXHR {
  static last: FakeXHR | null = null
  static instances: FakeXHR[] = []

  method = ''
  url = ''
  requestHeaders: Record<string, string> = {}
  status = 0
  readyState = 0
  body: unknown = null
  upload = { onprogress: null as null | ((e: ProgressEvent) => void) }
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  onabort: null | (() => void) = null

  constructor() {
    FakeXHR.last = this
    FakeXHR.instances.push(this)
  }

  open(method: string, url: string) {
    this.method = method
    this.url = url
    this.readyState = 1
  }

  setRequestHeader(k: string, v: string) {
    this.requestHeaders[k] = v
  }

  send(body: unknown) {
    this.body = body
  }

  abort() {
    this.onabort?.()
  }

  /** Test helper: emit an upload progress tick. */
  emitProgress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent)
  }

  /** Test helper: complete the request with a status. */
  complete(status = 200) {
    this.status = status
    this.readyState = 4
    this.onload?.()
  }
}

let fetchMock: ReturnType<typeof vi.fn>
let visibilityState: 'visible' | 'hidden'

function setHidden(hidden: boolean) {
  visibilityState = hidden ? 'hidden' : 'visible'
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
  Object.defineProperty(document, 'visibilityState', { value: visibilityState, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  FakeXHR.last = null
  FakeXHR.instances = []
  vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest)
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
  capacitorHttpRequest.mockReset()
  tauriFetch.mockReset()
  setPlatform('web')
  setHidden(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Default $fetch router: presign → confirm → status sequence. */
function routeFetch(opts: {
  documentId?: string
  uploadUrl?: string
  statuses?: Array<Record<string, unknown>>
}) {
  const documentId = opts.documentId ?? 'doc_abc'
  const uploadUrl = opts.uploadUrl ?? 'https://r2.example.com/signed-put'
  const statuses = opts.statuses ?? [{ id: documentId, status: 'READY', chunkCount: 3 }]
  let statusIdx = 0

  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (url === '/api/documents/presign') {
      return Promise.resolve({ documentId, uploadUrl })
    }
    if (url === `/api/documents/${documentId}/confirm`) {
      return Promise.resolve({ status: 'queued' })
    }
    if (url === `/api/documents/${documentId}/status`) {
      const s = statuses[Math.min(statusIdx, statuses.length - 1)]
      statusIdx++
      return Promise.resolve(s)
    }
    return Promise.reject(new Error(`unexpected fetch ${url} ${init?.method ?? ''}`))
  })
}

describe('useDocumentUpload', () => {
  describe('addFile validation', () => {
    it('rejects an unsupported extension/MIME with a failed state + error code', () => {
      const up = useDocumentUpload()
      up.addFile(makeFile('virus.exe', 'application/octet-stream', 1024))
      expect(up.state.value).toBe('failed')
      expect(up.error.value).toBe('documents.errors.unsupported_type')
    })

    it('rejects a file larger than 20MB', () => {
      const up = useDocumentUpload()
      up.addFile(makeFile('huge.pdf', PDF_MIME, 21 * 1024 * 1024))
      expect(up.state.value).toBe('failed')
      expect(up.error.value).toBe('documents.errors.too_large')
    })

    it('accepts a valid PDF within the size cap → validating then idle-ready to start', () => {
      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 1024))
      expect(up.state.value).toBe('idle')
      expect(up.error.value).toBeNull()
    })
  })

  describe('start — 3-phase flow', () => {
    it('runs presign → PUT → confirm → poll → ready (happy path)', async () => {
      vi.useFakeTimers()
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'READY', chunkCount: 3 }] })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 4096))
      const done = up.start({ intent: 'generate_map' })

      // Let presign resolve, XHR open.
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledWith('/api/documents/presign', expect.objectContaining({ method: 'POST' }))
      expect(up.state.value).toBe('uploading')

      // XHR was opened as a PUT to the signed URL with the file MIME.
      const xhr = FakeXHR.last!
      expect(xhr.method).toBe('PUT')
      expect(xhr.url).toBe('https://r2.example.com/signed-put')
      expect(xhr.requestHeaders['Content-Type']).toBe(PDF_MIME)

      // Progress events drive progress%.
      xhr.emitProgress(2048, 4096)
      expect(up.progress.value).toBe(50)

      // Finish the PUT → confirm fires, then processing + first poll.
      xhr.complete(200)
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledWith('/api/documents/doc_abc/confirm', expect.objectContaining({ method: 'POST' }))
      expect(up.state.value).toBe('processing')

      // First poll fires after 3s and reports READY → terminal.
      await vi.advanceTimersByTimeAsync(3000)
      expect(fetchMock).toHaveBeenCalledWith('/api/documents/doc_abc/status', expect.anything())
      await done
      expect(up.state.value).toBe('ready')
      expect(up.documentId.value).toBe('doc_abc')
    })

    it('first poll delay is 3s (not before)', async () => {
      vi.useFakeTimers()
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'READY' }] })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      FakeXHR.last!.complete(200)
      await vi.advanceTimersByTimeAsync(0)
      expect(up.state.value).toBe('processing')

      const statusCallsBefore = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/status')).length
      // Just under 3s — no poll yet.
      await vi.advanceTimersByTimeAsync(2999)
      const statusCallsMid = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/status')).length
      expect(statusCallsMid).toBe(statusCallsBefore)

      // Crossing 3s triggers the first poll.
      await vi.advanceTimersByTimeAsync(1)
      const statusCallsAfter = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/status')).length
      expect(statusCallsAfter).toBe(statusCallsBefore + 1)
    })

    it('polling stops on a terminal state (no further status calls)', async () => {
      vi.useFakeTimers()
      routeFetch({
        statuses: [
          { id: 'doc_abc', status: 'PROCESSING' },
          { id: 'doc_abc', status: 'READY' },
        ],
      })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      FakeXHR.last!.complete(200)
      await vi.advanceTimersByTimeAsync(0)

      // First poll @3s → PROCESSING (keep polling). Next @4.5s → READY (stop).
      await vi.advanceTimersByTimeAsync(3000)
      await vi.advanceTimersByTimeAsync(4500)
      await done
      expect(up.state.value).toBe('ready')

      const callsAfterReady = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/status')).length
      // Advance well past several backoff windows — no new polls.
      await vi.advanceTimersByTimeAsync(60_000)
      const callsLater = fetchMock.mock.calls.filter(c => String(c[0]).endsWith('/status')).length
      expect(callsLater).toBe(callsAfterReady)
    })

    it('marks failed when status reports FAILED (terminal)', async () => {
      vi.useFakeTimers()
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'FAILED', errorMessage: 'boom' }] })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      FakeXHR.last!.complete(200)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(3000)
      await done
      expect(up.state.value).toBe('failed')
    })

    it('marks failed when the R2 PUT returns a non-2xx status', async () => {
      vi.useFakeTimers()
      routeFetch({})

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      FakeXHR.last!.complete(403)
      await done.catch(() => {})
      expect(up.state.value).toBe('failed')
      expect(up.error.value).toBe('documents.errors.upload_failed')
    })

    it('forwards attachToMapId in the presign body', async () => {
      vi.useFakeTimers()
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'READY' }] })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      const done = up.start({ intent: 'attach_source', attachToMapId: 'map_123' })

      await vi.advanceTimersByTimeAsync(0)
      const presignCall = fetchMock.mock.calls.find(c => c[0] === '/api/documents/presign')!
      expect(presignCall[1].body).toMatchObject({
        intent: 'attach_source',
        attachToMapId: 'map_123',
        declaredMime: PDF_MIME,
      })
      FakeXHR.last!.complete(200)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(3000)
      await done
      expect(up.state.value).toBe('ready')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Native transport — Capacitor (iOS/Android) + Tauri (desktop)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // On native, a browser XHR PUT to R2's cross-origin presigned URL is blocked
  // by CORS, so the PUT must go through the native HTTP layer instead. These
  // tests assert:
  //   • the native transport (CapacitorHttp.request / tauriFetch) is invoked
  //     with the signed URL, PUT, and the exact Content-Type R2 signed,
  //   • NO XMLHttpRequest is constructed (the web path is skipped),
  //   • progress is reported as INDETERMINATE (not a fake percentage),
  //   • the rest of the flow (presign → confirm → poll → ready) is unchanged.
  describe('native upload transport', () => {
    it('Capacitor: PUTs via CapacitorHttp (base64 + dataType:file), no XHR, indeterminate', async () => {
      vi.useFakeTimers()
      setPlatform('capacitor')
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'READY', chunkCount: 2 }] })
      capacitorHttpRequest.mockResolvedValue({ status: 200, data: '' })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 4096))
      const done = up.start({ intent: 'generate_map' })

      // Presign → native PUT.
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/documents/presign',
        expect.objectContaining({ method: 'POST' }),
      )

      // The native HTTP path was used — and the web XHR path was NOT.
      expect(capacitorHttpRequest).toHaveBeenCalledTimes(1)
      expect(FakeXHR.instances.length).toBe(0)

      const putArgs = capacitorHttpRequest.mock.calls[0]![0]
      expect(putArgs).toMatchObject({
        url: 'https://r2.example.com/signed-put',
        method: 'PUT',
        headers: { 'Content-Type': PDF_MIME },
        dataType: 'file',
      })
      // base64 of [1,2,3,4] === 'AQIDBA=='.
      expect(putArgs.data).toBe('AQIDBA==')

      // Progress is indeterminate during the (already-resolved here) upload, then
      // the flow proceeds to confirm + poll exactly like web.
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/documents/doc_abc/confirm',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(up.state.value).toBe('processing')
      expect(up.indeterminate.value).toBe(false) // cleared once upload settled

      await vi.advanceTimersByTimeAsync(3000)
      await done
      expect(up.state.value).toBe('ready')
      expect(up.documentId.value).toBe('doc_abc')
    })

    it('Capacitor: marks failed (upload_failed) when the native PUT returns non-2xx', async () => {
      vi.useFakeTimers()
      setPlatform('capacitor')
      routeFetch({})
      capacitorHttpRequest.mockResolvedValue({ status: 403, data: 'AccessDenied' })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      await done.catch(() => {})
      expect(capacitorHttpRequest).toHaveBeenCalledTimes(1)
      expect(FakeXHR.instances.length).toBe(0)
      expect(up.state.value).toBe('failed')
      expect(up.error.value).toBe('documents.errors.upload_failed')
      expect(up.indeterminate.value).toBe(false)
    })

    it('Tauri: PUTs via the Tauri HTTP plugin with raw bytes, no XHR', async () => {
      vi.useFakeTimers()
      setPlatform('tauri')
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'READY' }] })
      tauriFetch.mockResolvedValue({ ok: true, status: 200 })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 4096))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      // Native HTTP path used; web XHR path skipped.
      expect(tauriFetch).toHaveBeenCalledTimes(1)
      expect(FakeXHR.instances.length).toBe(0)

      const [url, init] = tauriFetch.mock.calls[0]!
      expect(url).toBe('https://r2.example.com/signed-put')
      expect(init).toMatchObject({
        method: 'PUT',
        headers: { 'Content-Type': PDF_MIME },
      })
      // Raw bytes go straight into the body (Uint8Array of [1,2,3,4]).
      expect(init.body).toBeInstanceOf(Uint8Array)
      expect(Array.from(init.body as Uint8Array)).toEqual([1, 2, 3, 4])

      await vi.advanceTimersByTimeAsync(0)
      expect(up.state.value).toBe('processing')
      await vi.advanceTimersByTimeAsync(3000)
      await done
      expect(up.state.value).toBe('ready')
    })

    it('Tauri: marks failed (upload_failed) when the native PUT is not ok', async () => {
      vi.useFakeTimers()
      setPlatform('tauri')
      routeFetch({})
      tauriFetch.mockResolvedValue({ ok: false, status: 403 })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 100))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      await done.catch(() => {})
      expect(tauriFetch).toHaveBeenCalledTimes(1)
      expect(FakeXHR.instances.length).toBe(0)
      expect(up.state.value).toBe('failed')
      expect(up.error.value).toBe('documents.errors.upload_failed')
    })

    it('web path still uses XHR and never touches native transports', async () => {
      vi.useFakeTimers()
      setPlatform('web')
      routeFetch({ statuses: [{ id: 'doc_abc', status: 'READY' }] })

      const up = useDocumentUpload()
      up.addFile(makeFile('notes.pdf', PDF_MIME, 4096))
      const done = up.start({ intent: 'none' })

      await vi.advanceTimersByTimeAsync(0)
      expect(FakeXHR.instances.length).toBe(1)
      expect(capacitorHttpRequest).not.toHaveBeenCalled()
      expect(tauriFetch).not.toHaveBeenCalled()
      expect(up.indeterminate.value).toBe(false)

      FakeXHR.last!.complete(200)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(3000)
      await done
      expect(up.state.value).toBe('ready')
    })
  })
})
