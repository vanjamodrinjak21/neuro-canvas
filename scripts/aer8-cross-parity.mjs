#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AER-8 cross-surface embedding parity verifier
// ---------------------------------------------------------------------------
//
// Compares 256d embeddings captured from the three NeuroCanvas runtimes
// (web worker / Tauri Rust / Node server) and asserts that pairwise cosine
// similarity meets the parity floor for every (input, surface-pair) combo.
//
// This script CANNOT run inside vitest because Tauri's ONNX engine lives in
// Rust and cannot be invoked from the Node test runner. The workflow is:
//
//   1. Capture each surface's output for a shared set of inputs (instructions
//      in BENCHMARK.md → "Cross-surface parity verification").
//   2. Run this script with the resulting JSON fixture files.
//   3. Script reports per-pair cosine + exits non-zero if any pair falls
//      below the 0.999 floor.
//
// Why 0.999 and not 1.0
//   ONNX is deterministic given the same EP, but cross-EP runs (CPU vs
//   CoreML vs WebGPU) accumulate slightly different FP rounding. Empirically
//   well-behaved pairs sit at 0.9998+; anything below 0.999 means a pipeline
//   has drifted (different tokenizer, missed normalization, dropped
//   Matryoshka renorm, wrong prefix, etc.) and we should fail loud.
//
// Fixture format
//   Each input file is JSON with a `pairs` array. Each pair has a stable
//   `id` and an `embedding` (256 floats). The id ties the three files
//   together. Example:
//
//     {
//       "surface": "web-webgpu",
//       "model": "nomic-embed-text-v1.5",
//       "dimensions": 256,
//       "pairs": [
//         { "id": "fox", "text": "the quick brown fox", "embedding": [...256...] },
//         { "id": "bread", "text": "sourdough bread", "embedding": [...256...] }
//       ]
//     }
//
// Usage
//   node scripts/aer8-cross-parity.mjs <web.json> <tauri.json> <server.json>
//
//   At least 2 files required. If only 2 are given the script compares that
//   pair only (useful when a runtime isn't available on the current host).
//
// Exit codes
//   0 — every pair clears the cosine floor on every input
//   1 — at least one pair failed, OR fixtures are malformed
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { argv, exit } from 'node:process'

const COSINE_FLOOR = 0.999
const EXPECTED_DIM = 256

function die(msg) {
  console.error(`✗ ${msg}`)
  exit(1)
}

function cosine(a, b) {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

function loadFixture(path) {
  let json
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    die(`failed to read ${path}: ${err.message}`)
  }

  if (!json.surface || typeof json.surface !== 'string') {
    die(`${path}: missing string field "surface"`)
  }
  if (!Array.isArray(json.pairs) || json.pairs.length === 0) {
    die(`${path}: "pairs" must be a non-empty array`)
  }
  if (json.dimensions && json.dimensions !== EXPECTED_DIM) {
    die(`${path}: dimensions=${json.dimensions}, expected ${EXPECTED_DIM}`)
  }
  for (const p of json.pairs) {
    if (!p.id || !Array.isArray(p.embedding) || p.embedding.length !== EXPECTED_DIM) {
      die(`${path}: pair ${p.id ?? '?'} has wrong embedding length (got ${p.embedding?.length ?? 'undefined'}, expected ${EXPECTED_DIM})`)
    }
  }

  return json
}

const args = argv.slice(2)
if (args.length < 2) {
  console.error('usage: node scripts/aer8-cross-parity.mjs <fixture1.json> <fixture2.json> [fixture3.json]')
  exit(1)
}

const fixtures = args.map(loadFixture)
console.log(`Loaded ${fixtures.length} surfaces: ${fixtures.map(f => f.surface).join(', ')}`)
console.log(`Inputs per surface: ${fixtures[0].pairs.length}`)
console.log(`Cosine floor: ${COSINE_FLOOR}`)
console.log('')

// Build id index per surface
const surfaceIndex = fixtures.map(f => {
  const m = new Map()
  for (const p of f.pairs) m.set(p.id, p.embedding)
  return { surface: f.surface, index: m }
})

// Collect all shared ids
const sharedIds = [...surfaceIndex[0].index.keys()].filter(id =>
  surfaceIndex.every(s => s.index.has(id)),
)
if (sharedIds.length === 0) {
  die('no overlapping ids across surfaces — fixtures cannot be compared')
}

let failures = 0
let pairsChecked = 0

for (const id of sharedIds) {
  console.log(`--- ${id} ---`)
  for (let i = 0; i < surfaceIndex.length; i++) {
    for (let j = i + 1; j < surfaceIndex.length; j++) {
      const a = surfaceIndex[i].index.get(id)
      const b = surfaceIndex[j].index.get(id)
      const sim = cosine(a, b)
      pairsChecked++
      const ok = sim >= COSINE_FLOOR
      if (!ok) failures++
      const tag = ok ? '✓' : '✗'
      console.log(
        `  ${tag} ${surfaceIndex[i].surface} ↔ ${surfaceIndex[j].surface}: cosine=${sim.toFixed(6)}`,
      )
    }
  }
}

console.log('')
console.log(`Total pairs: ${pairsChecked}`)
console.log(`Failures:    ${failures}`)

if (failures > 0) {
  console.error(`✗ ${failures} pair(s) failed cross-surface parity (floor ${COSINE_FLOOR})`)
  exit(1)
}

console.log(`✓ all ${pairsChecked} pairs passed parity floor ${COSINE_FLOOR}`)
exit(0)
