# Embedding Performance Benchmarks (AER-8)

This document describes how to measure embedding latency / throughput
across the three NeuroCanvas runtimes:

| Runtime              | Code path                                              | Acceleration              |
|----------------------|--------------------------------------------------------|---------------------------|
| Web — WebGPU         | `app/workers/ai.worker.ts`                             | navigator.gpu             |
| Web — WASM           | `app/workers/ai.worker.ts` (fallback)                  | WASM SIMD + threads       |
| Tauri — CoreML       | `src-tauri/src/ml/embedding.rs` (macOS, full model)    | Apple Neural Engine + GPU |
| Tauri — CPU          | `src-tauri/src/ml/embedding.rs` (quantized + everyone) | ORT CPU intra-threads     |
| Tauri — DirectML     | `src-tauri/src/ml/embedding.rs` (Windows)              | DX12 GPU                  |
| Server — CPU         | `server/utils/embeddings.ts`                           | ORT Node CPU              |

All paths produce a **256-dimensional L2-normalised Matryoshka embedding**
from `nomic-ai/nomic-embed-text-v1.5`. The schema is `vector(256)` with
HNSW cosine; no runtime is allowed to drift from this dim. The Rust
boundary asserts it; the worker asserts it; the server asserts it.

## Telemetry shape

Every runtime emits a structured log line on each embed call. The field
names are identical so a single regex extracts them all:

```
runtime, op, duration_ms, dimensions, batch_size, dtype?
```

| Runtime | Channel             | Example line                                                                                  |
|---------|---------------------|-----------------------------------------------------------------------------------------------|
| Web     | `console.info`      | `[ai-worker-telemetry] {"op":"batchEmbed","duration_ms":48.2,"runtime":"webgpu","dtype":"q4f16","dimensions":256,"batch_size":32}` |
| Tauri   | `tracing::info!`    | `INFO ml: embed_batch duration_ms="12.4" runtime="tauri-coreml" dimensions=256 batch_size=32` |
| Server  | `console.log`       | `[embeddings-telemetry] {"op":"embed","duration_ms":92.5,"runtime":"server-cpu","dimensions":256,"batch_size":1,"prefix":"document"}` |

To collect numbers, just run each surface against real workloads and grep
for the prefix. No analytics dependency, no extra ports.

## Measurement protocol

These numbers should be filled in by the operator on their target hardware.
Run each section in a clean tab / shell — first call is always model-load
dominated, so we discard it and measure the second through Nth call.

### 1. Web (WebGPU + WASM)

```bash
# Start the dev server
pnpm dev

# Open the app at http://localhost:3000, open DevTools → Console
# Then run in the console:

const w = new Worker('/_nuxt/app/workers/ai.worker.ts?worker_file', { type: 'module' })
let nextId = 0
const send = (type, payload) => new Promise(r => {
  const id = String(++nextId)
  const onMsg = (e) => { if (e.data.id === id && e.data.type !== 'progress') { w.removeEventListener('message', onMsg); r(e.data.payload) } }
  w.addEventListener('message', onMsg)
  w.postMessage({ id, type, payload })
})

// Warm-up
await send('init', {})
await send('embed', { texts: ['warmup'] })

// Single embed — p50/p95 over 50 runs
const single = []
for (let i = 0; i < 50; i++) {
  const t = performance.now()
  await send('embed', { texts: [`benchmark sentence number ${i}`] })
  single.push(performance.now() - t)
}
single.sort((a, b) => a - b)
console.log('single p50', single[25].toFixed(2), 'p95', single[Math.floor(0.95 * single.length)].toFixed(2))

// Batch of 32 — p50/p95 over 20 runs
const batch = []
const texts = Array.from({ length: 32 }, (_, i) => ({ id: String(i), text: `batch sentence ${i}` }))
for (let i = 0; i < 20; i++) {
  const t = performance.now()
  await send('embed-batch', { texts, batchSize: 32 })
  batch.push(performance.now() - t)
}
batch.sort((a, b) => a - b)
console.log('batch32 p50', batch[10].toFixed(2), 'p95', batch[Math.floor(0.95 * batch.length)].toFixed(2))
```

To force WASM (to compare): in the worker, temporarily set
`hasWebGPU = false` after `checkWebGPU()` returns. Or run in a browser
without `navigator.gpu` (Firefox stable).

### 2. Tauri (CoreML + CPU on macOS, DirectML on Windows)

```bash
# Build + run the desktop app
cd src-tauri
cargo run --release

# In another shell, tail the structured logs:
RUST_LOG=neurocanvas=info,ort=warn cargo run --release 2>&1 | grep "ml: embed"
```

Then drive the app: open a map, run semantic search, hit Auto-Connect on a
batch of nodes. The `[ml: embed]` / `[ml: embed_batch]` lines include
`duration_ms` and `runtime` (which will be `tauri-coreml` on macOS full
model, `tauri-cpu` on the bundled quantized variant, `tauri-directml` on
Windows).

For a microbench without the app:

```bash
cd src-tauri
# Bundled quantized model required: pnpm fetch-onnx-model
cargo test --release --lib ml::embedding -- --nocapture
```

The two unit tests load the bundled model and call `embed()` /
`embed_batch()` once each — the telemetry line shows the wall time.

### 3. Server (Node CPU)

```bash
# Local dev or production node
RUN_PARITY_TEST=1 npx vitest run server/utils/__tests__/embeddings-parity.test.ts
# tail the [embeddings-telemetry] lines

# Or hit /api/embeddings with text and read the log line:
curl -X POST http://localhost:3000/api/embeddings \
  -H 'Content-Type: application/json' \
  -b "neurocanvas.session-token=$JWT" \
  -d '{"mapId":"...","embeddings":[{"nodeId":"x","text":"benchmark"}]}'
```

## Results table

Fill in on your machine — leave `TBD` where you haven't measured yet.

| Runtime              | Single embed p50 | Single embed p95 | Batch-of-32 p50 | Batch-of-32 p95 | Notes                                |
|----------------------|------------------|------------------|-----------------|-----------------|--------------------------------------|
| Web WebGPU (q4f16)   | TBD              | TBD              | TBD             | TBD             | M-series Mac, Chrome 120+            |
| Web WebGPU (q8)      | TBD              | TBD              | TBD             | TBD             | fallback if q4f16 not published      |
| Web WASM (q8)        | TBD              | TBD              | TBD             | TBD             | Firefox stable or Chrome --no-gpu    |
| Tauri CoreML (full)  | TBD              | TBD              | TBD             | TBD             | M-series Mac, full-precision model   |
| Tauri CPU (quantized)| TBD              | TBD              | TBD             | TBD             | Bundled default — should be < 10ms   |
| Tauri DirectML       | TBD              | TBD              | TBD             | TBD             | Windows 11, DX12-capable GPU         |
| Server Node CPU      | TBD              | TBD              | TBD             | TBD             | Railway prod or local                |

## Cross-surface parity verification

Cosine similarity between same-input embeddings from different surfaces
MUST be ≥ 0.999. Run:

```bash
# 1. Capture web output (DevTools console after init):
#    JSON.stringify(await send('embed', { texts: ['the quick brown fox'] }))
#    → save to scripts/fixtures/web.json (shape: { embeddings: [[...]] })

# 2. Capture Tauri output (in the Tauri devtools console):
#    JSON.stringify(await window.__TAURI__.invoke('ml_embed', { text: 'the quick brown fox' }))
#    → save to scripts/fixtures/tauri.json (shape: { embedding: [...] })

# 3. Capture server output:
#    curl -X POST http://localhost:3000/api/embeddings \
#         -H 'Content-Type: application/json' \
#         -d '{"text":"the quick brown fox"}' \
#       | jq '.embedding' > scripts/fixtures/server.json

# 4. Compare:
node scripts/aer8-cross-parity.mjs scripts/fixtures/web.json scripts/fixtures/tauri.json scripts/fixtures/server.json
```

The script asserts pairwise cosine ≥ 0.999 and exits non-zero on failure.
See `scripts/aer8-cross-parity.mjs` for the implementation.

## Why these specific targets

- **Single-embed p50 < 100 ms** on the dominant runtime: anything slower
  is perceptible on first-keystroke search.
- **Batch-of-32 ≤ 10x single-embed**: validates that batching is actually
  saturating the device (true batching → near-constant per-item cost up
  to GPU memory limits).
- **Cross-surface cosine ≥ 0.999**: same input from different runtimes
  must land in the same pgvector neighbourhood, or HNSW search misses
  rows depending on which device wrote them.

## When numbers regress

If any of these get measurably worse:

1. Check the device/dtype log line — did WebGPU silently fall back to
   WASM? Did CoreML fail to register and drop to CPU?
2. Check the dtype — q4f16 should be small enough to be download-bound on
   first launch, then dominated by GPU dispatch; if duration drops once
   the model is cached but stays high after that, the dtype selection
   regressed.
3. For Tauri, confirm pre-warm fired: look for `ml: preload complete`
   in the launch logs. If preload silently failed, the first IPC pays
   the full cold-start cost.
4. For Web, confirm `useAIPreload()` ran by searching for
   `[ai-worker] device=…` in the console after a fresh tab load.
