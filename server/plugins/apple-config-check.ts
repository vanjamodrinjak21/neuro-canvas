// Boot-time diagnostic for Sign in with Apple (web / Services ID flow).
//
// Apple's token endpoint rejects the client-secret JWT with `invalid_client`
// when any of these don't match what's registered at developer.apple.com:
//   - APPLE_CLIENT_ID   the **Services ID** (e.g. com.neurocanvas.signin) — NOT
//                       the app Bundle ID. Used as the JWT `sub` + OAuth client_id.
//   - APPLE_TEAM_ID     the 10-char Apple Team ID (JWT `iss`).
//   - APPLE_KEY_ID      the 10-char Key ID of the .p8 (JWT header `kid`) — must
//                       correspond to APPLE_PRIVATE_KEY.
//   - APPLE_PRIVATE_KEY the .p8 "Sign in with Apple" key for that Key ID; the
//                       Services ID must have the domain + return URL verified
//                       (return URL: https://neuro-canvas.com/api/auth/callback/apple).
//
// These live in the Railway env, not the repo, so this prints the deployed
// (non-secret) IDs to the boot log so a mismatch is obvious. It never logs the
// private key body and never throws.
const APPLE_ID_RE = /^[A-Z0-9]{10}$/

export default defineNitroPlugin(() => {
  if ((process.env.NODE_ENV || '') !== 'production') return

  const clientId = process.env.APPLE_CLIENT_ID || ''
  const teamId = process.env.APPLE_TEAM_ID || ''
  const keyId = process.env.APPLE_KEY_ID || ''
  const privateKey = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  // Apple not configured → provider is skipped, nothing to diagnose.
  if (!clientId && !teamId && !keyId && !privateKey) return

  const problems: string[] = []
  if (!clientId) problems.push('APPLE_CLIENT_ID is empty.')
  else if (!clientId.includes('.')) problems.push(`APPLE_CLIENT_ID "${clientId}" is not a reverse-DNS Services ID — did you set the app Bundle ID by mistake?`)
  if (!teamId) problems.push('APPLE_TEAM_ID is empty.')
  else if (!APPLE_ID_RE.test(teamId)) problems.push(`APPLE_TEAM_ID "${teamId}" is not a 10-char Team ID.`)
  if (!keyId) problems.push('APPLE_KEY_ID is empty.')
  else if (!APPLE_ID_RE.test(keyId)) problems.push(`APPLE_KEY_ID "${keyId}" is not a 10-char Key ID.`)
  if (!privateKey) problems.push('APPLE_PRIVATE_KEY is empty.')
  else if (!privateKey.includes('BEGIN PRIVATE KEY')) problems.push('APPLE_PRIVATE_KEY does not look like a PEM .p8 (missing "BEGIN PRIVATE KEY").')

  console.info(
    [
      '[apple-config] Sign in with Apple — deployed values (verify against developer.apple.com):',
      `  APPLE_CLIENT_ID (Services ID): ${clientId || '<empty>'}`,
      `  APPLE_TEAM_ID:                 ${teamId || '<empty>'}`,
      `  APPLE_KEY_ID:                  ${keyId || '<empty>'}`,
      `  APPLE_PRIVATE_KEY:             ${privateKey ? `present (PEM, ${privateKey.length} chars)` : '<empty>'}`,
      '  Apple returns invalid_client at the token step if any of these do not',
      '  match the .p8 key + Services ID registered in the portal.',
      ...(problems.length ? ['  Problems detected:', ...problems.map(p => `    - ${p}`)] : []),
    ].join('\n'),
  )
})
