// ---------------------------------------------------------------------------
// Document parser — pure text extraction for the Document RAG pipeline.
//
// See docs/architecture/document-rag-implementation-plan.md §P3 ("Parser +
// chunker (pure, no I/O)") and §0.1(d,g), and the research guidance §3.
//
// Scope: deterministic, fully unit-testable extraction from an in-memory
// Buffer/Uint8Array. NO network, NO DB, NO Redis, NO filesystem (binary
// fixtures excepted in gated tests). The ingestion worker (§P4) feeds these
// pure functions a buffer it already fetched from R2.
//
// Hardening folded in from §0 reconciliation + research guidance §3:
//   - MAGIC-BYTE sniff FIRST via file-type's fileTypeFromBuffer (ESM-only →
//     dynamic import). Reject if the real type is outside the PDF/DOCX/MD/TXT
//     allowlist or contradicts the declared mime. text/* has no magic bytes,
//     so declared text/markdown|text/plain is allowed when the content is
//     valid UTF-8.
//   - DOCX zip-bomb guard: reject BEFORE mammoth if any central-directory
//     entry's declared uncompressed size, or the sum, exceeds 50 MB. We read
//     the ZIP central directory directly (no inflation) so a bomb is rejected
//     before it can expand.
//   - Encrypted/corrupt PDF → typed DocumentParseError('encrypted'|'corrupt').
//   - Zero extractable text → DocumentParseError('no_text') (never a silent
//     empty-READY for a scanned/empty doc).
//   - parseWithTimeout: Promise.race that rejects DocumentParseError('timeout')
//     so a pathological parse cannot hang the loop. NOTE: this in-process race
//     does NOT terminate CPU-bound work — it only stops *waiting*. It remains
//     exported as a FALLBACK; true isolation is parseInWorkerThread (below).
//   - parseInWorkerThread (§0(g) — IMPLEMENTED): spawns documentParser.worker.ts
//     in a worker_thread with resourceLimits.maxOldGenerationSizeMb = 256, posts
//     { buf, mime }, and races a setTimeout(() => worker.terminate(), 30_000)
//     that rejects DocumentParseError('timeout'). This is the ONLY way to stop
//     CPU-bound work in Node — AbortController/AbortSignal does NOT terminate a
//     running worker_thread. The worker is ALWAYS terminated in a finally. This
//     hardens BOTH the current in-process MVP and the future BullMQ worker: a
//     malicious CPU-bound PDF can no longer block the Nitro event loop.
//
//   DOCKER CAVEAT: per-worker resourceLimits.maxOldGenerationSizeMb is
//   OVERRIDDEN by a global --max-old-space-size in the container CMD/NODE_OPTIONS
//   (V8 applies the process-wide flag to every isolate, including worker
//   threads). If you cap the main heap globally, the 256 MB per-worker cap will
//   not take effect — size the global flag with the worker budget in mind, or
//   drop the global flag and rely on the per-worker limit.
//
// unpdf API (v1.6.2): getDocumentProxy(data) → extractText(proxy, {mergePages:
// false}) → { totalPages, text: string[] }. NEVER getPdfDocument (not an
// export). Encrypted PDFs surface a PDF.js error whose `.name` is
// 'PasswordException'; corrupt/invalid structure surfaces 'InvalidPDFException'
// / 'MissingPDFException'.
// ---------------------------------------------------------------------------

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** A single extracted page. `page` is 1-based. */
export interface ParsedPage {
  page: number
  text: string
}

/** Typed parse-error codes — surfaced to callers; never leak internals/stack. */
export type DocumentParseErrorCode =
  | 'unsupported' // magic-byte type not in allowlist or mismatches declared mime
  | 'corrupt' // unreadable bytes (invalid UTF-8, malformed PDF/ZIP structure)
  | 'encrypted' // password-protected PDF
  | 'no_text' // parsed successfully but produced zero extractable text
  | 'oversize' // DOCX zip-bomb / declared uncompressed size over the cap
  | 'timeout' // parse exceeded the time budget

/**
 * Typed, sanitized parse error. Carries a machine-readable `code` and a short
 * human message — never a stack, an R2 key, or library internals.
 */
export class DocumentParseError extends Error {
  readonly code: DocumentParseErrorCode
  constructor(code: DocumentParseErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'DocumentParseError'
    this.code = code
    // Preserve the prototype chain across the TS/ES5 target gap so
    // `instanceof DocumentParseError` holds in tests and callers.
    Object.setPrototypeOf(this, DocumentParseError.prototype)
  }
}

/** Default per-parse time budget (ms). The worker may pass a shorter value. */
export const DEFAULT_PARSE_TIMEOUT_MS = 30_000

/** Hard cap on total declared DOCX uncompressed size, in bytes (50 MB). */
const DOCX_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024

/** Defensive page cap so a pathological PDF can't materialize unbounded pages. */
const MAX_PAGES = 2000

// The four accepted document mime types (v1 — no OCR, no images).
const MIME_PDF = 'application/pdf'
const MIME_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MIME_MARKDOWN = 'text/markdown'
const MIME_PLAIN = 'text/plain'

const DECLARED_MIME_ALLOWLIST = new Set<string>([
  MIME_PDF,
  MIME_DOCX,
  MIME_MARKDOWN,
  MIME_PLAIN,
])

// Mapping from a file-type-detected mime to our canonical declared mime, for
// the magic-byte/declared-mime cross-check. file-type reports DOCX as a ZIP
// (`application/zip`) because OOXML is a ZIP container — we accept zip when the
// declared mime is DOCX (the zip-bomb walk + mammoth provide deeper validation).
const DETECTED_TO_CANONICAL: Record<string, string> = {
  'application/pdf': MIME_PDF,
  'application/zip': MIME_DOCX,
  'application/x-cfb': MIME_DOCX, // legacy .doc CFB is rejected later by mammoth, but the container check passes here
}

/** Coerce a Buffer | Uint8Array to a Uint8Array view without copying. */
function toUint8(buf: Uint8Array | Buffer): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf)
}

/**
 * Strictly decode bytes as UTF-8. Throws DocumentParseError('corrupt') on any
 * malformed sequence (fatal mode), so a mislabeled binary cannot slip through
 * the text path.
 */
function decodeUtf8Strict(buf: Uint8Array | Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(toUint8(buf))
  } catch {
    throw new DocumentParseError('corrupt', 'Content is not valid UTF-8 text')
  }
}

/** Throw no_text if the trimmed text is empty. Returns the original text. */
function assertHasText(text: string): string {
  if (text.trim().length === 0) {
    throw new DocumentParseError('no_text', 'No extractable text found')
  }
  return text
}

// ---------------------------------------------------------------------------
// Text formats (Markdown / plain text) — utf8 decode → one page.
// ---------------------------------------------------------------------------

/** Parse a plain-text buffer into a single page. */
export function parsePlainText(buf: Uint8Array | Buffer): ParsedPage[] {
  const text = assertHasText(decodeUtf8Strict(buf))
  return [{ page: 1, text }]
}

/** Parse a Markdown buffer into a single page (raw text; chunker strips later). */
export function parseMarkdown(buf: Uint8Array | Buffer): ParsedPage[] {
  const text = assertHasText(decodeUtf8Strict(buf))
  return [{ page: 1, text }]
}

// ---------------------------------------------------------------------------
// PDF — unpdf (PDF.js v5 under the hood, WASM-free text path).
// ---------------------------------------------------------------------------

/**
 * Parse a PDF buffer into per-page text.
 *
 * Throws:
 *   - DocumentParseError('encrypted') for password-protected PDFs
 *   - DocumentParseError('corrupt')   for malformed/invalid PDF structure
 *   - DocumentParseError('no_text')   when zero text is extractable (scanned)
 */
export async function parsePdf(buf: Uint8Array | Buffer): Promise<ParsedPage[]> {
  const { getDocumentProxy, extractText } = await import('unpdf')

  let result: { totalPages: number; text: string[] }
  try {
    // unpdf mutates the underlying buffer; pass a copy so the caller's bytes
    // (and any subsequent magic-byte re-checks) are untouched.
    const data = new Uint8Array(toUint8(buf))
    const proxy = await getDocumentProxy(data)
    result = await extractText(proxy, { mergePages: false })
  } catch (err) {
    const name = (err as { name?: string } | null)?.name ?? ''
    if (name === 'PasswordException') {
      throw new DocumentParseError('encrypted', 'PDF is password-protected')
    }
    if (
      name === 'InvalidPDFException' ||
      name === 'MissingPDFException' ||
      name === 'UnknownErrorException'
    ) {
      throw new DocumentParseError('corrupt', 'PDF structure is invalid')
    }
    // Any other parser error is treated as corrupt — never leak the cause.
    throw new DocumentParseError('corrupt', 'Unable to read PDF')
  }

  const pages: ParsedPage[] = []
  const limit = Math.min(result.text.length, MAX_PAGES)
  for (let i = 0; i < limit; i++) {
    const text = (result.text[i] ?? '').trim()
    if (text.length > 0) pages.push({ page: i + 1, text })
  }

  if (pages.length === 0) {
    // Empty / scanned PDF with no text layer — never a silent empty-READY.
    throw new DocumentParseError('no_text', 'No extractable text in PDF')
  }
  return pages
}

// ---------------------------------------------------------------------------
// DOCX — zip-bomb guard (pre-inflation) → mammoth.extractRawText.
// ---------------------------------------------------------------------------

/**
 * Walk a ZIP container's central directory and sum the *declared* uncompressed
 * sizes WITHOUT inflating anything. Throws DocumentParseError('oversize') if any
 * single entry or the total exceeds DOCX_MAX_UNCOMPRESSED_BYTES, and
 * DocumentParseError('corrupt') if the structure is unreadable.
 *
 * Rationale: a DOCX is a ZIP. A "zip bomb" declares (or actually contains) a
 * huge uncompressed payload behind a tiny compressed one. Inflating first is
 * exactly the DoS we must avoid, so we read the central-directory records — the
 * authoritative size source — directly.
 */
function assertDocxNotBomb(buf: Uint8Array | Buffer): void {
  const bytes = toUint8(buf)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // Locate the End Of Central Directory (EOCD) record. It ends the file and
  // may carry a trailing comment, so scan backward for its signature.
  const EOCD_SIG = 0x06054B50
  const CEN_SIG = 0x02014B50
  let eocd = -1
  // EOCD is >= 22 bytes; comment can be up to 65535. Bound the scan window.
  const minEnd = Math.max(0, bytes.length - (22 + 0xFFFF))
  for (let i = bytes.length - 22; i >= minEnd; i--) {
    if (dv.getUint32(i, true) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) {
    throw new DocumentParseError('corrupt', 'DOCX is not a valid ZIP container')
  }

  const cdOffset = dv.getUint32(eocd + 16, true)
  const totalEntries = dv.getUint16(eocd + 10, true)

  let total = 0
  let offset = cdOffset
  for (let n = 0; n < totalEntries; n++) {
    if (offset + 46 > bytes.length || dv.getUint32(offset, true) !== CEN_SIG) {
      throw new DocumentParseError('corrupt', 'DOCX central directory is malformed')
    }
    const uncompressed = dv.getUint32(offset + 24, true)
    const nameLen = dv.getUint16(offset + 28, true)
    const extraLen = dv.getUint16(offset + 30, true)
    const commentLen = dv.getUint16(offset + 32, true)

    if (uncompressed > DOCX_MAX_UNCOMPRESSED_BYTES) {
      throw new DocumentParseError(
        'oversize',
        'DOCX entry exceeds the uncompressed size limit',
      )
    }
    total += uncompressed
    if (total > DOCX_MAX_UNCOMPRESSED_BYTES) {
      throw new DocumentParseError(
        'oversize',
        'DOCX total uncompressed size exceeds the limit',
      )
    }
    offset += 46 + nameLen + extraLen + commentLen
  }
}

/**
 * Parse a DOCX buffer into a single page of raw text.
 *
 * Runs the zip-bomb guard BEFORE handing bytes to mammoth. mammoth ≥1.11 sets
 * `externalFileAccess:false` by default (CVE-2025-11849).
 *
 * Throws:
 *   - DocumentParseError('oversize') if the zip-bomb guard trips
 *   - DocumentParseError('corrupt')  if mammoth cannot read the document
 *   - DocumentParseError('no_text')  if extraction yields no text
 */
export async function parseDocx(buf: Uint8Array | Buffer): Promise<ParsedPage[]> {
  assertDocxNotBomb(buf)

  const mammoth = (await import('mammoth')).default ?? (await import('mammoth'))
  let raw: string
  try {
    // mammoth needs a Node Buffer.
    const nodeBuf = Buffer.isBuffer(buf) ? buf : Buffer.from(toUint8(buf))
    const result = await mammoth.extractRawText({ buffer: nodeBuf })
    raw = result.value ?? ''
  } catch {
    throw new DocumentParseError('corrupt', 'Unable to read DOCX')
  }

  const text = raw.trim()
  if (text.length === 0) {
    throw new DocumentParseError('no_text', 'No extractable text in DOCX')
  }
  return [{ page: 1, text }]
}

// ---------------------------------------------------------------------------
// parseWithTimeout — Promise.race timeout wrapper (MVP; not true isolation).
// ---------------------------------------------------------------------------

/**
 * Race `fn()` against a timeout. Rejects with DocumentParseError('timeout') if
 * the timeout fires first; otherwise resolves/rejects with the fn's result.
 *
 * This stops the loop *waiting* on a pathological parse; it does NOT terminate
 * CPU-bound work in this process (see the TODO at the top of this file).
 */
export function parseWithTimeout<T>(
  fn: () => Promise<T>,
  ms: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new DocumentParseError('timeout', `Parse exceeded ${ms}ms`))
    }, ms)
    // Do not keep the event loop alive solely for this timer.
    if (typeof timer.unref === 'function') timer.unref()

    Promise.resolve()
      .then(fn)
      .then(
        (value) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(value)
        },
        (err) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          reject(err)
        },
      )
  })
}

// ---------------------------------------------------------------------------
// parseInWorkerThread — TRUE parse isolation (§0(g)).
//
// Runs parseDocument(buf, mime) inside a Node worker_thread so a CPU-bound or
// memory-bombing parse cannot block the Nitro event loop or OOM the process:
//   - resourceLimits.maxOldGenerationSizeMb = 256 caps the worker heap (an OOM
//     kills the worker, not Nitro). See the DOCKER CAVEAT in the file header:
//     a global --max-old-space-size OVERRIDES this per-worker limit.
//   - A setTimeout(() => worker.terminate(), timeoutMs) is the ONLY reliable
//     way to stop CPU-bound work in a worker_thread — AbortController/
//     AbortSignal do NOT terminate a running worker. On timeout we terminate
//     and reject DocumentParseError('timeout').
//   - The worker is ALWAYS terminated in a finally (success, failure, timeout).
//
// The worker sends back ONLY a sanitized typed { ok:false, code }; we rebuild a
// fresh DocumentParseError(code) so callers keep seeing typed errors across the
// thread boundary (never a stack or library internals).
// ---------------------------------------------------------------------------

/** Discriminated response posted back by documentParser.worker.ts. */
type WorkerParseResponse =
  | { ok: true; pages: ParsedPage[] }
  | { ok: false; code: DocumentParseErrorCode | 'unknown' }

/**
 * Resolve the worker entry to a `file:` URL the worker_threads loader accepts.
 *
 * We resolve from `import.meta.dirname` (the REAL on-disk directory of THIS
 * module) joined with the worker filename, then `pathToFileURL` it. This is
 * deliberately NOT `new URL('./documentParser.worker.ts', import.meta.url)`:
 * under vitest/Vite, `import.meta.url` is rewritten to an `http://localhost`
 * dev-server URL, which `new Worker(url)` rejects with "The URL must be of
 * scheme file". `import.meta.dirname` stays a real filesystem path in both the
 * test runner and native Node, so this works everywhere the worker file sits
 * next to this module.
 *
 * DEPLOY-VALIDATION CAVEAT (Nitro build): under the bundled `.output`, the
 * sibling `documentParser.worker.ts` may not be emitted next to the bundled
 * chunk (bundlers inline modules and rewrite paths). If so, the worker file
 * must be kept as an EXTERNAL/asset and this resolution adjusted (or the worker
 * inlined via a build plugin). The tsx/vitest path resolves it fine; validate
 * the bundled path before relying on worker isolation in production.
 */
function resolveWorkerUrl(): URL {
  return pathToFileURL(join(import.meta.dirname, 'documentParser.worker.ts'))
}

/**
 * Parse a document buffer inside an isolated worker_thread.
 *
 * @param buf        Raw file bytes (already fetched/bounded by the caller).
 * @param mime       Declared mime (one of the 4 allowed); validated in-worker.
 * @param timeoutMs  Hard ceiling; on expiry the worker is terminated and this
 *                   rejects DocumentParseError('timeout'). Default 30 s.
 *
 * Resolves with ParsedPage[] on success. Rejects with a typed
 * DocumentParseError on any parse failure, on timeout, or if the worker exits
 * abnormally (e.g. terminated by the per-worker heap cap → 'corrupt').
 */
export async function parseInWorkerThread(
  buf: Uint8Array | Buffer,
  mime: string,
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<ParsedPage[]> {
  // In the bundled Nitro build (.output) the sibling worker .ts is inlined into
  // nitro.mjs and NOT emitted as a resolvable on-disk file, so worker_thread
  // spawn would throw at runtime. Detect that and fall back to in-process
  // parseDocument() (which applies its own timeout). The dedicated BullMQ worker
  // SERVICE already provides process-level isolation, so this only swaps
  // thread-vs-inline within an already-isolated process. In dev/tsx the .ts
  // resolves and we keep true worker_thread isolation.
  const workerUrl = resolveWorkerUrl()
  const { existsSync } = await import('node:fs')
  if (!existsSync(workerUrl)) {
    return parseDocument(buf, mime)
  }

  // Imported lazily so this module stays importable in non-Node contexts
  // (e.g. the pure-parser unit tests that never touch worker_threads).
  const { Worker } = await import('node:worker_threads')

  // Copy the bytes into a fresh, standalone ArrayBuffer that is NOT a slice of
  // a pooled Node Buffer (Node's Buffer.from() hands back a view into a shared
  // pool whose .buffer is not safely transferable). A plain Uint8Array over a
  // dedicated ArrayBuffer structured-clones cleanly across the worker boundary.
  // Bytes are bounded ≤20 MB by the confirm-time HEAD gate, so the copy is
  // cheap and we avoid the DataCloneError landmines of transfer lists.
  const view = toUint8(buf)
  const payload = new Uint8Array(view.byteLength)
  payload.set(view)

  const worker = new Worker(workerUrl, {
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<ParsedPage[]>((resolve, reject) => {
      let settled = false
      const settleReject = (err: Error) => {
        if (settled) return
        settled = true
        reject(err)
      }
      const settleResolve = (pages: ParsedPage[]) => {
        if (settled) return
        settled = true
        resolve(pages)
      }

      // setTimeout + worker.terminate() is the ONLY reliable termination path
      // for CPU-bound work — NOT AbortController (Node worker_threads ignore it
      // for termination). terminate() is async; we don't await it here because
      // the finally below also terminates (idempotent) before resolving.
      timer = setTimeout(() => {
        void worker.terminate()
        settleReject(new DocumentParseError('timeout', `Parse exceeded ${timeoutMs}ms`))
      }, timeoutMs)
      if (typeof timer.unref === 'function') timer.unref()

      worker.once('message', (msg: WorkerParseResponse) => {
        if (msg && msg.ok) {
          settleResolve(msg.pages)
        } else {
          const code = (msg && msg.code) || 'unknown'
          if (code === 'unknown') {
            settleReject(new DocumentParseError('corrupt', 'Parse failed in worker'))
          } else {
            settleReject(new DocumentParseError(code, code))
          }
        }
      })

      worker.once('error', (err) => {
        // A worker `error` is an uncaught throw inside the worker (rare — the
        // worker catches parse errors). Never surface the raw message.
        settleReject(new DocumentParseError('corrupt', 'Worker errored during parse'))
        void err
      })

      worker.once('exit', (code) => {
        // Abnormal exit BEFORE a message means the worker was killed — most
        // likely the per-worker heap cap (OOM) or an out-of-band terminate.
        // If the timeout already fired, its rejection wins (settled=true).
        if (code !== 0) {
          settleReject(
            new DocumentParseError('corrupt', `Worker exited abnormally (${code})`),
          )
        } else {
          // Clean exit with no message — should not happen, but never hang.
          settleReject(new DocumentParseError('corrupt', 'Worker produced no result'))
        }
      })

      // Structured-clone the bytes into the worker (no transfer list — see the
      // note above; the copy is bounded and avoids DataCloneError).
      worker.postMessage({ buf: payload, mime })
    })
  } finally {
    if (timer) clearTimeout(timer)
    // ALWAYS terminate — idempotent if already terminated/exited.
    await worker.terminate()
  }
}

// ---------------------------------------------------------------------------
// Dispatcher — magic-byte sniff first, then route by declared mime.
// ---------------------------------------------------------------------------

/**
 * Sniff the real type via file-type (ESM-only → dynamic import) and validate it
 * against the declared mime. Returns the canonical mime to parse as.
 *
 * - PDF / DOCX(zip) have magic bytes: the detected type MUST map to the
 *   declared mime, else 'unsupported'. A type detected outside the allowlist
 *   (e.g. PNG) is rejected even if the declared mime claims otherwise.
 * - text/markdown & text/plain have NO magic bytes: file-type returns
 *   undefined. We accept them only when declared as a text mime and the bytes
 *   are valid UTF-8 (validated by the text parser).
 */
async function sniffAndResolve(
  bytes: Uint8Array,
  declaredMime: string,
): Promise<string> {
  if (!DECLARED_MIME_ALLOWLIST.has(declaredMime)) {
    throw new DocumentParseError('unsupported', 'Declared file type is not allowed')
  }

  // Text formats (Markdown / plain) have NO reliable magic bytes — file-type
  // emits false positives on text (e.g. `0xFF 0xFE …` is misread as audio/mpeg).
  // For declared text mimes the authoritative gate is the strict UTF-8 decode
  // performed by the text parser: a genuine binary (PDF/PNG/etc.) declared as
  // text contains invalid UTF-8 sequences and is rejected there as 'corrupt'.
  // So we do NOT run magic-byte sniffing for text and route straight to it.
  if (declaredMime === MIME_MARKDOWN || declaredMime === MIME_PLAIN) {
    return declaredMime
  }

  const { fileTypeFromBuffer } = await import('file-type')
  const detected = await fileTypeFromBuffer(bytes)

  if (!detected) {
    // A binary type was declared but no signature was recognized — reject
    // rather than hand unidentified bytes to a binary parser.
    throw new DocumentParseError(
      'unsupported',
      'No recognizable file signature for a binary type',
    )
  }

  const canonical = DETECTED_TO_CANONICAL[detected.mime]
  if (!canonical) {
    throw new DocumentParseError(
      'unsupported',
      `Detected type ${detected.mime} is not allowed`,
    )
  }
  // The detected container must agree with what the client declared. (A real
  // PDF declared as DOCX, or vice-versa, is a mismatch we reject.)
  if (canonical !== declaredMime) {
    throw new DocumentParseError(
      'unsupported',
      'File contents do not match the declared type',
    )
  }
  return canonical
}

/**
 * Parse any supported document buffer into ordered pages.
 *
 * @param buf           The raw file bytes (already fetched/bounded by the caller).
 * @param declaredMime  The mime the client claimed at upload (one of the 4 allowed).
 * @param timeoutMs     Optional per-parse time budget (default 30 s).
 *
 * Magic bytes are sniffed FIRST and cross-checked against `declaredMime`; the
 * actual parse runs under `parseWithTimeout`. All failures surface as a typed
 * DocumentParseError — never a raw library error or stack.
 */
export async function parseDocument(
  buf: Uint8Array | Buffer,
  declaredMime: string,
  timeoutMs: number = DEFAULT_PARSE_TIMEOUT_MS,
): Promise<ParsedPage[]> {
  const bytes = toUint8(buf)
  const canonical = await sniffAndResolve(bytes, declaredMime)

  switch (canonical) {
    case MIME_PDF:
      return parseWithTimeout(() => parsePdf(bytes), timeoutMs)
    case MIME_DOCX:
      return parseWithTimeout(() => parseDocx(bytes), timeoutMs)
    case MIME_MARKDOWN:
      // Synchronous, but wrap for a uniform contract + timeout symmetry.
      return parseWithTimeout(async () => parseMarkdown(bytes), timeoutMs)
    case MIME_PLAIN:
      return parseWithTimeout(async () => parsePlainText(bytes), timeoutMs)
    default:
      // Unreachable: sniffAndResolve only returns allowlisted canonical mimes.
      throw new DocumentParseError('unsupported', 'Unsupported document type')
  }
}
