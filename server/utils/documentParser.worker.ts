// ---------------------------------------------------------------------------
// Document parser worker_thread entry (§0(g) — true parse isolation).
//
// See docs/architecture/document-rag-implementation-plan.md §0(g) and the
// TODO(P4-GA) note that previously lived atop documentParser.ts.
//
// This module is the ENTRY POINT for a Node worker_thread spawned by
// parseInWorkerThread() in documentParser.ts. It exists so a CPU-bound or
// memory-bombing document parse runs in an isolated V8 isolate that:
//   - has its own heap capped via the spawning side's
//     resourceLimits.maxOldGenerationSizeMb = 256 (an OOM kills the worker,
//     not the Nitro process), and
//   - can be hard-terminated by the parent via worker.terminate() when a
//     setTimeout fires — the ONLY reliable way to stop CPU-bound work in a
//     Node worker_thread. AbortController/AbortSignal does NOT terminate a
//     running worker (Node does not honor it for thread termination), which is
//     exactly why the parent uses setTimeout + terminate, not an AbortSignal.
//
// Protocol (kept deliberately tiny so the structured-clone boundary is cheap):
//   IN  (via parentPort.once('message')): { buf: ArrayBuffer | Uint8Array,
//                                           mime: string }
//   OUT (via parentPort.postMessage):
//        { ok: true,  pages: ParsedPage[] }              — success
//        { ok: false, code: DocumentParseErrorCode | 'unknown' } — failure
//
// We send ONLY a sanitized `code` on failure — never a stack, an R2 key, or a
// raw library error — mirroring the sanitization contract in
// documentIngestion.ts. The parent re-throws a fresh DocumentParseError(code)
// so callers keep seeing typed errors across the thread boundary.
//
// IMPORTANT (Nitro build caveat): this file is resolved by the parent via
// `new URL('./documentParser.worker.ts', import.meta.url)`. Under tsx/vitest the
// `.ts` resolves and Node's native type-stripping runs it directly. Under the
// bundled Nitro `.output`, the relative worker path may not survive bundling —
// see the deploy-validation note in documentParser.ts (parseInWorkerThread).
// ---------------------------------------------------------------------------

import { parentPort } from 'node:worker_threads'
// NOTE the explicit `.ts` extension: this file is executed as a Node
// worker_thread entry under native type-stripping, where ESM resolution is
// STRICT — an extensionless relative import ('./documentParser') throws
// ERR_MODULE_NOT_FOUND. The `.ts` specifier resolves both under Node's
// type-stripping loader and under tsconfig `moduleResolution: Bundler`. (This
// file is never imported by Vite/vitest — only spawned via new Worker(url) —
// so the unusual extension does not affect the main module graph.)
import {
  parseDocument,
  DocumentParseError,
  type DocumentParseErrorCode,
  type ParsedPage,
} from './documentParser.ts'

/** Inbound message shape from parseInWorkerThread(). */
interface ParseRequest {
  buf: ArrayBuffer | Uint8Array
  mime: string
}

/** Outbound message shape — discriminated on `ok`. */
type ParseResponse =
  | { ok: true; pages: ParsedPage[] }
  | { ok: false; code: DocumentParseErrorCode | 'unknown' }

if (!parentPort) {
  // Defensive: this file is ONLY meaningful as a worker_thread entry. If it is
  // ever imported on the main thread, do nothing rather than crash.
  throw new Error('documentParser.worker.ts must run as a worker_thread')
}

const port = parentPort

// Coerce whatever the structured-clone gave us back into a Uint8Array view.
// We post the buffer as a transferable ArrayBuffer from the parent; an
// ArrayBuffer arrives as ArrayBuffer, a Uint8Array as Uint8Array.
function toUint8(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf)
}

// Handle exactly one request, then let the worker idle until the parent
// terminates it (the parent ALWAYS terminates in a finally). We do NOT
// process.exit() ourselves so the parent stays in control of the lifecycle.
port.once('message', async (msg: ParseRequest) => {
  try {
    const bytes = toUint8(msg.buf)
    const pages = await parseDocument(bytes, msg.mime)
    const response: ParseResponse = { ok: true, pages }
    port.postMessage(response)
  } catch (err) {
    // Sanitize: only a typed code crosses the boundary — never a stack or
    // library internals. Unknown errors collapse to 'unknown'.
    const code: DocumentParseErrorCode | 'unknown' =
      err instanceof DocumentParseError ? err.code : 'unknown'
    const response: ParseResponse = { ok: false, code }
    port.postMessage(response)
  }
})
