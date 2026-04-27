# NeuroCanvas

AI-powered mind mapping for the web, desktop (Tauri), and mobile (Capacitor — iOS / Android), with real-time collaboration via Yjs + PartyKit.

## Stack

- **Frontend:** Nuxt 4 (Vue 3, TypeScript strict), UnoCSS, Nuxt Content, @nuxtjs/i18n (EN / HR)
- **Backend:** Nitro (Nuxt server), Prisma 7 + PostgreSQL, Redis, @sidebase/nuxt-auth (JWT)
- **Real-time:** Yjs CRDT + PartyKit (y-partykit), HMAC-signed JWT presence
- **AI:** Multi-provider (Anthropic, OpenAI, OpenRouter) with server-side credential vault
- **Vector / RAG:** pgvector (256-d nomic-embed-text), HNSW; ONNX runtime in Tauri
- **Native shells:** Tauri 2 (desktop), Capacitor 8 (iOS / Android)
- **Testing:** Vitest + happy-dom (`*.test.ts` colocated in `__tests__/`)
- **Deploy:** Docker on Railway

## Requirements

- Node.js >= 20
- PostgreSQL (with pgvector extension if using embeddings)
- Redis
- For mobile builds: Xcode 15+ (iOS), Android Studio + JDK 17 (Android)
- For desktop builds: Rust toolchain

## Setup

```bash
git clone <repo-url>
cd NeuroCanvas
npm install                     # runs prisma generate + nuxt prepare via postinstall
cp .env.example .env            # then fill in real values
npx prisma migrate deploy
npm run dev                     # http://localhost:3000
```

## Environment

Copy `.env.example` to `.env` and populate. Required keys:

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | 256-bit JWT secret (`openssl rand -hex 32`) |
| `AUTH_ORIGIN` | Public origin (e.g. `https://app.example.com`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `RESEND_API_KEY` | Transactional email |
| `EMAIL_FROM` | From address |
| `NUXT_PUBLIC_COLLAB_ENABLED` | `true` to enable real-time collab |
| `PARTYKIT_FLUSH_SECRET` | Server → PartyKit flush HMAC |
| `PARTYKIT_JWT_SECRET` | PartyKit presence JWT secret |
| `NUXT_PUBLIC_PARTYKIT_HOST` | e.g. `nc-collab.<you>.partykit.dev` |

**Never commit `.env`, `.env.local`, or any `.env.*` file other than `.env.example`.** They are gitignored.

## Scripts

```bash
npm run dev          # Nuxt dev server
npm run build        # Production build
npm run start        # Run built server
npm run typecheck    # nuxt typecheck
npm run lint         # ESLint
npm run test         # Vitest (run mode)
npm run test:watch   # Vitest watch

npm run db:push      # Prisma push (dev)
npm run db:migrate   # Prisma migrate deploy (prod)
npm run db:studio    # Prisma Studio

npm run tauri:dev    # Desktop dev
npm run cap:sync     # Sync web build → native shells
npm run cap:ios      # Run on iOS
npm run cap:android  # Run on Android
```

## Layout

```
app/                Nuxt client — pages, components, composables, stores
server/             Nitro server — API routes, middleware, utilities
prisma/             Schema, migrations, seed
partykit/           Real-time collab server
content/docs/       User-facing docs (Nuxt Content, EN / HR)
plugins/            Native plugins (Capacitor + Tauri local LLM)
i18n/locales/       Translation bundles (en/, hr/)
android/, ios/      Capacitor native projects (config tracked, build outputs ignored)
src-tauri/          Tauri (Rust) project
```

## Security

- All secrets are server-side. AI provider keys live in an encrypted vault keyed per user.
- Auth required on every API route except explicit public ones (see `server/middleware/`).
- Validation via Zod at every request boundary.
- Real-time channel is JWT-gated (HMAC); shares enforce role (viewer / commenter / editor).
- Never put credentials in URLs, logs, or client-side state.

Report vulnerabilities privately — do not open public issues for security bugs. See [`SECURITY.md`](./SECURITY.md).

## License

Proprietary — all rights reserved unless a `LICENSE` file states otherwise.
