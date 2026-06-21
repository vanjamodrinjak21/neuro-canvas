import { ref, readonly, onScopeDispose } from 'vue'
import { usePlatform } from '~/composables/usePlatform'

// ---------------------------------------------------------------------------
// useDocumentUpload — single-file upload state machine (Document RAG, plan §8)
// ---------------------------------------------------------------------------
//
// Manages ONE upload through the three-phase server flow, exposing a small
// reactive contract the upload dialog binds to:
//
//   idle → validating → uploading → processing → ready
//                                              ↘ failed (any phase)
//
//   Phase 1  presign  : POST /api/documents/presign        → {documentId, uploadUrl}
//   Phase 2  PUT       : PUT bytes to uploadUrl. Two transports, picked by
//                        platform (usePlatform):
//                          • WEB    — XMLHttpRequest, so upload.onprogress drives
//                            an accurate progress% (0→100).
//                          • NATIVE — Capacitor (iOS/Android) / Tauri (desktop).
//                            A browser XHR/fetch PUT to R2's cross-origin
//                            presigned URL is blocked by CORS inside the native
//                            WebView, so we route the PUT through the same native
//                            HTTP layer the auth composables use (CapacitorHttp /
//                            Tauri's HTTP plugin), which has no same-origin policy.
//                        In BOTH cases R2 signed the Content-Type into the URL, so
//                        we MUST send the file's exact MIME or R2 403s.
//   Phase 3  confirm   : POST /api/documents/{id}/confirm   → {status:'queued'}
//                        then poll GET /api/documents/{id}/status with backoff
//                        3s → 30s, pausing while the tab is hidden, stopping the
//                        instant a terminal state (READY|FAILED) is observed —
//                        regardless of visibility.
//
// NATIVE PROGRESS CAVEAT: neither CapacitorHttp nor the Tauri HTTP plugin emit
// byte-level upload-progress events, so on native we CANNOT compute a real
// percentage. Rather than animate a fake/synthetic bar, we flip an
// `indeterminate` flag for the upload phase and leave `progress` at 0; the dialog
// renders an indeterminate (looping) bar instead of a misleading 0→100 fill. The
// presign → PUT → confirm → poll ordering is otherwise identical to web.
//
// Errors surface as STABLE i18n KEYS (not translated text) so the dialog owns
// presentation. Validation runs client-side as a fast first gate; the server
// re-validates authoritatively (presign size cap, confirm HeadObject MIME/size).
// ---------------------------------------------------------------------------

export type UploadState =
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed'

export type UploadIntent = 'generate_map' | 'attach_source' | 'none'

export interface StartOptions {
  intent: UploadIntent
  attachToMapId?: string
}

interface PresignResponse {
  documentId: string
  uploadUrl: string
}

interface StatusResponse {
  id: string
  status: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED'
  chunkCount?: number | null
  pageCount?: number | null
  errorMessage?: string | null
}

// Client-side allowlist — mirrors server `documentMime` (validation.ts). MIME is
// the primary gate; extension is a secondary guard for browsers that report an
// empty/incorrect `file.type` (common for .md, which often arrives as text/plain
// or '').
const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
])
const ALLOWED_EXT = new Set<string>(['pdf', 'docx', 'md', 'markdown', 'txt'])

// Mirrors server DOCUMENT_MAX_BYTES (validation.ts).
const MAX_BYTES = 20 * 1024 * 1024

// Polling backoff: first poll after 3s, growing 1.5× each round, capped at 30s.
const POLL_INITIAL_MS = 3_000
const POLL_MAX_MS = 30_000
const POLL_BACKOFF_FACTOR = 1.5

// i18n error keys (defined in i18n/locales/{en,hr}/canvas.json → canvas.documents.errors).
const ERR = {
  unsupportedType: 'documents.errors.unsupported_type',
  tooLarge: 'documents.errors.too_large',
  presignFailed: 'documents.errors.presign_failed',
  uploadFailed: 'documents.errors.upload_failed',
  confirmFailed: 'documents.errors.confirm_failed',
  processingFailed: 'documents.errors.processing_failed',
} as const

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

function isTerminal(status: StatusResponse['status']): boolean {
  return status === 'READY' || status === 'FAILED'
}

/**
 * Encode raw bytes as base64 for the Capacitor native HTTP bridge
 * (`dataType: 'file'`). Chunked to avoid blowing the argument-count limit of
 * String.fromCharCode on multi-MB documents.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function useDocumentUpload() {
  const { isCapacitor, isTauri, isNative } = usePlatform()

  const state = ref<UploadState>('idle')
  const progress = ref(0)
  // True while the upload PUT cannot report a real percentage (native HTTP
  // path). The dialog binds this to render an indeterminate bar.
  const indeterminate = ref(false)
  const error = ref<string | null>(null)
  const documentId = ref<string | null>(null)
  const status = ref<StatusResponse['status'] | null>(null)

  // The selected file, set by addFile and consumed by start.
  let file: File | null = null

  // Poll bookkeeping — a single timer at a time; visibility gating reschedules.
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let pollDelay = POLL_INITIAL_MS
  let activeXhr: XMLHttpRequest | null = null
  let onVisibility: (() => void) | null = null
  // Settled when the flow reaches a terminal state, so start()'s promise
  // resolves only once polling concludes. Reaching 'failed' is an expected
  // outcome (the reactive `state`/`error` carry it), so the promise RESOLVES on
  // both terminal states rather than rejecting — callers inspect `state.value`.
  let settleFlow: (() => void) | null = null

  function fail(code: string) {
    state.value = 'failed'
    error.value = code
    teardownPolling()
    const settle = settleFlow
    settleFlow = null
    settle?.()
  }

  function finishReady() {
    state.value = 'ready'
    teardownPolling()
    const settle = settleFlow
    settleFlow = null
    settle?.()
  }

  function teardownPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    if (onVisibility) {
      document.removeEventListener('visibilitychange', onVisibility)
      onVisibility = null
    }
  }

  /**
   * Validate + stage a file. Client-side gate only — sets 'failed' with an i18n
   * error code on violation, otherwise leaves the machine 'idle' (ready to start).
   */
  function addFile(f: File): boolean {
    reset()
    state.value = 'validating'

    const ext = fileExtension(f.name)
    const mimeOk = ALLOWED_MIME.has(f.type)
    const extOk = ALLOWED_EXT.has(ext)
    // Accept if EITHER signal is in the allowlist (covers empty/oddball MIME for
    // .md/.txt) but reject when BOTH are unknown.
    if (!mimeOk && !extOk) {
      fail(ERR.unsupportedType)
      return false
    }

    if (f.size > MAX_BYTES) {
      fail(ERR.tooLarge)
      return false
    }

    file = f
    state.value = 'idle'
    error.value = null
    return true
  }

  /** Run the full presign → PUT → confirm → poll flow. */
  function start(opts: StartOptions): Promise<void> {
    if (!file) {
      return Promise.reject(new Error('no file staged'))
    }
    if (state.value === 'failed') {
      // addFile already rejected this file; nothing to upload.
      return Promise.reject(new Error(error.value ?? 'invalid file'))
    }

    return new Promise<void>((resolve) => {
      settleFlow = resolve
      void runFlow(file as File, opts)
    })
  }

  async function runFlow(f: File, opts: StartOptions): Promise<void> {
    // ── Phase 1: presign ──
    let presigned: PresignResponse
    try {
      presigned = await $fetch<PresignResponse>('/api/documents/presign', {
        method: 'POST',
        body: {
          filename: f.name,
          declaredMime: f.type,
          sizeBytes: f.size,
          intent: opts.intent,
          ...(opts.attachToMapId ? { attachToMapId: opts.attachToMapId } : {}),
        },
      })
    } catch {
      fail(ERR.presignFailed)
      return
    }

    documentId.value = presigned.documentId
    state.value = 'uploading'
    progress.value = 0
    // Native HTTP transports give no byte-level progress → indeterminate.
    indeterminate.value = isNative.value

    // ── Phase 2: PUT bytes to R2 ──
    //   web    → XHR (real progress%)
    //   native → CapacitorHttp / Tauri HTTP plugin (bypasses WebView CORS),
    //            progress is indeterminate.
    try {
      if (isNative.value) {
        await putBytesNative(f, presigned.uploadUrl)
      } else {
        await putBytesWeb(f, presigned.uploadUrl)
      }
    } catch {
      indeterminate.value = false
      fail(ERR.uploadFailed)
      return
    }
    indeterminate.value = false

    // ── Phase 3: confirm, then poll status ──
    try {
      await $fetch(`/api/documents/${presigned.documentId}/confirm`, {
        method: 'POST',
        body: {},
      })
    } catch {
      fail(ERR.confirmFailed)
      return
    }

    state.value = 'processing'
    pollDelay = POLL_INITIAL_MS
    schedulePoll(presigned.documentId)
  }

  // ── Phase 2 transport: WEB (XHR, real upload progress) ──
  function putBytesWeb(f: File, uploadUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      activeXhr = xhr
      xhr.open('PUT', uploadUrl)
      // R2 signed the Content-Type into the presigned URL → must match exactly.
      xhr.setRequestHeader('Content-Type', f.type)
      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && e.total > 0) {
          progress.value = Math.min(100, Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = () => {
        activeXhr = null
        if (xhr.status >= 200 && xhr.status < 300) {
          progress.value = 100
          resolve()
        } else {
          reject(new Error(`upload failed: ${xhr.status}`))
        }
      }
      xhr.onerror = () => {
        activeXhr = null
        reject(new Error('upload network error'))
      }
      xhr.onabort = () => {
        activeXhr = null
        reject(new Error('upload aborted'))
      }
      xhr.send(f)
    })
  }

  // ── Phase 2 transport: NATIVE ──
  // A browser XHR/fetch PUT to R2's cross-origin presigned URL is blocked by
  // CORS inside the native WebView (no R2-side CORS rule for the app origin), so
  // we route the PUT through the platform's native HTTP layer — the exact same
  // CORS-free transport useMobileAuth.ts / useDesktopAuth.ts use for the API.
  //
  // These native layers do NOT expose byte-level upload progress, so the caller
  // has already set `indeterminate` and we never touch `progress` here.
  async function putBytesNative(f: File, uploadUrl: string): Promise<void> {
    const buffer = await f.arrayBuffer()

    if (isTauri.value) {
      // Tauri's HTTP plugin accepts a standard RequestInit; raw bytes go straight
      // into the body. (Mirrors useDesktopAuth.ts's tauriFetch usage.)
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const res = await tauriFetch(uploadUrl, {
        method: 'PUT',
        // R2 signed the Content-Type into the presigned URL → must match exactly.
        headers: { 'Content-Type': f.type },
        body: new Uint8Array(buffer),
      })
      if (!res.ok) {
        throw new Error(`native upload failed: ${res.status}`)
      }
      return
    }

    if (isCapacitor.value) {
      // CapacitorHttp cannot send Blob/ArrayBuffer directly on iOS/Android — the
      // native bridge marshals `data` as a string/JSON. For binary bodies the
      // documented path is base64 + `dataType: 'file'`, which tells the native
      // layer to decode the base64 back to raw bytes for the request body.
      // (Same import shape as useMobileAuth.ts's CapacitorHttp.request.)
      const { CapacitorHttp } = await import('@capacitor/core')
      const base64 = arrayBufferToBase64(buffer)
      const res = await CapacitorHttp.request({
        url: uploadUrl,
        method: 'PUT',
        // R2 signed the Content-Type into the presigned URL → must match exactly.
        headers: { 'Content-Type': f.type },
        data: base64,
        dataType: 'file',
      })
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`native upload failed: ${res.status}`)
      }
      return
    }

    // Should be unreachable — runFlow only calls this when isNative is true.
    throw new Error('native upload requested on a non-native platform')
  }

  // ── Polling with backoff + visibility gating ──
  function schedulePoll(id: string) {
    if (pollTimer) clearTimeout(pollTimer)

    // Install the visibility listener once; when the tab becomes visible again
    // and we are still processing, resume immediately.
    if (!onVisibility) {
      onVisibility = () => {
        if (!document.hidden && state.value === 'processing' && !pollTimer) {
          schedulePoll(id)
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
    }

    // Pause while hidden — the visibility listener re-schedules on resume. We do
    // NOT count hidden time, so a backgrounded tab makes no network calls.
    if (document.hidden) {
      return
    }

    pollTimer = setTimeout(() => {
      pollTimer = null
      void pollOnce(id)
    }, pollDelay)
  }

  async function pollOnce(id: string) {
    let result: StatusResponse
    try {
      result = await $fetch<StatusResponse>(`/api/documents/${id}/status`, { method: 'GET' })
    } catch {
      // Transient status error — back off and retry; the user can still cancel.
      pollDelay = Math.min(pollDelay * POLL_BACKOFF_FACTOR, POLL_MAX_MS)
      schedulePoll(id)
      return
    }

    status.value = result.status

    if (isTerminal(result.status)) {
      // STOP on terminal regardless of visibility.
      if (result.status === 'READY') {
        finishReady()
      } else {
        fail(ERR.processingFailed)
      }
      return
    }

    // Not terminal — back off (capped) and poll again.
    pollDelay = Math.min(pollDelay * POLL_BACKOFF_FACTOR, POLL_MAX_MS)
    schedulePoll(id)
  }

  /** Cancel any in-flight work and return to a clean idle slate. */
  function reset() {
    teardownPolling()
    if (activeXhr) {
      try {
        activeXhr.abort()
      } catch {
        // ignore
      }
      activeXhr = null
    }
    settleFlow = null
    file = null
    pollDelay = POLL_INITIAL_MS
    state.value = 'idle'
    progress.value = 0
    indeterminate.value = false
    error.value = null
    documentId.value = null
    status.value = null
  }

  onScopeDispose(() => {
    teardownPolling()
    if (activeXhr) {
      try {
        activeXhr.abort()
      } catch {
        // ignore
      }
    }
  })

  return {
    state: readonly(state),
    progress: readonly(progress),
    // True during the native upload PUT, where no real percentage is available.
    indeterminate: readonly(indeterminate),
    error: readonly(error),
    documentId: readonly(documentId),
    status: readonly(status),
    addFile,
    start,
    reset,
  }
}
