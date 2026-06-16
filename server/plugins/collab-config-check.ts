// Boot-time sanity check for the real-time collaboration (PartyKit) secrets.
//
// Collab auth is split across two deployments — Nitro MINTS the JWT and
// PartyKit VERIFIES it — so the #1 production failure is a missing or
// mismatched `PARTYKIT_JWT_SECRET`: token mint succeeds, then every collab
// WebSocket fails PartyKit verification with a silent 401.
//
// The actual values live in the deploy environment (Railway env + PartyKit
// secrets), not the repo, so all Nitro can assert is that ITS side is
// plausibly configured — set, and not the `set-via-secrets` placeholder that
// ships in partykit/partykit.json. A loud warning at startup beats chasing a
// 401 in the field. This logs only; it never throws.

// The placeholder committed in partykit/partykit.json `vars`. If this value
// reaches a real secret, someone forgot to run `partykit secret put`.
const PLACEHOLDER = 'set-via-secrets'

export default defineNitroPlugin(() => {
  // Only nag in production — local dev often runs without PartyKit at all.
  if ((process.env.NODE_ENV || '') !== 'production') return

  const config = useRuntimeConfig()
  const jwtSecret = (config.partykitJwtSecret as string) || ''
  const flushSecret = (config.partykitFlushSecret as string) || ''
  const host = ((config.public as { partykitHost?: string })?.partykitHost) || ''

  const issues: string[] = []

  if (!jwtSecret) {
    issues.push('PARTYKIT_JWT_SECRET is empty — /api/collab/token will 500 and collab cannot start.')
  } else if (jwtSecret === PLACEHOLDER) {
    issues.push(`PARTYKIT_JWT_SECRET is still the "${PLACEHOLDER}" placeholder — set a real secret on both sides.`)
  } else if (jwtSecret.length < 16) {
    issues.push(`PARTYKIT_JWT_SECRET is only ${jwtSecret.length} chars — use a long random value (32+).`)
  }

  if (!flushSecret) {
    issues.push('PARTYKIT_FLUSH_SECRET is empty — collab flush + revocation (kick / jti-check) will not work.')
  } else if (flushSecret === PLACEHOLDER) {
    issues.push(`PARTYKIT_FLUSH_SECRET is still the "${PLACEHOLDER}" placeholder — set a real secret on both sides.`)
  }

  if (!host) {
    issues.push('NUXT_PUBLIC_PARTYKIT_HOST is empty — the client receives an empty wsUrl and never connects.')
  }

  if (issues.length === 0) return

  console.warn(
    [
      '[collab-config] Real-time collaboration is misconfigured:',
      ...issues.map(i => `  - ${i}`),
      '  These secrets must be byte-identical on BOTH sides:',
      '    Nitro/Railway env:  PARTYKIT_JWT_SECRET, PARTYKIT_FLUSH_SECRET',
      '    PartyKit secrets:   cd partykit && npx partykit secret put PARTYKIT_JWT_SECRET',
      '  A mismatch makes every collab WebSocket fail verification with 401.',
    ].join('\n'),
  )
})
