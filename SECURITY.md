# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security bugs. Email the maintainers privately at the address listed on the project's contact page, or file a private GitHub Security Advisory on this repository.

Include, where possible:

- A clear description of the issue
- Affected versions / commit hash
- Reproduction steps or proof-of-concept
- Suggested mitigation, if any

We aim to acknowledge reports within 72 hours and to ship a fix or mitigation within 30 days for high-severity issues.

## Scope

In scope:

- The web application (`app/`, `server/`)
- Real-time collab server (`partykit/`)
- Native shells (Tauri, Capacitor)
- Database schema / migrations (`prisma/`)

Out of scope:

- Self-hosted instances configured insecurely (e.g. running with default `AUTH_SECRET`)
- Third-party dependencies (please report upstream and CC us)
- Social engineering, physical attacks

## Handling secrets

If you believe a secret has been committed:

1. **Do not** publicly disclose the file path or value.
2. Rotate the affected credential immediately.
3. Contact maintainers so the secret can be purged from history.

This repository ignores `.env`, `.env.local`, `*.dump`, `*.sql.gz`, and similar patterns by default. The only env file checked in is `.env.example`, which contains placeholders only.

## Dependency risk register

Known `npm audit` findings we have reviewed and accepted, with rationale (last reviewed 2026-07-01):

| Advisory chain | Severity | Reach | Rationale |
| --- | --- | --- | --- |
| `undici` ≤6.26.0 via `miniflare` → `partykit` | High | **Dev only** | Only loaded by the PartyKit CLI for local collab dev/deploy; never bundled into the production server. Waiting on upstream `partykit` to bump `miniflare`. |
| `esbuild` dev-server advisories via `partykit`, `@eslint/config-inspector` | Moderate | Dev only | Affects the esbuild *dev server*, which we never expose; build-only usage here. |
| `@hono/node-server` via `@prisma/dev` → `prisma` | Moderate | Dev only | Prisma CLI development tooling; not part of the runtime `@prisma/client`. |
| `uuid` <11.1.1 via `next-auth@4` | Moderate | Runtime | Advisory requires calling uuid v3/v5/v6 with a caller-supplied `buf`; next-auth only generates v4 ids without `buf`. Real fix is the next-auth v5 (Auth.js) migration, tracked separately. `npm audit fix --force` would downgrade to next-auth 3 — rejected. |

Re-run `npm audit --omit=dev` before each release; anything new that is production-reachable must be fixed or added here with rationale before shipping.
