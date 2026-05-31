#!/usr/bin/env node
/**
 * fetch-onnx-model.mjs — AER-12
 *
 * Downloads the `nomic-ai/nomic-embed-text-v1.5` ONNX assets that the Tauri
 * desktop binary bundles as resources. Runs as a precondition to
 * `pnpm tauri:build` so a fresh checkout / CI worker / new contributor can
 * build the desktop app without manually wrangling 137MB of model bytes.
 *
 * Design choices
 * ──────────────
 * - **Quantized variant only by default**: the bundled artefact is the int8
 *   `model_quantized.onnx` (137 MB). Full-precision (547 MB) and q4f16
 *   (111 MB) are NOT bundled — full-precision is downloaded on demand at
 *   runtime via `ml_download_full_model` (see `src-tauri/src/ml/model_manager.rs`).
 *   Rationale:
 *     * The Rust resolver `resolve_bundled_model()` in model_manager.rs
 *       hard-codes the filename `model_quantized.onnx`. Renaming the bundle
 *       to q4f16 would silently break the resolver.
 *     * ORT-CPU's op coverage for q4f16 weight types is incomplete on
 *       Linux/Windows targets (DirectML EP is the only path that benefits);
 *       on the dominant macOS-CPU + Windows-CPU mix, int8 outperforms
 *       q4f16 by 15–25% per-token while being only 26 MB larger.
 *     * Bundle-size win from q4f16 (~26 MB) is dwarfed by the installer's
 *       webview2 bootstrap on Windows and is invisible on macOS app
 *       bundle compression.
 * - **Idempotent**: HEAD-check `Content-Length` against on-disk file size,
 *   skip if matched, re-download if mismatched OR `--force` passed.
 * - **Retries with exponential backoff** on transient network errors.
 * - **Exit non-zero** on any required file failure so CI fails loudly.
 * - **Progress logging**: percent + filename per download chunk batch.
 *
 * Usage
 * ─────
 *     pnpm fetch-onnx-model            # idempotent — skips files that match
 *     pnpm fetch-onnx-model -- --force # re-download everything
 *     pnpm fetch-onnx-model -- --variant=q4f16  # opt-in to q4f16 (dev only)
 *
 * Files written to `src-tauri/resources/models/nomic-embed-text-v1.5/`:
 *
 *     config.json              ~2.5 KB
 *     tokenizer.json           ~711 KB
 *     tokenizer_config.json    ~1.2 KB
 *     special_tokens_map.json  ~700 B
 *     model_quantized.onnx     ~137 MB     (the bundled inference graph)
 */

import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import process from 'node:process'

// ── Constants ────────────────────────────────────────────────────────────

const HF_BASE = 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/resolve/main'
const TARGET_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src-tauri',
  'resources',
  'models',
  'nomic-embed-text-v1.5'
)

/**
 * Files that ALL builds need (tokenizer + config + the bundled model).
 * Each entry is `[remotePath, localFilename]`.
 *
 * The Rust side (`src-tauri/src/ml/embedding.rs`) looks for the model file
 * named exactly `model_quantized.onnx` and the tokenizer at `tokenizer.json`.
 * If you change a localFilename here, update the resolver in
 * `src-tauri/src/ml/model_manager.rs` in the same commit.
 */
const REQUIRED_FILES = /** @type {const} */ ([
  ['config.json', 'config.json'],
  ['tokenizer.json', 'tokenizer.json'],
  ['tokenizer_config.json', 'tokenizer_config.json'],
  ['special_tokens_map.json', 'special_tokens_map.json'],
  ['onnx/model_quantized.onnx', 'model_quantized.onnx'],
])

/**
 * Optional variants — fetched only when `--variant=<name>` is passed. Useful
 * for benchmarking q4f16 / fp16 locally without bloating the bundled
 * installer. None of these are referenced by the Rust resolver, so they
 * stay out of `bundle.resources` in tauri.conf.json.
 */
const OPTIONAL_VARIANTS = /** @type {const} */ ({
  q4f16: ['onnx/model_q4f16.onnx', 'model_q4f16.onnx'],
  fp16: ['onnx/model_fp16.onnx', 'model_fp16.onnx'],
  full: ['onnx/model.onnx', 'model.onnx'],
})

const MAX_RETRIES = 4
const INITIAL_BACKOFF_MS = 1500
const PROGRESS_STEP = 10 // log a line every 10% of file progress

// ── Args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const force = args.includes('--force')
const variantArg = args.find((a) => a.startsWith('--variant='))
const requestedVariant = variantArg ? variantArg.slice('--variant='.length) : null

if (requestedVariant && !(requestedVariant in OPTIONAL_VARIANTS)) {
  console.error(
    `[fetch-onnx-model] unknown --variant=${requestedVariant} (valid: ${Object.keys(OPTIONAL_VARIANTS).join(', ')})`
  )
  process.exit(2)
}

// ── Helpers ──────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fmtMB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

/**
 * Discover the remote file's byte size.
 *
 * The HuggingFace resolver returns 307 → `/api/resolve-cache/...` for files
 * served from their CDN cache layer. The big ONNX bytes preserve a
 * `Content-Length` header on HEAD, but small JSON files (config.json,
 * tokenizer.json, …) get served with chunked transfer-encoding so HEAD
 * returns `Content-Length: null`. For those we fall back to a
 * `GET Range: bytes=0-0` — the response carries `Content-Range: bytes 0-0/<total>`
 * which gives us the canonical size in a single round-trip without
 * downloading the body.
 *
 * Returns the size in bytes. Throws if neither path yields a usable number.
 */
async function remoteSize(url) {
  const headRes = await fetch(url, { method: 'HEAD', redirect: 'follow' })
  if (!headRes.ok) {
    throw new Error(`HEAD ${url} → ${headRes.status} ${headRes.statusText}`)
  }
  const headLen = headRes.headers.get('content-length')
  const headParsed = headLen ? Number.parseInt(headLen, 10) : NaN
  if (Number.isFinite(headParsed) && headParsed > 0) {
    return headParsed
  }

  // Fallback: 1-byte Range GET. The server returns 206 Partial Content with
  // `Content-Range: bytes <start>-<end>/<total>` — parse the total.
  const rangeRes = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { Range: 'bytes=0-0' },
  })
  // Always drain/close the body so we don't leak the socket.
  try {
    if (!rangeRes.ok && rangeRes.status !== 206) {
      throw new Error(`Range-GET ${url} → ${rangeRes.status} ${rangeRes.statusText}`)
    }
    const cr = rangeRes.headers.get('content-range') // e.g. "bytes 0-0/2538"
    if (cr) {
      const m = /\/(\d+)$/.exec(cr)
      if (m) {
        const total = Number.parseInt(m[1], 10)
        if (Number.isFinite(total) && total > 0) return total
      }
    }
    // Some CDN paths still return CL on a 200 (non-Range) response.
    const cl = rangeRes.headers.get('content-length')
    if (cl) {
      const n = Number.parseInt(cl, 10)
      if (Number.isFinite(n) && n > 0) return n
    }
    throw new Error(`Range-GET ${url} → cannot derive size (content-range=${cr}, content-length=${cl})`)
  } finally {
    // @ts-ignore — body may be null on 304/204
    await rangeRes.body?.cancel?.()
  }
}

/**
 * Download `url` → `destPath` with progress logging. Streams to disk to
 * avoid loading the whole 137MB into memory.
 *
 * Returns the number of bytes written. Caller verifies this matches the
 * expected remote size; mismatch triggers a retry.
 */
async function downloadStreaming(url, destPath, expectedBytes, label) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  }
  if (!res.body) {
    throw new Error(`GET ${url} → no response body`)
  }

  // Wrap the web ReadableStream so we can drip-feed progress to console
  // without buffering the whole payload.
  let received = 0
  let lastReportedPct = -PROGRESS_STEP
  const reader = res.body.getReader()
  const out = createWriteStream(destPath)

  const progressStream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        controller.close()
        return
      }
      received += value.byteLength
      if (expectedBytes > 0) {
        const pct = Math.floor((received / expectedBytes) * 100)
        if (pct >= lastReportedPct + PROGRESS_STEP) {
          lastReportedPct = pct
          // Carriage-return so a TTY repaints the same line; in CI logs
          // the lines stack up which is also fine (and grep-friendly).
          const isTty = process.stdout.isTTY
          const prefix = `[fetch-onnx-model] ${label}`
          if (isTty) {
            process.stdout.write(`\r${prefix}: ${pct}% (${fmtMB(received)} / ${fmtMB(expectedBytes)})`)
          } else {
            console.log(`${prefix}: ${pct}% (${fmtMB(received)} / ${fmtMB(expectedBytes)})`)
          }
        }
      }
      controller.enqueue(value)
    },
    cancel() {
      reader.cancel()
    },
  })

  // pipeline() handles backpressure + cleans up file handle on error.
  // @ts-expect-error — web stream → node writable interop is well-supported
  // in Node 18+ but the type defs are still catching up.
  await pipeline(progressStream, out)

  if (process.stdout.isTTY) process.stdout.write('\n')
  return received
}

/**
 * Resolve a single file: HEAD for expected size, skip if local matches,
 * otherwise download with retries. Returns `{ skipped, downloadedBytes }`
 * for the summary.
 */
async function fetchFile(remote, local) {
  const url = `${HF_BASE}/${remote}`
  const destPath = join(TARGET_DIR, local)
  const label = local

  const expectedBytes = await remoteSize(url)

  // Idempotency check: skip when on-disk size already matches remote.
  if (!force && existsSync(destPath)) {
    const localBytes = statSync(destPath).size
    if (localBytes === expectedBytes) {
      console.log(`[fetch-onnx-model] skip ${label} (${fmtMB(expectedBytes)}, already matches remote)`)
      return { skipped: true, downloadedBytes: 0 }
    }
    console.log(
      `[fetch-onnx-model] ${label} size mismatch (local=${fmtMB(localBytes)}, remote=${fmtMB(expectedBytes)}) — re-downloading`
    )
    // Remove the partial/stale file before re-download so an in-progress
    // failure can't be mistaken for a successful download next time.
    unlinkSync(destPath)
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[fetch-onnx-model] ${label}: GET (attempt ${attempt}/${MAX_RETRIES}, ${fmtMB(expectedBytes)})`)
      const received = await downloadStreaming(url, destPath, expectedBytes, label)
      if (received !== expectedBytes) {
        // Treat as a recoverable error so the retry loop kicks in.
        throw new Error(`size mismatch after download: wrote ${received} bytes, expected ${expectedBytes}`)
      }
      console.log(`[fetch-onnx-model] ok   ${label} (${fmtMB(received)})`)
      return { skipped: false, downloadedBytes: received }
    } catch (err) {
      // Clean up the partial file so a future idempotency check doesn't
      // accept a truncated download.
      if (existsSync(destPath)) {
        try {
          unlinkSync(destPath)
        } catch (cleanupErr) {
          console.warn(`[fetch-onnx-model] cleanup failed for ${destPath}: ${cleanupErr.message}`)
        }
      }
      if (attempt === MAX_RETRIES) {
        throw new Error(`${label}: gave up after ${MAX_RETRIES} attempts: ${err.message}`)
      }
      const backoff = INITIAL_BACKOFF_MS * 2 ** (attempt - 1)
      console.warn(`[fetch-onnx-model] ${label}: attempt ${attempt} failed (${err.message}); retrying in ${backoff}ms`)
      await sleep(backoff)
    }
  }
  // Unreachable — the loop either returns or throws.
  throw new Error(`${label}: unreachable retry exit`)
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[fetch-onnx-model] target: ${TARGET_DIR}`)
  if (force) console.log('[fetch-onnx-model] --force passed; will re-download all files')

  mkdirSync(TARGET_DIR, { recursive: true })

  // Required files first — if any of these fail, the build can't succeed,
  // so we want them surfaced before we burn time on optional variants.
  /** @type {Array<readonly [string, string]>} */
  const queue = [...REQUIRED_FILES]

  if (requestedVariant) {
    queue.push(OPTIONAL_VARIANTS[requestedVariant])
    console.log(`[fetch-onnx-model] also fetching optional variant: ${requestedVariant}`)
  }

  let totalDownloaded = 0
  let totalSkipped = 0

  for (const [remote, local] of queue) {
    const { skipped, downloadedBytes } = await fetchFile(remote, local)
    if (skipped) totalSkipped++
    totalDownloaded += downloadedBytes
  }

  console.log(
    `[fetch-onnx-model] done: ${queue.length - totalSkipped} downloaded, ${totalSkipped} skipped, ${fmtMB(totalDownloaded)} transferred`
  )
}

main().catch((err) => {
  console.error(`[fetch-onnx-model] FATAL: ${err.message}`)
  if (err.stack) console.error(err.stack)
  process.exit(1)
})
