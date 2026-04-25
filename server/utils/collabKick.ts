import { signFlushBody } from './collabAuth'

/**
 * POST a kick request to the PartyKit room. PartyKit's onRequest handler
 * resolves the share token to a session id and closes any matching
 * connections so a revoked invitee can't keep editing.
 *
 * Best-effort: failures are swallowed by the caller. PartyKit will also
 * naturally re-mint tokens against Postgres state at the next 1-hour TTL,
 * so a missed kick at most leaves a stale connection live for ~1 hour.
 */
export async function kickShareFromRoom(mapId: string, shareToken: string): Promise<void> {
  const config = useRuntimeConfig()
  const host = config.public.partykitHost as string
  const secret = config.partykitFlushSecret as string
  if (!host || !secret) return

  const body = JSON.stringify({ shareToken })
  const sig = signFlushBody(Buffer.from(body), secret)
  const url = `https://${host}/parties/main/${encodeURIComponent(mapId)}/kick`

  await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-collab-signature': sig
    },
    body
  })
}
