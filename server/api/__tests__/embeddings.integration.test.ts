// ---------------------------------------------------------------------------
// Embeddings + semantic-search integration tests (AER-5)
// ---------------------------------------------------------------------------
//
// These tests exercise the actual data plane used by:
//   - POST   /api/embeddings              (bulk upsert into NodeEmbedding)
//   - GET    /api/embeddings?...          (mapId/nodeIds fan-out read)
//   - DELETE /api/embeddings/[mapId]      (wipe-by-map + cache purge)
//   - POST   /api/embeddings/reindex/...  (wipe-by-map + cache purge)
//   - POST   /api/search/semantic         (HNSW cosine top-K)
//
// Rather than booting a full Nitro server, we hit the underlying Prisma
// raw SQL (the exact statements the endpoints execute) plus the real Redis
// cache helpers. This catches DB-side regressions (schema drift, pgvector
// availability, HNSW operator changes, cosine direction bugs) which are
// the actual failure surface this endpoint family has shown.
//
// Gating: tests are SKIPPED when `TEST_DATABASE_URL` is not set, so the
// suite is safe to run in environments without a Postgres + pgvector + Redis
// dev stack. To run locally:
//
//   export TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/neurocanvas_test
//   export TEST_REDIS_URL=redis://localhost:6379/15   # optional, falls back to 6379/0
//   npx vitest run server/api/__tests__/embeddings.integration.test.ts
//
// The target DB MUST have:
//   - The pgvector extension installed
//   - The NodeEmbedding + Map + User tables (run `prisma migrate deploy`)
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import {
  EMBEDDING_DIMS,
  EMBEDDING_MODEL,
  cosineSimilarity,
  toPgVector,
} from '../../utils/embeddings'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface Fixture {
  cluster: string
  nodeId: string
  text: string
  embedding: number[]
}
interface FixtureFile {
  meta: Record<string, unknown>
  fixtures: Fixture[]
}

// ---------------------------------------------------------------------------
// Gating: load env, decide whether to run.
// ---------------------------------------------------------------------------

const TEST_DB_URL = process.env.TEST_DATABASE_URL
const TEST_REDIS_URL = process.env.TEST_REDIS_URL
const ENABLED = Boolean(TEST_DB_URL)

// vitest's describe.skipIf is available; falls back to a plain describe with
// a single "skipped" test if the gate is off. We want a clear signal in CI
// output that the integration suite was intentionally skipped.
const maybe = ENABLED ? describe : describe.skip

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function loadFixtures(): FixtureFile {
  const path = join(__dirname, 'fixtures', 'cluster-embeddings.json')
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw) as FixtureFile
}

// ---------------------------------------------------------------------------
// DB / Redis bootstrap
//
// We deliberately import these lazily *inside* the describe block so the
// import has no side effects when TEST_DATABASE_URL is unset. The Prisma
// adapter constructor reads process.env.DATABASE_URL at instantiation time;
// when running the integration suite we want it pointed at TEST_DATABASE_URL.
// ---------------------------------------------------------------------------

maybe('embeddings + semantic-search data plane', () => {
  // Dynamically imported modules — populated in beforeAll.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cache: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cacheKeys: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redis: any

  // Lifecycle ids — created in beforeAll, cleaned in afterAll.
  let testUserId = ''
  let testMapId = ''

  const EMBEDDING_CACHE_TTL = 7 * 24 * 60 * 60

  async function insertEmbedding(mapId: string, nodeId: string, embedding: number[], text: string, contentHash: string) {
    const id = randomUUID()
    const vectorStr = toPgVector(embedding)
    await prisma.$executeRaw`
      INSERT INTO "NodeEmbedding" ("id", "mapId", "nodeId", "embedding", "contentHash", "modelVersion", "dimensions", "sourceText", "createdAt", "updatedAt")
      VALUES (${id}, ${mapId}, ${nodeId}, ${vectorStr}::vector, ${contentHash}, ${EMBEDDING_MODEL}, ${EMBEDDING_DIMS}, ${text}, NOW(), NOW())
      ON CONFLICT ("mapId", "nodeId")
      DO UPDATE SET
        "embedding" = EXCLUDED."embedding",
        "contentHash" = EXCLUDED."contentHash",
        "sourceText" = EXCLUDED."sourceText",
        "modelVersion" = EXCLUDED."modelVersion",
        "updatedAt" = NOW()
    `
    await cache.set(
      cacheKeys.embeddingByNode(mapId, nodeId),
      { embedding, contentHash },
      EMBEDDING_CACHE_TTL
    )
  }

  beforeAll(async () => {
    if (!ENABLED) return

    // Route Prisma + ioredis at the test instances BEFORE importing the
    // singletons. Both modules read these env vars at module-eval time.
    process.env.DATABASE_URL = TEST_DB_URL
    if (TEST_REDIS_URL) process.env.REDIS_URL = TEST_REDIS_URL

    const prismaMod = await import('../../utils/prisma')
    const redisMod = await import('../../utils/redis')
    prisma = prismaMod.prisma
    cache = redisMod.cache
    cacheKeys = redisMod.cacheKeys
    redis = redisMod.redis

    // Sanity: pgvector must be available. Throwing here fails the whole
    // suite with a clear message rather than producing 30 cryptic SQL errors.
    await prisma.$queryRaw`SELECT '[1]'::vector AS v`

    // Create a test user + map. We use raw inserts so we don't depend on
    // any User-creation business logic. Keep the schema requirements
    // minimal — only the columns that are NOT NULL or have unique constraints.
    testUserId = `aer5-user-${randomUUID()}`
    testMapId = `aer5-map-${randomUUID()}`

    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "email", "createdAt", "updatedAt")
      VALUES (${testUserId}, ${testUserId + '@aer5.test'}, NOW(), NOW())
    `
    await prisma.$executeRaw`
      INSERT INTO "Map" ("id", "userId", "title", "data", "createdAt", "updatedAt")
      VALUES (${testMapId}, ${testUserId}, ${'AER-5 integration test'}, ${'{}'}::jsonb, NOW(), NOW())
    `
  }, 30_000)

  afterAll(async () => {
    if (!ENABLED) return
    try {
      await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}`
      await prisma.$executeRaw`DELETE FROM "Map" WHERE "id" = ${testMapId}`
      await prisma.$executeRaw`DELETE FROM "User" WHERE "id" = ${testUserId}`
      await cache.delPattern(cacheKeys.embeddingsByMap(testMapId))
    }
    finally {
      await prisma.$disconnect()
      if (redis?.quit) await redis.quit().catch(() => undefined)
    }
  }, 30_000)

  // -------------------------------------------------------------------------
  // 1. POST /api/embeddings  -- round-trip 5 embeddings into pgvector
  // -------------------------------------------------------------------------

  it('upserts 5 embeddings and reads them back from pgvector', async () => {
    const fx = loadFixtures().fixtures.slice(0, 5)

    for (const f of fx) {
      await insertEmbedding(testMapId, f.nodeId, f.embedding, f.text, `hash-${f.nodeId}`)
    }

    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "NodeEmbedding"
      WHERE "mapId" = ${testMapId}
    `
    expect(Number(rows[0]!.count)).toBe(5)

    // Cleanup so the next test starts clean.
    await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}`
    await cache.delPattern(cacheKeys.embeddingsByMap(testMapId))
  })

  // -------------------------------------------------------------------------
  // 2. GET /api/embeddings  -- cache-then-DB fan-out returns matching vectors
  // -------------------------------------------------------------------------

  it('fan-out read returns the same vectors that were written', async () => {
    const fx = loadFixtures().fixtures.slice(0, 5)
    for (const f of fx) {
      await insertEmbedding(testMapId, f.nodeId, f.embedding, f.text, `hash-${f.nodeId}`)
    }

    interface Row { nodeId: string; embedding: string; contentHash: string }
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT "nodeId", "embedding"::text AS embedding, "contentHash"
      FROM "NodeEmbedding"
      WHERE "mapId" = ${testMapId}
        AND "nodeId" = ANY(${fx.map(f => f.nodeId)}::text[])
    `

    expect(rows).toHaveLength(5)
    for (const row of rows) {
      const parsed = row.embedding.slice(1, -1).split(',').map(Number)
      const source = fx.find(f => f.nodeId === row.nodeId)!
      // pgvector should round-trip vectors with high precision (float4).
      // Demand cosine >= 0.9999 -- well above any conceivable storage drift.
      expect(cosineSimilarity(parsed, source.embedding)).toBeGreaterThan(0.9999)
    }

    await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}`
    await cache.delPattern(cacheKeys.embeddingsByMap(testMapId))
  })

  // -------------------------------------------------------------------------
  // 3. DELETE /api/embeddings/[mapId]  -- wipe + cache purge
  // -------------------------------------------------------------------------

  it('delete-by-mapId removes pgvector rows AND Redis cache entries', async () => {
    const fx = loadFixtures().fixtures.slice(0, 5)
    for (const f of fx) {
      await insertEmbedding(testMapId, f.nodeId, f.embedding, f.text, `hash-${f.nodeId}`)
    }

    // Pre-check: cache populated.
    const beforeCache = await cache.get(cacheKeys.embeddingByNode(testMapId, fx[0]!.nodeId))
    expect(beforeCache).not.toBeNull()

    // Exact same statements the DELETE handler runs.
    await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}`
    await cache.delPattern(cacheKeys.embeddingsByMap(testMapId))

    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}
    `
    expect(Number(rows[0]!.count)).toBe(0)

    const afterCache = await cache.get(cacheKeys.embeddingByNode(testMapId, fx[0]!.nodeId))
    expect(afterCache).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 4. POST /api/search/semantic  -- exact-match returns self with cosine ~= 1
  // -------------------------------------------------------------------------

  it('searching with a stored vector returns that vector first with similarity ~= 1.0', async () => {
    const fx = loadFixtures().fixtures.slice(0, 5)
    for (const f of fx) {
      await insertEmbedding(testMapId, f.nodeId, f.embedding, f.text, `hash-${f.nodeId}`)
    }

    const query = fx[2]!
    const vectorStr = toPgVector(query.embedding)

    interface SearchRow { nodeId: string; similarity: number }
    const rows = await prisma.$queryRaw<SearchRow[]>`
      SELECT "nodeId",
             1 - ("embedding" <=> ${vectorStr}::vector) AS similarity
      FROM "NodeEmbedding"
      WHERE "mapId" = ${testMapId}
      ORDER BY "embedding" <=> ${vectorStr}::vector
      LIMIT 5
    `

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]!.nodeId).toBe(query.nodeId)
    expect(Number(rows[0]!.similarity)).toBeGreaterThan(0.999)

    await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}`
    await cache.delPattern(cacheKeys.embeddingsByMap(testMapId))
  })

  // -------------------------------------------------------------------------
  // 5. End-to-end fidelity: recall@3 across 3 well-separated clusters
  // -------------------------------------------------------------------------

  it('recall@3 across 3 clusters of 10 nodes is >= 0.66 (expect ~1.0)', async () => {
    const fx = loadFixtures().fixtures // all 30
    expect(fx).toHaveLength(30)

    for (const f of fx) {
      await insertEmbedding(testMapId, f.nodeId, f.embedding, f.text, `hash-${f.nodeId}`)
    }

    // For every member, query with its embedding, take top-K excluding self,
    // count how many of the next K-1 results are from the same cluster.
    const K = 3
    let totalSameCluster = 0
    let totalConsidered = 0

    for (const probe of fx) {
      const vectorStr = toPgVector(probe.embedding)
      interface Row { nodeId: string }
      const rows = await prisma.$queryRaw<Row[]>`
        SELECT "nodeId"
        FROM "NodeEmbedding"
        WHERE "mapId" = ${testMapId}
        ORDER BY "embedding" <=> ${vectorStr}::vector
        LIMIT ${K + 1}
      `
      // First result is the probe itself; check the next K.
      const neighbours = rows.filter(r => r.nodeId !== probe.nodeId).slice(0, K)
      for (const n of neighbours) {
        const peer = fx.find(f => f.nodeId === n.nodeId)
        if (!peer) continue
        if (peer.cluster === probe.cluster) totalSameCluster += 1
        totalConsidered += 1
      }
    }

    const recall = totalSameCluster / totalConsidered
    // Each cluster has 10 members; for any probe, ALL 9 same-cluster peers
    // sit closer than any of the 20 cross-cluster ones, so recall@3 should be
    // exactly 1.0 for these well-separated synthetic clusters. We demand
    // >= 0.66 to give some headroom for HNSW approximate-search rounding.
    expect(recall).toBeGreaterThanOrEqual(0.66)
    // Surface the actual value in the test log for the AER-5 report.
    console.log(`[AER-5] recall@${K} = ${recall.toFixed(4)} (${totalSameCluster}/${totalConsidered})`)

    await prisma.$executeRaw`DELETE FROM "NodeEmbedding" WHERE "mapId" = ${testMapId}`
    await cache.delPattern(cacheKeys.embeddingsByMap(testMapId))
  }, 60_000)
})

// When the integration suite is disabled we still emit a single passing
// "skipped" test so CI output makes it obvious that the suite was gated,
// not silently absent.
if (!ENABLED) {
  describe('embeddings + semantic-search data plane (skipped)', () => {
    it('skipped: set TEST_DATABASE_URL to run the integration suite', () => {
      expect(true).toBe(true)
    })
  })
}
