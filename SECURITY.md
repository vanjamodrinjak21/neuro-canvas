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
