# AER-10 — Scalable Backend Architecture Plan

Status: Proposed (planning artifact only — no implementation in this PR)
Owner: Vanja Modrinjak
Linear: https://linear.app/aerody/issue/AER-10
Trigger date: 2026-05-31 (post-MVP horizon planning, not active migration)

---

## 1. Executive summary

NeuroCanvas today runs as a single-container Nitro server on Railway (Dockerfile multi-stage, Node 22 Alpine), a single PostgreSQL instance with the `pgvector` extension, a single Redis (used for cache + pub/sub + Streams + distributed locks + rate limits), and a separate Cloudflare-edge PartyKit deployment (`neurocanvas-collab`) for Y.Doc-CRDT realtime rooms. Auth is JWT-only via `@sidebase/nuxt-auth` (no server-side session table hit on every request). The audit shows 74 server API routes; the actually hot endpoints are a small subset (sync push/pull/stream, AI streaming proxy, embeddings write, semantic search, collab JWT mint + flush callback). Most heavy compute is already pushed to the client: embeddings run in a Web Worker (transformers.js) on web and via Tauri-native ORT on desktop, with server-side fallback only triggered when a client cannot run the model.

This is a fundamentally favourable starting position for scale. The single Nitro container handles only orchestration, validation, vault decryption, AI proxying, and Postgres/Redis writes — the CPU-heavy work (rendering, CRDT merge, embedding) lives on the client or in PartyKit (edge). A single 1 vCPU / 1 GB Railway service should comfortably hold ≤ 100 concurrent users at current request patterns. The bottleneck order, when growth comes, is predictable: (1) the single Nitro instance keeping SSE connections open for every signed-in tab (`/api/sync/stream`), (2) the single Postgres for JSON `Map.data` writes and HNSW upsert amplification, (3) the single Redis being on the hot path for every sync + every rate-limit check + every pub/sub message, and (4) PartyKit per-room CPU as more maps host concurrent editors.

The recommended path is a **three-phase, evidence-gated hybrid migration**: Phase 1 splits the existing Railway service into Nitro web + Nitro embedding-worker + managed Postgres + managed Redis with pgBouncer in front (cheap, low-risk, addresses the first ceiling); Phase 2 moves CRDT collab off PartyKit into a self-hosted Bun + uWebSockets relay (or Phoenix Channels if the team grows) once room concurrency dictates and adds Postgres read replicas + a dedicated GPU embedding worker; Phase 3 evaluates Kubernetes only if multi-region or > 3-engineer ops becomes real. Each phase has a concrete trigger metric, a verification step, and a rollback. **Do not start any phase before its trigger fires** — over-architecting now would waste effort on a system that is not yet under load.

---

## 2. Current architecture inventory

### 2.1 Services and where they run

| Component | Runtime | Hosting | Scale unit today |
|---|---|---|---|
| Nitro (Nuxt 4 server) | Node 22, single container, SSR disabled (`ssr: false`) | Railway, single service via `railway.json` (`DOCKERFILE` builder, `/api/health` healthcheck) | 1 instance |
| PostgreSQL 16 + `pgvector` | Managed | Railway Postgres add-on | 1 instance, no replicas |
| Redis 7 | Managed | Railway Redis add-on | 1 instance, no replication |
| PartyKit (`neurocanvas-collab`) | Cloudflare Durable Objects | PartyKit cloud (Cloudflare edge) | Per-room DO, auto-sharded by mapId |
| CDN | Cloudflare R2 via `cdn.neuro-canvas.com` | Cloudflare | n/a (object storage) |
| Mobile (Capacitor iOS/Android) | Client-only | App stores | n/a |
| Desktop (Tauri) | Client-only | GitHub Releases → R2 CDN | n/a |

The Nitro container does NOT include `onnxruntime-node` at build time — the Dockerfile explicitly skips the postinstall (`npm ci --legacy-peer-deps --ignore-scripts`) and only rebuilds `bcrypt` and `better-sqlite3` (the latter just for Nuxt Content build cache). Server-side embedding is feature-flagged on availability of model files (`isServerEmbeddingAvailable()` in `server/utils/embeddings.ts`) and is therefore effectively a degraded fallback today, not the hot path.

### 2.2 Endpoint inventory (74 routes total)

Grouped by likely RPS profile when the userbase grows:

**Hottest paths (per-active-user, sustained)**
- `GET  /api/sync/stream` — long-lived SSE, one connection per signed-in tab, subscribes a dedicated `ioredis` `Redis` instance per request to `sync:<userId>`. Heartbeat every 30s. **This is the first thing that breaks horizontal scaling.**
- `POST /api/sync/push` — autosave write path. Acquires Lua-based `syncLock:<mapId>`, computes checksum, upserts `Map` row + `MapVersion`, prunes versions > 20, writes Redis hot cache (1h TTL for meta + data), publishes to `sync:<userId>`, appends to Redis Stream `sync:changes:<userId>` (MAXLEN ~1000), updates `syncStateCache`, upserts `SyncState`. Roughly 6 Postgres ops + 8 Redis ops per call. Rate-limited to 120/min/user.
- `GET  /api/sync/pull` — read map data on resume / device-switch.
- `POST /api/ai/stream` — SSE proxy to OpenAI / Anthropic / OpenRouter / Ollama. Holds an open upstream connection for the duration of streaming. Rate-limited to 30/min/user.

**Warm paths (bursty, per editor session)**
- `POST /api/embeddings` — bulk pgvector upsert (up to 500 entries/req), HNSW write amplification. Rate-limited 60 writes/min/user (and 20/min if server-side embed is needed).
- `POST /api/search/semantic` — HNSW cosine top-K over `NodeEmbedding`. Rate-limited 60/min/user.
- `POST /api/collab/token` — mint short-lived JWT for PartyKit room connect.
- `POST /api/collab/flush` — PartyKit calls this to persist Y.Doc binary into `Map.ydoc` + JSON snapshot into `Map.data`. Debounced 2s / max 10s by PartyKit (`y-partykit` `debounceWait: 2000, debounceMaxWait: 10000`).
- `POST /api/collab/jti-check` — PartyKit calls this on every connect to validate JWT jti against the revocation allowlist.

**Cold paths (occasional, owner-only or admin)**
- `POST /api/templates/generate`, `POST /api/templates/[slug]/adapt`, `POST /api/templates/publish` — AI-backed template generation, low RPS.
- `POST /api/maps/[id]/share/*`, comments CRUD, versions list / restore — editor-session bursts.
- Auth: `[...].ts` (next-auth catchall), `register.post.ts`, `mobile-token.get.ts`, `desktop-google.post.ts`, TOTP, password change. Background traffic.
- `GET  /api/releases/*`, `GET  /api/maps/[id]/render` (OG image rendering), `GET  /api/health`.

### 2.3 Data model size assumptions (per active user)

| Table | Rows / user | Notes |
|---|---|---|
| `User` | 1 | + 1 `SyncState` |
| `Account` | 1-3 | One per OAuth provider |
| `Session` | 0 | JWT strategy — Session table essentially unused |
| `Map` | 5-50 typical, 200+ heavy users | `data: Json` snapshot grows with nodes; `ydoc: Bytes?` adds CRDT history; `preview: String?` is base64 thumbnail (kilobytes). `byteSize` tracked. **Hottest write target.** |
| `MapVersion` | 20 per Map (pruned) | So 100-1000 rows per user. Each row stores full `data: Json` + optional `ydocBinary: Bytes?`. **Largest table by storage.** |
| `NodeEmbedding` | 10-500 per Map (one per node with text) | 256d `vector` + `sourceText`. HNSW index amplifies writes. |
| `Comment` + `CommentMention` | 0-N per Map | Indexed on `mapId`, `threadId`, `anchorNodeId`. |
| `MapShare` | 0-10 per shared Map | Token-indexed. |
| `Credential` | 0-5 (BYOK API keys) | Encrypted, indexed on `userId`. |
| `Template` | system-shared + user-created | `usageCount` is a hot increment if templates page goes viral. |
| `CollabSession` | per-join row, never pruned today | Will need cleanup job once collab is real. |

Per-user steady-state storage projection: ~5-15 MB at the median, ~100 MB for power users with version history and embeddings. At 10k MAU with 10 % heavy users, total Postgres footprint is ~150-200 GB plus pgvector index overhead (HNSW is ~1.5x the raw vector size).

### 2.4 Current bottleneck candidates (ranked)

1. **Single Nitro instance holding all SSE** — every active tab opens `GET /api/sync/stream`; the process holds a dedicated Redis subscriber per request. ~1000 file descriptors per 1000 concurrent users. A single Node process is fine here; a single Railway instance ceiling is RAM + Redis connection count, not CPU.
2. **Single Postgres for JSON-blob writes** — every `sync/push` rewrites `Map.data` (whole-document upsert). pgvector HNSW writes add per-insert cost. Connection pool exhaustion is the canary.
3. **Single Redis on every hot path** — used for cache, pub/sub channel per user, Streams for sync log, distributed locks, rate limits, AI response cache, sync state hash. A Redis outage today is a hard outage of the entire backend (fail-closed rate limiter).
4. **PartyKit per-room CPU** — Y.Doc updates fan out within a Durable Object that auto-flushes via REST to Nitro every 2-10s. At 100+ concurrent editors on a single large map, the DO is the bottleneck (Cloudflare Workers single-threaded per DO).
5. **Per-request `ioredis` subscriber** in `getSubscriber()` is a singleton, which is correct, but pub/sub fan-out from a single user with many tabs duplicates the same Redis SUBSCRIBE per process. Once Nitro is horizontally scaled, channel naming (`sync:<userId>`) still works because Redis broadcasts; this is good — no architectural change needed for fan-out.
6. **Prisma's `PrismaPg` adapter** opens its own pg pool; no PgBouncer in front today. Default pool size per Nitro process is ~10. At 5 concurrent Nitro processes that is 50 connections; managed Postgres on Railway caps around 100 — exhausted at ~10 processes.

---

## 3. Load characterization

Three tiers. Numbers are RPS / concurrency estimates derived from the code paths above, not measured load.

### 3.1 Tier 1 — today (≤ 100 MAU, ≤ 20 concurrent)

| Subsystem | Load | Status |
|---|---|---|
| Nitro RPS | < 5 req/s sustained, < 50 burst | Idle. Headroom > 10x. |
| SSE connections | ≤ 20 concurrent | Trivial (Node easily holds 10k FDs). |
| Postgres QPS | < 20 q/s | Idle. Single instance with default pool fine. |
| Redis ops | < 100 ops/s | Idle. |
| PartyKit rooms | 0-5 concurrent (collab still gated by `NUXT_PUBLIC_COLLAB_ENABLED`) | Idle. |
| Egress AI tokens | bursty per user session | Capped by per-user 30/min. |

**Scales fine here without any change.** Do not migrate.

### 3.2 Tier 2 — 1k MAU / ~100 concurrent / ~10 collab rooms

| Subsystem | Projected load | First failure mode |
|---|---|---|
| Nitro RPS | 50-200 req/s sustained, 500 burst | Single 1 vCPU instance plateaus around 200 req/s under JSON serialization + Prisma overhead. **First** to need horizontal scaling. |
| SSE connections | ~100 concurrent open | Memory creeps from per-connection subscriber state. ~30 MB/100 conn — fine, but every restart drops them. |
| Postgres QPS | 200-500 q/s peak | Connection pool exhausted once Nitro replica count > 5. **PgBouncer becomes mandatory.** HNSW index writes amplify under embedding bursts. |
| Redis ops | 1000-3000 ops/s | Single Redis on Railway can sustain 50k+ ops/s — not the bottleneck. RTT is. |
| PartyKit rooms | 10-30 concurrent, < 5 editors per room | Still fine (Durable Object model handles this). |
| AI streaming | 5-20 concurrent SSEs | Each holds an open upstream socket; not CPU-bound on our side. |

**Bottleneck ranking at Tier 2:** Nitro instance count (req/s ceiling) → Postgres connection pool → nothing else.

CPU/RAM/IOPS projection at Tier 2:
- Nitro: 3-4 instances at 0.5 vCPU / 512 MB each (≈ $30-40/mo Railway).
- Postgres: bump to ~2 GB RAM / 50 GB SSD / 100 conns + PgBouncer (≈ $40-60/mo).
- Redis: stay on 256 MB plan (≈ $10/mo).
- PartyKit: still pay-per-MAU (current plan).

### 3.3 Tier 3 — 10k MAU / ~1k concurrent / ~100 live collab sessions

| Subsystem | Projected load | Required posture |
|---|---|---|
| Nitro RPS | 500-2000 req/s sustained | Horizontal autoscaling, 8-16 instances. SSE pinned to dedicated worker pool. |
| SSE connections | ~1000 concurrent | Need separate "long-lived connections" service so app restarts don't drop a thousand subscribers. Bun + uWebSockets or Phoenix shines here. |
| Postgres QPS | 2000-5000 q/s peak | Read replicas for `pull` + `search` + `comments` reads. Primary takes writes. Connection pooler mandatory. Partition `MapVersion` by `mapId` hash if it grows past ~100M rows. |
| Redis ops | 10k-30k ops/s | Single instance still likely fine — but introduce Redis-Sentinel or migrate to Redis Cluster for HA, not for throughput. |
| PartyKit rooms | 100+ concurrent | PartyKit cost climbs; per-room CPU on hottest rooms becomes the bottleneck. **Move CRDT to self-hosted Bun + uWebSockets relay** to control cost and latency, OR adopt Phoenix Channels if team is comfortable with Elixir. |
| Embedding | up to 50 req/s server-side fallback | Dedicated GPU worker pool (Modal/RunPod/Fly.io A10s) — cold-start tolerant, autoscaled to zero. |
| AI streaming | 50-100 concurrent | OK on Nitro; we are a proxy, not a model host. Bandwidth is the only concern. |

CPU/RAM/IOPS at Tier 3:
- Nitro: 8-16 instances at 1 vCPU / 1 GB on Railway autoscale (≈ $200-400/mo).
- Long-lived-connections service (Bun + uWS): 2-4 instances, ~$40-80/mo.
- Postgres primary: 4 vCPU / 8 GB / 200 GB SSD (≈ $150-200/mo) + 2 read replicas (≈ $100-150/mo each).
- PgBouncer: small container, ~$5/mo or sidecar.
- Redis: 1 GB plan w/ replica (≈ $30-50/mo).
- GPU embed worker (autoscale-to-zero): variable, ~$50-200/mo depending on traffic.
- PartyKit migrated to self-hosted: $0 incremental over Bun service.

---

## 4. Architecture options — full comparison

### Option 1 — Kubernetes (EKS / GKE / Hetzner k3s)

```
                       +------------------+
                       |   CloudFront/ CF |
                       +--------+---------+
                                |
                    +-----------+-----------+
                    |   Ingress / Gateway   |
                    +-----------+-----------+
                                |
       +------------------------+------------------------+
       |                        |                        |
+------+------+         +-------+--------+      +-------+--------+
| Nitro pods  |         | SSE / collab    |     | Embed worker   |
| (HPA 2-16)  |         | pods (Bun/uWS)  |     | pods (GPU node)|
+------+------+         +-------+--------+      +-------+--------+
       |                        |                        |
       +-----+------+-----------+------------+-----------+
             |      |                        |
        +----+--+  +-+-----+         +-------+-------+
        | Redis |  | Postgres (primary + 2 replicas) |
        | Cluster|  +-------+--------+               |
        +-------+           |                        |
                            +------------------------+
```

- **Migration complexity:** Very high. Requires Helm charts, ingress controller, cert-manager, secrets management (External Secrets / Vault), HPA, network policies, persistent volume claims for Redis/PG (or migrate to managed services anyway), GitOps tooling (Argo / Flux).
- **Ongoing ops complexity:** High. K8s upgrades quarterly. Node patching. PDBs, taints, tolerations. CSI driver issues. **Real ops burden requires ≥ 1 dedicated SRE.**
- **Cost (Tier 2):** EKS control plane $73/mo + 3 t3.medium workers ~$100/mo + ALB ~$20/mo + RDS Postgres ~$50/mo + ElastiCache Redis ~$30/mo + data transfer ~$30/mo ≈ **$300-400/mo**. Hetzner k3s alternative: 3x CCX23 nodes ~$60/mo + load balancer + managed PG/Redis externally ~$80/mo ≈ **$140-180/mo** (but you own the k3s ops).
- **Cost (Tier 3):** EKS ~$800-1500/mo; Hetzner k3s ~$300-500/mo.
- **Pros:**
  - Vendor-portable (run on any cloud or bare metal).
  - Mature autoscaling primitives (HPA, VPA, KEDA for queue-driven scale).
  - Fine-grained resource limits / requests per workload.
  - Well-understood blue/green and canary deployment patterns.
- **Cons:**
  - Operational tax that is wildly out of proportion to a 1-engineer team running a single product.
  - Every minor incident becomes a kubectl exec safari.
  - YAML proliferation. ConfigMap drift. Helm value sprawl.
  - Most failure modes are in the platform, not the app.
- **Best fit:** Multi-region deployments, multi-tenant SaaS that needs strict resource isolation, or a team with > 3 backend engineers and a SRE-fluent culture.
- **Rule out when:** Team is < 3 engineers, app is a single product, deployment can be expressed in 4-6 Railway services. **NeuroCanvas matches the rule-out conditions today and into Tier 3.**

### Option 2 — Erlang/Elixir + Phoenix full rewrite

```
+---------------------------+           +---------------------+
|   Nitro (kept for SSR)    |  HTTP     | Phoenix (Cowboy)    |
|   + Nuxt static assets    |<--------->| - Channels (collab) |
+-------------+-------------+           | - Sync + presence   |
              |                         | - Embed worker pool |
              v                         | - Auth REST         |
        Cloudflare CDN                  +----------+----------+
                                                   |
                                          +--------+---------+
                                          | Postgres + Redis |
                                          +------------------+
```

- **Migration complexity:** Very high (6-12 months). Rewrites: sync, collab, comments, vault, AI proxy, embeddings, auth REST. Keeps only the Nuxt SPA bundle on Nitro.
- **Ongoing ops complexity:** Medium (BEAM hot-code-load, supervision trees reduce on-call once stable, but require Erlang/Elixir fluency to debug).
- **Cost (Tier 2):** Comparable to Railway split, since BEAM is efficient. ~$80-120/mo.
- **Cost (Tier 3):** A single 4 vCPU / 8 GB Phoenix node handles what 8-16 Node instances handle; cost drops 30-50 % at Tier 3, but only after the rewrite cost amortises.
- **Pros:**
  - Best-in-class for long-lived connections and presence (Phoenix Channels obsolete PartyKit entirely).
  - Per-process isolation in the BEAM is genuinely magical for collab-style workloads.
  - Soft-realtime guarantees.
  - LiveView could shrink frontend complexity if rewritten.
- **Cons:**
  - **6-12 month rewrite cost is not justified by current traffic.**
  - Hiring pool for Elixir is smaller; you become the only person who can touch the backend.
  - Loses TypeScript end-to-end (Nuxt frontend ↔ Nitro server type sharing goes away).
  - Prisma → Ecto migration, Zod → Ecto changesets — full validation surface re-written.
- **Best fit:** Companies whose core product IS a realtime / presence-heavy system (Slack, Discord, Notion realtime). Greenfield, no existing app.
- **Rule out when:** You already have a working Node stack and concurrency demands have not exceeded what BEAM-on-paper advantages would give you. **NeuroCanvas: rule out for the foreseeable future. Phoenix Channels are interesting as a Phase 2 substitute for PartyKit if Bun + uWS proves insufficient, but a full rewrite is permanently off the table.**

### Option 3 — Hybrid (Railway split + selective specialization) — RECOMMENDED

```
                Railway project
                +--------------------------------+
                | Nitro Web (autoscale 2-N)      |  <-- web requests, AI streaming
                +-------------+------------------+
                              |
                +-------------+------------------+
                | Nitro SSE / Sync (1-2 pinned)  |  <-- /api/sync/stream long-lived
                +-------------+------------------+
                              |
                +-------------+------------------+
                | Embed worker (CPU, autoscale)  |  <-- /api/embeddings server fallback
                +-------------+------------------+
                              |
                +-------------+------------------+
                | Bun + uWS collab relay         |  <-- replaces PartyKit @ Tier 3
                |  (Phase 2)                     |
                +-------------+------------------+
                              |
                +-------------+------------------+
                | PgBouncer transaction pooler   |
                +-------------+------------------+
                              |
                +-------------+------------------+
                | Postgres primary + replicas    |
                | Redis (single → Sentinel @ T3) |
                +--------------------------------+
```

- **Migration complexity:** Low → Medium per phase. Phase 1 is purely Railway service splits + PgBouncer (≤ 1 week). Phase 2 is moderate (replace PartyKit with a Bun service hosting `y-websocket` server: ~2-3 weeks). Phase 3 only happens if Phase 2 is insufficient.
- **Ongoing ops complexity:** Low. Railway manages the platform. We own only application code and a couple of `railway.json` per service.
- **Cost (Tier 2):** $80-150/mo.
- **Cost (Tier 3):** $400-800/mo.
- **Pros:**
  - Reuses existing Dockerfile + TypeScript codebase verbatim.
  - Failure isolation: SSE service crash doesn't take down web API.
  - Cheapest migration path, lowest blast radius per phase.
  - Each phase is independently revertable (drop replica service, point traffic back to monolith).
  - Keeps Prisma + Zod + Nitro + JWT stack as-is.
- **Cons:**
  - Inter-service traffic over Railway internal network adds 1-3 ms per hop.
  - Railway is a single vendor (lock-in risk, but the underlying Docker image is portable).
  - Bun + uWS collab service still needs a Y.Doc persistence callback like PartyKit's flush — that code lives in `partykit/src/server.ts` today and would port without much loss.
- **Best fit:** Solo or small-team SaaS that wants horizontal scaling without owning the platform. **Matches NeuroCanvas exactly.**
- **Rule out when:** Multi-region required, or > 3 engineers want fine-grained control of every infra primitive, or vendor independence is a contractual requirement.

### Option 4 — Railway split only (no specialization)

Same as Phase 1 of Option 3, frozen. No move off PartyKit, no GPU worker, no Bun collab relay.

- **Migration complexity:** Low.
- **Ongoing ops complexity:** Low.
- **Cost (Tier 2):** $80-120/mo.
- **Cost (Tier 3):** PartyKit cost dominates; embedding inference cost dominates if fallback path becomes hot — could hit $1000+/mo before app cost.
- **Pros:** Minimum viable migration.
- **Cons:** Doesn't actually solve Tier 3 collab and embedding scaling — punts those to vendor pricing.
- **Best fit:** If we plateau at Tier 2 (< 1k MAU) indefinitely.
- **Rule out when:** PartyKit per-room cost or per-MAU cost exceeds self-hosting break-even — this is the trigger to start Option 3 Phase 2.

---

## 5. Recommendation

**Pick Option 3 (Hybrid Railway-split with phased specialization).** Reasoning anchored to the audit:

1. The codebase is already organised in a way that makes service splits trivial. `server/utils/redis.ts` is a clean facade; `server/utils/prisma.ts` is a singleton with adapter pattern; `server/utils/embeddings.ts` already feature-flags server-side embedding behind `isServerEmbeddingAvailable()`. A second Nitro service running with `EMBEDDING_WORKER=1` and only registering `/api/embeddings/**` + `/api/search/semantic` is a Dockerfile env-flag change, not a rewrite.

2. The Nitro container is small (`node:22-alpine` base, build tools dropped in prod). Booting a second copy on Railway is cheap and the platform's internal networking gives PgBouncer a single endpoint to publish to all replicas.

3. PartyKit is doing useful work today (Cloudflare-edge Y.Doc DOs are genuinely good), and the `/api/collab/flush` + `/api/collab/jti-check` callback contract is already cleanly separated. Replacing PartyKit later with a Bun + uWebSockets host that imports `y-websocket` is mechanical, NOT a redesign. The room semantics (`MapRoom` class in `partykit/src/server.ts`) port directly.

4. Server-side embedding is currently a degraded fallback — most embedding happens on the client. **GPU worker pool is a Phase 2 thing only if server-side traffic actually materialises.** Today it's a 503 path.

5. Kubernetes is RULED OUT for at least 18 months: no SRE on the team, single-product app, no multi-region requirement, Railway already does HA for managed PG/Redis. Re-evaluate if and only if Railway runs out of headroom AND another engineer joins ops.

6. Elixir/Phoenix full rewrite is RULED OUT permanently. Phoenix Channels remain a candidate ONLY as a possible Phase 2 substitute for PartyKit if Bun + uWS underperforms — and even then, the bar to clear is "Bun + uWS has been benchmarked and proven insufficient for 1k concurrent collab connections", not "Phoenix is cooler".

---

## 6. Phased migration roadmap

### Phase 1 — Service split + connection pooling

**Trigger to start (ALL must hold for 1 sustained week):**
- Concurrent active users sustained > 100 (measure via `/api/sync/stream` open SSE count exposed as a metric).
- p95 of `/api/sync/push` > 250 ms OR p95 of `/api/sync/pull` > 200 ms.
- Railway service CPU sustained > 60 % OR memory sustained > 70 % over rolling 24 h.

**Tasks:**
- (M) Add `pgbouncer` service to the Railway project in transaction-pooling mode. Point `DATABASE_URL` at it. Reduce Prisma pool size per Nitro process to ~5.
- (M) Split the Nitro service into two Railway services from the SAME Docker image, gated by env:
  - `app-web` (handles everything except SSE and embeddings)
  - `app-sse` (handles `/api/sync/stream`, `/api/ai/stream`; pinned to 1-2 replicas with longer idle timeouts)
  Routing is handled at the Railway public-domain layer using path-based custom domains or via an Nginx/Caddy in front (cheaper).
- (S) Add `app-embed` worker for `/api/embeddings/**` + `/api/search/semantic` once server-side embedding is even occasionally hot (still optional in Phase 1).
- (S) Enable Railway horizontal autoscaling on `app-web` (2-6 replicas, CPU > 70 % triggers scale-up).
- (S) Move Redis subscriber lifecycle into a per-process singleton with explicit reconnection backoff (today's `getSubscriber()` is already a singleton — verify it handles Redis restart correctly; add a reconnect log).
- (S) Add per-endpoint RED metrics emission (see §8).

**Effort estimate:** 1 engineer-week total.

**Verification:**
- Replay the load-test scenarios in §7 against the split deployment and confirm p95 targets met at 2x current peak load.
- Restart `app-web` and confirm SSE connections on `app-sse` survive.
- Confirm PgBouncer connection count never exceeds Postgres max conns.

**Rollback:**
- Re-point traffic at the original monolithic service (single env-var flip in Railway).
- Drop `app-sse` and `app-embed` services. PgBouncer can stay (no downside to keeping it).

### Phase 2 — Collab relay self-host + read replicas + GPU embedding

**Trigger to start (any ONE):**
- **Collab leg:** PartyKit cost > $200/mo sustained, OR per-room p95 update latency > 200 ms, OR > 30 concurrent rooms with > 5 editors each.
- **Read-replica leg:** Postgres primary CPU sustained > 70 % AND read:write ratio > 3:1 in `pg_stat_statements`.
- **GPU embed leg:** Server-side embedding RPS > 50/min sustained 1 day, OR per-request server-embed latency > 800 ms p95.

**Tasks:**

Collab leg (estimated 3 weeks):
- (L) Stand up a Bun service running `y-websocket` server with the same JWT/jti auth contract from `partykit/src/auth.ts`. Reuse `verifyConnectionJwt` verbatim; reuse the HMAC flush callback. Add room-state persistence using the same `applyFlush` path.
- (M) Migrate `partykit/src/server.ts` room logic (origin allowlist, jti revocation, kick/reload protocol, role enforcement) to the Bun service.
- (M) Cut over `NUXT_PUBLIC_PARTYKIT_HOST` to the new endpoint; keep PartyKit running for one week as fallback.
- (S) Decommission PartyKit deployment.

Read-replica leg (estimated 1 week):
- (M) Provision Railway Postgres read replica.
- (M) Add a read-only Prisma client (`prismaRO`) initialised with the replica URL. Route `pull`, `search/semantic`, `comments/index.get`, `versions/index.get`, `share/[token]/get` to it.
- (S) Add stale-read guard for read-after-write inside `sync/push` → re-read from primary inside the same request.

GPU embed leg (estimated 1 week):
- (M) Containerize the server-side embedding pipeline (already exists in `server/utils/embeddings.ts`) as a standalone HTTP worker.
- (M) Deploy to Fly.io A10s (or Modal autoscale-to-zero, depending on traffic shape) behind a private VPC.
- (S) Switch `app-embed` to call the GPU worker via internal HTTPS instead of running the pipeline in-process.

**Effort estimate:** 5 engineer-weeks across the three legs (parallelisable).

**Verification:**
- Collab: load-test 100 concurrent editors on a single map; confirm p95 update echo < 100 ms.
- Read replicas: confirm read endpoint p95 unchanged after switch; confirm no read-after-write regressions via the existing test suite.
- GPU embed: 1000 server-side embeddings completed at < 200 ms p95 each.

**Rollback:**
- Collab: flip `NUXT_PUBLIC_PARTYKIT_HOST` back to PartyKit; the Y.Doc state is the source of truth in `Map.ydoc`, so no data is lost.
- Read replicas: route reads back to primary by swapping `prismaRO` with `prisma` (single import alias change).
- GPU worker: revert `app-embed` to inline pipeline (env flag).

### Phase 3 — Multi-region or k8s — defer indefinitely

**Trigger to start (ALL must hold):**
- Tier 3 metrics sustained > 4 weeks.
- Multi-region latency requirement from product (i.e., a customer is geographically far enough that p95 RTT > 200 ms is hurting retention).
- AND the engineering team has grown to ≥ 3 backend engineers with platform experience.

**Tasks (only if all above hold):**
- Evaluate Kubernetes (Hetzner k3s for cost, EKS/GKE for managed) vs Railway-multi-region vs Fly.io regions.
- Adopt OpenTelemetry collector mesh with cross-region propagation.
- Consider per-region Postgres + global read replicas via Crunchy Bridge or Aiven.

**If trigger does not fully hold: do not start. Document why and re-evaluate every 6 months.**

**Verification / rollback:** N/A — by the time this phase is real, the team has SRE skills to define both.

---

## 7. Load testing protocol (baseline BEFORE any migration)

**Tool:** `k6` (Grafana, MIT). Reasons over alternatives:
- JavaScript test scripts let us reuse our existing TypeScript fixtures and validation helpers.
- Native support for HTTP streaming + WebSocket + SSE (vegeta and artillery require custom plugins for SSE).
- Built-in cloud runners (k6 Cloud) for realistic geographic distribution.
- Outputs are machine-parseable for diff-against-baseline workflows.

**Where to run:** k6 Cloud from `us-east-1` AND `europe-west` simultaneously (we deploy to Railway `europe-west4`; we want both same-region and cross-region p95 numbers). If self-hosted, use a dedicated Hetzner CCX11 in Falkenstein for EU and a $5/mo DigitalOcean droplet in NYC for US.

**Five scenarios to script:**

1. **Load Map** — `GET /api/sync/pull?mapId=<known seed>`. VU profile: ramp 1 → 100 → 1000 over 5 min, hold 2 min, drop. Auth: pre-minted JWT.
2. **Save Node** — `POST /api/sync/push` with a representative 50-node `Map.data` payload. Includes the full lock acquire + version insert + cache write + pub/sub publish path. VU profile: same as scenario 1.
3. **Semantic Search** — `POST /api/search/semantic` with a pre-computed 256d query vector against a seeded set of 5000 embeddings. VU profile: ramp 1 → 100 → 500, hold 2 min.
4. **Collab Join** — WebSocket connect to PartyKit room with valid JWT, send 10 Y.Doc updates / second for 60s, disconnect. VU profile: ramp 1 → 50 concurrent rooms with 5 editors each.
5. **AI Generate** — `POST /api/ai/stream` against a mock OpenAI-compatible endpoint hosted internally (do NOT hit real OpenAI during load tests — burn rate problems). Confirm SSE chunks flow and the proxy doesn't buffer the whole response. VU profile: ramp 1 → 50 concurrent streams.

**Pass/fail criteria per scenario (Tier 2 targets — adjust upward for Tier 3 re-tests):**

| Scenario | p50 | p95 | p99 | Error rate |
|---|---|---|---|---|
| Load Map | < 100 ms | < 300 ms | < 600 ms | < 0.1 % |
| Save Node | < 150 ms | < 400 ms | < 800 ms | < 0.1 % |
| Semantic Search | < 80 ms | < 200 ms | < 500 ms | < 0.5 % |
| Collab Join (echo latency) | < 50 ms | < 150 ms | < 300 ms | < 0.5 % |
| AI Generate (TTFB) | < 500 ms | < 1500 ms | < 3000 ms | < 1 % |

**Baseline storage format** (specify only — do not create the file in this PR):

`docs/architecture/AER-10-load-baseline.md` should contain, per re-test:
```
## Run YYYY-MM-DD HH:MM UTC — <commit sha> — <tier label>
Tool: k6 vX.Y, region: europe-west, VUs ramp: 1 -> 1000 / 5m / hold 2m
Scenario | p50 | p95 | p99 | err% | RPS sustained
Load Map | ... | ... | ... | ... | ...
...
```

One baseline run BEFORE Phase 1, one AFTER each phase. Compare against the previous row to confirm the migration actually paid off.

---

## 8. Observability prerequisites

**Nothing migrates until these exist.** A migration with no telemetry is a blind cutover.

### 8.1 RED metrics per endpoint

Emitted from a single Nitro middleware (`server/middleware/metrics.ts`, to be created) that wraps every event handler:
- `http_requests_total{route, method, status}` — counter
- `http_request_duration_seconds{route, method}` — histogram (buckets: 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000 ms)
- `http_request_errors_total{route, method, status}` — counter for 5xx and 4xx separately

Exposed at `/api/metrics` in Prometheus text format with HTTP basic auth (env-controlled).

### 8.2 Database

- `pg_stat_statements` enabled (Railway managed Postgres supports it via parameter group).
- Slow query log threshold = 100 ms.
- Weekly review of top-20 slowest queries; convert to indexes or read-replica routes.
- Prisma metrics: `prisma.$metrics.json()` exposed via same `/api/metrics` route — gives connection pool saturation, idle vs busy.

### 8.3 Redis

- `INFO` polling every 30s feeding into a few metrics:
  - `redis_used_memory_bytes`
  - `redis_hit_ratio` (computed from `keyspace_hits` / (`keyspace_hits` + `keyspace_misses`))
  - `redis_connected_clients`
  - `redis_pubsub_channels`
- Alert thresholds: hit ratio < 80 % for 1 h, memory > 80 %, clients > 80 % of `maxclients`.

### 8.4 PartyKit / collab

- Custom counter per `MapRoom` instance: `collab_room_connections{role}` and `collab_room_y_updates_total`.
- Periodic POST from each room back to a `/api/collab/metrics` endpoint, aggregated server-side. Same HMAC signing pattern as flush.
- Once self-hosted in Phase 2, native Prometheus from the Bun service.

### 8.5 AI providers

- Per provider counter: `ai_requests_total{provider, model, status}`.
- Per provider histogram: `ai_request_duration_seconds{provider, model}`.
- Per provider cost estimate counter: `ai_estimated_cost_usd{provider, model}` — emitted by parsing `usage` blocks in streaming responses.

### 8.6 Tooling

- **Recommended exporter:** OpenTelemetry SDK in Nitro emitting OTLP/HTTP to Grafana Cloud Free tier (10k series, 50 GB logs, 14-day retention) — covers everything above for $0/mo at Tier 1-2.
- **Alternative:** Better Stack (Logtail + uptime) — slicker UI, ~$10-30/mo, less metric capacity.
- **At Tier 3:** Either pay for Grafana Cloud Pro (~$50-150/mo) or self-host Prometheus + Grafana + Loki on a single $20/mo VPS.

---

## 9. Decision criteria for future triggers

These are mechanical IF/THEN rules. A future self (or collaborator) should be able to execute them without re-reading the whole plan.

- **IF** `sse_concurrent_connections >= 100` sustained 1 week **AND** Railway service CPU > 60 % sustained 24 h **THEN** execute Phase 1.
- **IF** `pg_stat_database.numbackends >= 0.8 * max_connections` sustained 1 day **THEN** add PgBouncer (sub-task of Phase 1) immediately, regardless of other metrics.
- **IF** Phase 1 complete **AND** `p95 sync_push` > 250 ms **AND** Postgres CPU > 70 % **AND** pg_stat_statements top-5 is dominated by reads **THEN** execute Phase 2 read-replica leg.
- **IF** PartyKit monthly cost > $200 **OR** any single map sustains > 30 concurrent editors **OR** Y-update echo p95 > 200 ms **THEN** execute Phase 2 collab leg.
- **IF** server-side embedding RPS > 50/min sustained 1 day **OR** `/api/embeddings` server-embed p95 > 800 ms **THEN** execute Phase 2 GPU embed leg.
- **IF** anybody proposes Kubernetes / service mesh / Elixir rewrite at any point before all three Phase 2 legs are complete and stable **THEN** link them this document and decline politely.
- **IF** Phase 2 stable for 8 weeks **AND** Tier 3 metrics holding **AND** a second backend engineer joins **THEN** open the question of multi-region.

---

## 10. Anti-patterns to refuse

A list of things NOT to do, with the rationale that wins the argument.

- **Don't migrate to k8s "to learn k8s."** Operational burden has zero correlation with user value. Learn k8s on a side project.
- **Don't rewrite hot paths in Rust / Elixir "for performance" without a benchmark that proves Nitro can't keep up.** Single-instance Nitro on Railway handles thousands of req/s for JSON CRUD. We are nowhere near that ceiling. Premature rewrites cost months and ship bugs that the original code spent years burning out.
- **Don't shard Postgres before exhausting read replicas + connection pooling.** Sharding is an order-of-magnitude harder operation than adding a replica. Default to "vertical Postgres + 1-2 replicas" until at least Tier 3.
- **Don't introduce a service mesh (Istio, Linkerd, Consul Connect).** A mesh is a tax on every request and a 6-layer-deep debugging nightmare for a 5-service deployment. Use Railway's internal networking; if we ever need mTLS between services, use cert-manager + manual sidecar wiring rather than installing a control plane.
- **Don't adopt "microservices" for a 1-product app.** Service splits in §6 are operational specialization (CPU-bound vs IO-bound vs long-lived) — NOT domain decomposition. Do not let the inmates run the asylum and start splitting `users` from `auth` from `profiles`.
- **Don't run our own Postgres without an HA story.** Railway-managed PG (or Crunchy / Neon / Supabase at higher tiers) is cheaper than the engineer-hour cost of pager rotations.
- **Don't roll our own pub/sub on top of Postgres LISTEN/NOTIFY.** Redis pub/sub already works, it's wired into `cacheKeys.syncChannel`, and the only reason to switch is if Redis becomes the bottleneck — which it won't at our trajectory.
- **Don't introduce Kafka.** The data we'd put in Kafka (sync events, collab updates) is already in Redis Streams or in the Y.Doc binary in Postgres. Kafka is the right answer for analytical event streams at TB/day; we are not there and never will be at NeuroCanvas's domain.
- **Don't move auth to a third-party (Clerk, Auth0, WorkOS) "for scale."** Our auth surface is small and well-isolated in `server/api/auth/`. The migration cost (data export, user re-onboarding, federated identity reconciliation) dwarfs any operational saving. Re-evaluate only if we ever need enterprise SSO at scale.
- **Don't put the Nuxt app behind Cloudflare Workers / Edge runtimes.** Nitro's Node preset is what the codebase is tested against (`@prisma/adapter-pg`, `bcrypt`, `ioredis`, `@huggingface/transformers`). Edge runtime sacrifices half the dependency tree for cold-start gains that don't matter for an authenticated workspace app.

---

## Appendix A — Audit evidence index

| Finding | Source |
|---|---|
| SSR disabled in Nuxt config | `nuxt.config.ts:13` (`ssr: false`) |
| Single Railway service, Dockerfile-based | `railway.json`, `Dockerfile` |
| onnxruntime-node skipped at build | `Dockerfile:21` (`--ignore-scripts`), `package.json` (`optionalDependencies`) |
| Prisma adapter-pg singleton, no pooler | `server/utils/prisma.ts` |
| Redis used for cache + pub/sub + Streams + locks + rate limit | `server/utils/redis.ts` (entire file) |
| SSE per user via Redis subscribe per request | `server/api/sync/stream.get.ts` |
| Sync push: 6 PG ops + 8 Redis ops per call, distributed lock, 120/min rate limit | `server/api/sync/push.post.ts` |
| AI streaming proxy with SSE re-emission, 30/min rate limit | `server/api/ai/stream.post.ts` |
| pgvector HNSW index (m=16, ef_construction=64) on 256d vectors | `prisma/migrations/20260424_vector_db/migration.sql` |
| PartyKit collab on Cloudflare DOs, JWT + jti revocation check, HMAC flush callback | `partykit/src/server.ts`, `partykit/partykit.json` |
| PartyKit flush debounced 2-10s, persists Y.Doc binary + JSON snapshot | `partykit/src/server.ts:213`, `server/utils/collabFlush.ts` |
| CSRF default-deny middleware in place | `server/middleware/csrf.ts` |
| 74 server routes total | `find server/api -type f \| wc -l` |
| Map.data is full JSON blob upsert on every sync push (whole-document write amplification) | `server/api/sync/push.post.ts:105-128` |
| MapVersion pruned to 20 per Map | `server/api/sync/push.post.ts:152-161` |
| Client-side embedding is the default; server-side is feature-flagged degradation path | `server/api/embeddings/index.post.ts:113-133`, `server/utils/embeddings.ts:isServerEmbeddingAvailable` |
