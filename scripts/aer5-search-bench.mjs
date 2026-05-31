#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AER-5 semantic-search latency bench
// ---------------------------------------------------------------------------
//
// Seeds N synthetic 256d embeddings into a single test map, then runs M
// queries through the same SQL that `POST /api/search/semantic` executes,
// recording per-query latency. Reports p50 / p95 / max.
//
// Requires:
//   - TEST_DATABASE_URL pointing at a Postgres+pgvector DB with the
//     `NodeEmbedding`, `Map`, `User` tables (run `prisma migrate deploy`)
//
// Run:
//   TEST_DATABASE_URL=postgresql://... node scripts/aer5-search-bench.mjs
//
// Defaults: N=1000 rows, M=200 queries, with a 20-query warmup discarded.
// Override via env: BENCH_N=5000 BENCH_M=500 ...
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

const DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
if (!DB_URL) {
  console.error('Set TEST_DATABASE_URL (or DATABASE_URL) to run the bench.')
  process.exit(1)
}

const DIMS = 256
const N = Number(process.env.BENCH_N ?? 1000)
const M = Number(process.env.BENCH_M ?? 200)
const WARMUP = Number(process.env.BENCH_WARMUP ?? 20)

function makeRng(seed) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5;  s >>>= 0
    return (s >>> 0) / 0xFFFFFFFF
  }
}

function randomUnitVector(rng, dims) {
  const v = new Array(dims)
  for (let i = 0; i < dims; i += 2) {
    const u1 = Math.max(rng(), 1e-12)
    const u2 = rng()
    const mag = Math.sqrt(-2 * Math.log(u1))
    v[i] = mag * Math.cos(2 * Math.PI * u2)
    if (i + 1 < dims) v[i + 1] = mag * Math.sin(2 * Math.PI * u2)
  }
  let n = 0
  for (let i = 0; i < dims; i++) n += v[i] * v[i]
  n = Math.sqrt(n)
  for (let i = 0; i < dims; i++) v[i] /= n
  return v
}

function toPgVector(arr) {
  return `[${arr.join(',')}]`
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  // Sanity: pgvector available.
  await client.query("SELECT '[1]'::vector AS v")

  const userId = `aer5-bench-user-${randomUUID()}`
  const mapId  = `aer5-bench-map-${randomUUID()}`

  console.log(`seeding bench: N=${N} embeddings, M=${M} queries (warmup ${WARMUP})`)

  await client.query(
    `INSERT INTO "User" ("id", "email", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())`,
    [userId, `${userId}@aer5.test`]
  )
  await client.query(
    `INSERT INTO "Map" ("id", "userId", "title", "data", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())`,
    [mapId, userId, 'AER-5 bench', '{}']
  )

  try {
    const rng = makeRng(0xA1B2C3D4)
    const seedStart = Date.now()
    for (let i = 0; i < N; i++) {
      const vec = randomUnitVector(rng, DIMS)
      await client.query(
        `INSERT INTO "NodeEmbedding"
           ("id", "mapId", "nodeId", "embedding", "contentHash", "modelVersion", "dimensions", "sourceText", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, NOW(), NOW())`,
        [randomUUID(), mapId, `bench-node-${i}`, toPgVector(vec), `h-${i}`,
         'nomic-embed-text-v1.5', DIMS, `bench text ${i}`]
      )
    }
    console.log(`  seeded in ${(Date.now() - seedStart) / 1000}s`)

    const queryRng = makeRng(0x55667788)
    const queryVecs = Array.from({ length: M + WARMUP }, () => randomUnitVector(queryRng, DIMS))

    const sql = `
      SELECT ne."mapId", ne."nodeId", ne."sourceText",
             1 - (ne."embedding" <=> $1::vector) AS similarity,
             m."title" AS "mapTitle"
      FROM "NodeEmbedding" ne
      JOIN "Map" m ON m."id" = ne."mapId"
      WHERE m."userId" = $2
        AND m."deletedAt" IS NULL
        AND 1 - (ne."embedding" <=> $1::vector) >= $3
      ORDER BY ne."embedding" <=> $1::vector
      LIMIT $4
    `

    // Warmup
    for (let i = 0; i < WARMUP; i++) {
      await client.query(sql, [toPgVector(queryVecs[i]), userId, 0.0, 20])
    }

    // Measure
    const latenciesMs = []
    for (let i = 0; i < M; i++) {
      const t0 = process.hrtime.bigint()
      await client.query(sql, [toPgVector(queryVecs[WARMUP + i]), userId, 0.0, 20])
      const t1 = process.hrtime.bigint()
      latenciesMs.push(Number(t1 - t0) / 1e6)
    }

    latenciesMs.sort((a, b) => a - b)
    const p50 = percentile(latenciesMs, 50)
    const p95 = percentile(latenciesMs, 95)
    const p99 = percentile(latenciesMs, 99)
    const max = latenciesMs[latenciesMs.length - 1]
    const mean = latenciesMs.reduce((s, v) => s + v, 0) / latenciesMs.length

    console.log('')
    console.log(`results (N=${N}, queries=${M}):`)
    console.log(`  p50  = ${p50.toFixed(2)} ms`)
    console.log(`  p95  = ${p95.toFixed(2)} ms`)
    console.log(`  p99  = ${p99.toFixed(2)} ms`)
    console.log(`  max  = ${max.toFixed(2)} ms`)
    console.log(`  mean = ${mean.toFixed(2)} ms`)
  }
  finally {
    await client.query(`DELETE FROM "NodeEmbedding" WHERE "mapId" = $1`, [mapId])
    await client.query(`DELETE FROM "Map" WHERE "id" = $1`, [mapId])
    await client.query(`DELETE FROM "User" WHERE "id" = $1`, [userId])
    await client.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
