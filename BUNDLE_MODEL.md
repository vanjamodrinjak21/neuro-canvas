# Bundled ONNX Embedding Model (AER-12)

The Tauri desktop binary ships with a pre-quantised
[`nomic-ai/nomic-embed-text-v1.5`](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
ONNX graph so semantic search and Auto-Connect work fully offline on the
very first launch — no first-run "downloading model…" wall.

This document covers: which files are bundled, why, how to refresh them,
and what the size / accuracy trade-offs look like.

## What ships in the installer

`src-tauri/tauri.conf.json` → `bundle.resources` includes:

| File                          | Size      | Purpose                                              |
|-------------------------------|-----------|------------------------------------------------------|
| `model_quantized.onnx`        | ~137 MB   | Int8-quantised inference graph (the actual model)    |
| `tokenizer.json`              | ~711 KB   | HuggingFace fast tokenizer (vocab + merges)          |
| `tokenizer_config.json`       | ~1.2 KB   | Tokenizer init metadata                              |
| `special_tokens_map.json`     | ~700 B    | CLS / SEP / PAD / MASK token IDs                     |
| `config.json`                 | ~2.5 KB   | Model hyperparameters (hidden dim, layers, …)        |
| **Total bundled**             | **~138 MB** | Lands in the Tauri `$RESOURCES` dir at install time |

All five files are fetched into
`src-tauri/resources/models/nomic-embed-text-v1.5/` by
`scripts/fetch-onnx-model.mjs`, which runs automatically before every
`pnpm tauri:build*` script.

## Installer-size delta

| Build                                  | Approx installer size |
|----------------------------------------|-----------------------|
| **Before AER-12** (MiniLM bundle)      | ~22 MB Rust + ~25 MB MiniLM int8 → ~47 MB raw, ~32 MB compressed NSIS |
| **After AER-12** (nomic bundle)        | ~22 MB Rust + ~138 MB nomic int8 → ~160 MB raw, ~115 MB compressed NSIS |
| **Delta**                              | **+~83 MB compressed** |

The size jump is the cost of moving from a 22M-param MiniLM (384d native,
~7.5 hit@5 on STSB-style synthetic queries) to the 137M-param nomic
embedder (768d native, Matryoshka-truncated to 256d at the boundary,
~0.92 hit@5). Recall improvement vs install-size cost is the trade-off
the AER-8 / AER-12 work locks in.

(Numbers are NSIS-compressed estimates from local builds on macOS — Windows
installer compression typically lands within ±5 MB of these figures because
the bottleneck is the ONNX tensor data, which is already byte-randomised
post-int8 quantization.)

## Variant trade-offs

HuggingFace publishes several quantised variants. Why we bundle int8:

| Variant                  | Size    | macOS-CPU latency (M2, p50) | ORT-CPU support       | Notes                                          |
|--------------------------|---------|------------------------------|------------------------|------------------------------------------------|
| `model.onnx` (FP32)      | 547 MB  | ~28 ms                       | All targets            | Full precision — too big to bundle             |
| `model_fp16.onnx`        | 274 MB  | ~22 ms                       | All targets            | Half-precision — better than int8 but bigger   |
| `model_quantized.onnx` (int8) | **137 MB** | **~8 ms**             | **All targets**        | **Bundled** — best size/perf on ORT-CPU        |
| `model_q4f16.onnx`       | 111 MB  | ~14 ms (CPU), ~9 ms (DML)    | Partial — DML only     | Only wins on Windows-DirectML; CPU regresses   |

`q4f16` is ~26 MB smaller than int8 but:

- ORT-CPU op coverage for q4 weight unpacking is incomplete on macOS and
  Linux, falling back to slow generic kernels. Measured 1.5–1.8× slower
  per-embed than int8 on M2 Pro CPU.
- DirectML EP (Windows) DOES benefit from q4f16, but DirectML is the
  smallest deployment surface and the +5 ms p50 cost on macOS-CPU
  (where 80%+ of the user base lives) outweighs the bundle-size win.
- The Rust resolver `resolve_bundled_model()` in
  `src-tauri/src/ml/model_manager.rs` hard-codes the filename
  `model_quantized.onnx`. Swapping requires a synchronised Rust + JSON
  change AND a re-bench.

If you want to evaluate q4f16 locally:

```bash
# Fetches model_q4f16.onnx into the same dir (NOT bundled, dev-only)
pnpm fetch-onnx-model -- --variant=q4f16

# Point the resolver at it temporarily — DO NOT commit:
# Edit src-tauri/src/ml/model_manager.rs:47
#   let onnx = dir.join("model_q4f16.onnx");
```

## Recall trade-off vs full-precision

Cross-surface parity (AER-8) measures cosine similarity between same-input
embeddings from different runtimes. Targets:

- **Web (WebGPU q4f16) ↔ Tauri (CPU int8)**: cosine ≥ 0.999 (enforced in
  `scripts/aer8-cross-parity.mjs`)
- **Tauri int8 ↔ Tauri full-precision (downloaded on demand)**: cosine
  ≥ 0.998

Empirically (50-query STSB-like fixture, see `BENCHMARK.md` § Cross-surface
parity verification):

| Comparison                          | Mean cosine | hit@5 vs full-precision oracle |
|-------------------------------------|-------------|---------------------------------|
| int8 quantized (bundled)            | 0.9994      | 0.96                            |
| q4f16                               | 0.9981      | 0.94                            |
| full-precision (downloaded)         | 1.0000      | 1.00 (reference)                |

In practice: bundled int8 sacrifices < 5% hit@5 vs full-precision while
being 4× smaller. Users who hit the regression can opt into the full model
via the in-app "Download full ONNX model" toggle (calls
`ml_download_full_model` — see `src-tauri/src/ml/model_manager.rs`).

## Re-running the fetch

```bash
# Default: idempotent — skips files whose on-disk size matches HF remote
pnpm fetch-onnx-model

# Force re-download (e.g. after HF re-published an updated graph)
pnpm fetch-onnx-model -- --force

# Fetch an optional variant for benchmarking (not bundled)
pnpm fetch-onnx-model -- --variant=q4f16
pnpm fetch-onnx-model -- --variant=fp16
pnpm fetch-onnx-model -- --variant=full
```

The script:

1. HEAD-probes each file at
   `https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/resolve/main/<path>`
   to discover the canonical content length.
2. Skips files where the local size already matches (idempotent).
3. Streams the rest to disk with progress logging.
4. Retries with exponential backoff (4 attempts, 1.5s → 3s → 6s → 12s) on
   transient errors.
5. Exits non-zero on any required-file failure so `pnpm tauri:build` fails
   loudly in CI.

## When to swap variants

If installer size becomes the bottleneck (e.g. delivering to
bandwidth-constrained markets or shrinking the auto-updater delta):

1. Re-benchmark q4f16 / fp16 on the target hardware mix using the AER-8
   protocol (see `BENCHMARK.md`).
2. If the new variant clears the cross-surface parity bar (cosine ≥ 0.999
   against WebGPU q4f16), update:
   - `scripts/fetch-onnx-model.mjs` → `REQUIRED_FILES` entry
   - `src-tauri/src/ml/model_manager.rs` → `resolve_bundled_model()`
   - `src-tauri/tauri.conf.json` → `bundle.resources` filename
   - This document's "What ships" table + size delta
3. Ship as a single commit so the resolver and the bundled file are
   always in lock-step.

## Why HuggingFace and not our own CDN

- HF resolve URLs are stable; their content is content-addressed by SHA
  on the backend and 302-redirect to S3/Xet for transfer.
- HF rate-limits at 3000 requests / 300s per IP — plenty for our
  dev-laptop + CI workload (5 files per build).
- Migrating to our own CDN saves ~138 MB / build of HF egress but adds an
  R2 bucket, signed URLs, and a rotation story. Not worth it until
  build cadence > 10/day.
