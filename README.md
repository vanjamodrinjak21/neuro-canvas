<div align="center">

```
███╗   ██╗███████╗██╗   ██╗██████╗  ██████╗  ██████╗ █████╗ ███╗   ██╗██╗   ██╗ █████╗ ███████╗
████╗  ██║██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔════╝██╔══██╗████╗  ██║██║   ██║██╔══██╗██╔════╝
██╔██╗ ██║█████╗  ██║   ██║██████╔╝██║   ██║██║     ███████║██╔██╗ ██║██║   ██║███████║███████╗
██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗██║   ██║██║     ██╔══██║██║╚██╗██║╚██╗ ██╔╝██╔══██║╚════██║
██║ ╚████║███████╗╚██████╔╝██║  ██║╚██████╔╝╚██████╗██║  ██║██║ ╚████║ ╚████╔╝ ██║  ██║███████║
╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝  ╚═══╝  ╚═╝  ╚═╝╚══════╝
```

### **Think in maps. Build with AI. Collaborate at the speed of thought.**

A real-time, multi-platform mind-mapping studio that turns scattered ideas into structured knowledge — with an AI co-pilot that thinks alongside you.

[**Web**](https://neuro-canvas.com) · [**Desktop**](https://github.com/vanjamodrinjak21/neuro-canvas/releases) · [**iOS**](https://github.com/vanjamodrinjak21/neuro-canvas/releases) · [**Android**](https://github.com/vanjamodrinjak21/neuro-canvas/releases) · [**Docs**](https://neuro-canvas.com/docs)

[![Status](https://img.shields.io/badge/status-active%20development-success)](https://github.com/vanjamodrinjak21/neuro-canvas)
[![Made with Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt.js&logoColor=white)](https://nuxt.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CRDT](https://img.shields.io/badge/CRDT-Yjs%20%2B%20PartyKit-7C3AED)](https://partykit.io/)
[![pgvector](https://img.shields.io/badge/RAG-pgvector%20%2B%20ONNX-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)

</div>

---

## Why NeuroCanvas?

> *"Most note-taking apps want you to **store** thoughts. NeuroCanvas wants you to **grow** them."*

Mind-mapping has been stuck in 2008. Static trees. Lonely canvases. AI tools that generate paragraphs of slop instead of helping you **think**.

NeuroCanvas is built around three convictions:

| | |
|---|---|
| **1. Thinking is spatial.** | Ideas have neighbors. Maps reveal them. |
| **2. AI should be a sparring partner, not a vending machine.** | Expand a node. Branch into counter-arguments. Find the missing piece. |
| **3. Knowledge compounds when it's connected.** | Every node you draw becomes part of a personal vector index. The more you map, the smarter your future maps get. |

It runs everywhere you do — web, native desktop, iOS, Android — and it does so without compromise on speed, polish, or privacy.

---

## What it does

- **Infinite canvas** with smart snapping, multi-select, keyboard-first navigation, and a live minimap that actually keeps up with you.
- **AI-powered ideation.** Click any node and ask the AI to expand it, find counter-arguments, summarize a subtree, or generate an entire map from a one-line prompt. Multi-provider: **Anthropic, OpenAI, OpenRouter** — your keys, server-side encrypted vault, never in the browser.
- **True real-time collaboration** via **Yjs CRDT + PartyKit**. No "merge conflict" dialogs, no last-writer-wins. Edits are conflict-free at the data structure level. Roles: viewer / commenter / editor.
- **Semantic recall.** Every node is embedded with `nomic-embed-text-v1.5` (256-d) and indexed in **pgvector** with HNSW. Ask *"where did I write about X?"* and get exact hits across every map you've ever made — locally on desktop via ONNX runtime, server-side everywhere else.
- **Offline-first on desktop.** Tauri + bundled ONNX model = a local LLM that works on a plane.
- **Bilingual at the core.** EN and HR are first-class — UI, docs, and AI prompts are locale-aware. Croatian isn't bolted on; it's a peer.
- **Native shells, single codebase.** Web (Nuxt), Desktop (Tauri 2 / Rust), iOS + Android (Capacitor 8). One canvas engine, four platforms.

---

## A typical session

```
1.  You sketch a rough map of a new idea — five nodes.
2.  You select the root and type:  "expand into the 5 hardest objections"
3.  AI streams 5 counter-argument nodes in your style and language.
4.  You drag a colleague into the share modal — viewer, commenter, or editor.
5.  Their cursor appears live.  You're now thinking together, in real time.
6.  A week later, you're on a different map.  You search "objection".
7.  Semantic search surfaces the original node.  You drag it onto the new canvas.
8.  Knowledge — connected.
```

---

## Under the hood

```
                              ┌────────────────────────────┐
                              │     Nuxt 4 / Vue 3 SPA      │
                              │   (web · Tauri · Capacitor) │
                              └──────┬──────────────┬───────┘
                                     │              │
                          HTTPS (Zod-validated)     │ WebSocket (Yjs)
                                     │              │
                              ┌──────▼──────┐  ┌────▼─────────┐
                              │   Nitro     │  │   PartyKit   │
                              │   server    │  │   (y-partykit)│
                              │  · Auth     │  │   HMAC-JWT    │
                              │  · Vault    │  │   presence    │
                              │  · RAG      │  └────┬─────────┘
                              └──────┬──────┘       │
                                     │  debounced flush
                ┌────────────────────┼──────────────┘
                │                    │
        ┌───────▼────────┐   ┌───────▼────────┐   ┌──────────────┐
        │  PostgreSQL    │   │     Redis      │   │  AI Vault    │
        │   + pgvector   │   │  cache · rate  │   │  (AES-GCM)   │
        │   (HNSW · 256d)│   │   limits · pub │   │  per-user    │
        └────────────────┘   └────────────────┘   └──────────────┘
```

Every layer is **boundary-validated** with Zod. Every secret is **server-side**. Every collab session is **JWT-gated**. Every Vue component is **TypeScript-strict** with no `any` escape hatch.

---

## Stack at a glance

```
Frontend     Nuxt 4 · Vue 3 · TypeScript (strict) · UnoCSS · Nuxt Content · @nuxtjs/i18n v10
Backend      Nitro · Prisma 7 · PostgreSQL · Redis · @sidebase/nuxt-auth (JWT, 6h)
Realtime     Yjs CRDT · PartyKit (y-partykit) · HMAC-signed presence JWTs
AI           Anthropic · OpenAI · OpenRouter · per-user AES-GCM vault
RAG          pgvector (HNSW) · nomic-embed-text-v1.5 (256d) · ONNX Runtime
Native       Tauri 2 (Rust) · Capacitor 8 (Swift / Kotlin)
Tooling      ESLint flat config · Vitest + happy-dom · Conventional Commits
CI/CD        GitHub Actions — lint, typecheck, test, build, multi-platform release
```

---

## Run it locally

```bash
git clone https://github.com/vanjamodrinjak21/neuro-canvas.git
cd neuro-canvas

npm install                     # postinstall: prisma generate + nuxt prepare
cp .env.example .env            # then fill in real values
npx prisma migrate deploy

npm run dev                     # → http://localhost:3000
```

**Requirements:** Node 20+, PostgreSQL with `pgvector`, Redis. For native shells: Xcode 15+ (iOS), Android Studio + JDK 17 (Android), Rust stable (Tauri).

---

## Download the app (beta)

Pre-built desktop bundles are published to [**Releases**](https://github.com/vanjamodrinjak21/neuro-canvas/releases) on every push to `main`:

- **macOS** (Apple Silicon) — `NeuroCanvas_*_aarch64.dmg`
- **Windows** (x86_64) — `NeuroCanvas_*_x64-setup.exe` / `.msi`

> Beta builds are **unsigned** — production code-signing & Apple notarization are reserved for tagged releases. The first launch will trigger an OS warning. Open as follows:

**macOS — first-launch fix.** Apple's Gatekeeper blocks unsigned apps and may also report the bundle as "damaged." Strip the quarantine attribute once and it'll open every time after:

```bash
# After dragging NeuroCanvas.app to /Applications
xattr -cr /Applications/NeuroCanvas.app
open /Applications/NeuroCanvas.app
```

Alternatively: right-click `NeuroCanvas.app` → **Open** → confirm in the dialog. macOS remembers the choice.

**Windows — SmartScreen.** The installer runs as-is. On first launch, Microsoft Defender SmartScreen may show *"Windows protected your PC"*: click **More info** → **Run anyway**. Subsequent launches open silently.

**Linux & iOS / Android.** Native packaging for these platforms ships with the public 1.0 launch — see the [Roadmap](#roadmap).

---

## Scripts you'll use

```bash
# Daily
npm run dev                  # Nuxt dev server
npm run typecheck            # nuxt typecheck
npm run lint                 # ESLint
npm run test                 # Vitest (run mode)

# Database
npm run db:push              # Prisma push (dev)
npm run db:migrate           # Prisma migrate deploy (prod)
npm run db:studio            # Prisma Studio

# Native
npm run tauri:dev            # Desktop dev
npm run cap:sync             # Sync web build → native shells
npm run cap:ios              # Open in iOS sim
npm run cap:android          # Open in Android emulator

# Versioning + release
npm run version:bump 1.2.3 -- --tag    # bump + tag → triggers multi-platform release workflow
```

---

## Roadmap

| Phase | Status | What |
|---|---|---|
| **1** | ✅ Shipped | Y.Doc backbone — schema, converter, HMAC auth |
| **2** | ✅ Shipped | PartyKit realtime + JWT presence |
| **3** | ✅ Shipped | Share CRUD + role-based access |
| **4** | ✅ Shipped | `mapStore` ↔ Y.Doc bridge |
| **5** | 🔜 Next | **Desktop release pipeline** — code-signed Tauri builds for macOS (notarized), Windows (Authenticode), and Linux (AppImage + .deb), shipped through a single tag-triggered GitHub Actions workflow with auto-update channels |
| **6** | 🔜 Next | **Public REST + WebSocket API** — stable, versioned endpoints for maps, nodes, embeddings, and live collab; OpenAPI 3.1 spec, scoped API tokens, and a generated TypeScript SDK so third-party tools can read, write, and listen to canvases |

---

## Performance principles

- **60fps or it didn't ship.** Canvas pan/zoom uses GPU-composited transforms; no per-frame layout reads.
- **Render only what's visible.** Off-screen nodes are virtualised. A 5,000-node map runs as smoothly as a 50-node one.
- **Real-time without the lag.** PartyKit edge nodes keep latency under 60ms for 95% of sessions.
- **Offline doesn't mean "broken."** Tauri ships with the model. The mobile shell ships with IndexedDB-backed sync.

---

## Security stance

> The cheapest bug is the one that never made it past code review.

- All AI provider keys live in a **per-user AES-GCM vault** — never the client, never logs, never URLs.
- Every API route is **auth-gated by default**; public routes are explicit, listed in `server/middleware/`.
- **Zod at every boundary.** Rate-limited where it matters.
- Realtime channels are **HMAC-JWT** scoped to (share, role, expiry).
- Routine secret-scan + dependency audit in CI; vulnerability disclosure handled privately.

Found something? **Don't open a public issue** — see the contact note at the bottom.

---

## Philosophy

NeuroCanvas is opinionated software. It assumes:

- You'd rather **see** an idea than read a paragraph about it.
- AI should **disappear** when you're flowing and **show up** when you're stuck.
- Latency is a feature. Polish is a feature. Typography is a feature.
- Tools shape thought. We're trying to shape it well.

We don't build for the median user. We build for the person who wants their tools to *keep up with* their thinking — not the other way around.

---

## License

**Proprietary — all rights reserved.** No part of this project may be copied, modified, distributed, or reused without explicit written permission. Commercial inquiries welcome.

---

<div align="center">

**Built by [Vanja Modrinjak](https://github.com/vanjamodrinjak21)**

*Croatia → the world.*

</div>
