import { signFlushBody } from './collabAuth'

/**
 * POST a reload request to the PartyKit room. The room broadcasts a
 * `{ type: 'reload', reason }` message and closes connections with code 4002
 * so clients re-fetch Map.ydoc and rebuild the editor against the restored
 * version. Best-effort — failures don't block the restore mutation since the
 * persisted Map.ydoc is already updated.
 */
export async function broadcastReloadToRoom(mapId: string, reason: string): Promise<void> {
  const config = useRuntimeConfig()
  const host = config.public.partykitHost as string
  const secret = config.partykitFlushSecret as string
  if (!host || !secret) return

  const body = JSON.stringify({ reason })
  const sig = signFlushBody(Buffer.from(body), secret)
  const url = `https://${host}/parties/main/${encodeURIComponent(mapId)}/reload`

  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-collab-signature': sig },
    body
  })
}
