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

/**
 * POST the restored snapshot to the PartyKit room so it reconciles its live
 * Y.Doc in place. y-partykit broadcasts the resulting delta to every connected
 * client, so collaborators converge to the restored state without reloading,
 * and the room's in-memory doc (which Postgres can't reach) stops serving the
 * pre-restore state on reconnect. Best-effort: the persisted Map.ydoc is
 * already updated, so a PartyKit hiccup self-heals once the room rebuilds.
 */
export async function broadcastRestoreToRoom(mapId: string, snapshot: unknown): Promise<void> {
  const config = useRuntimeConfig()
  const host = config.public.partykitHost as string
  const secret = config.partykitFlushSecret as string
  if (!host || !secret) return

  const body = JSON.stringify(snapshot)
  const sig = signFlushBody(Buffer.from(body), secret)
  const url = `https://${host}/parties/main/${encodeURIComponent(mapId)}/restore`

  // Bounded await: the restore endpoint waits on this so the owner's reload
  // reconnects to reconciled room state, but a slow/down PartyKit must never
  // hang the restore — the persisted Map.ydoc is already authoritative.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3000)
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-collab-signature': sig },
      body,
      signal: ctrl.signal
    })
  } finally {
    clearTimeout(timer)
  }
}
