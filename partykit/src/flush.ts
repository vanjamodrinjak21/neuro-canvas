import type * as Party from 'partykit/server'
import * as Y from 'yjs'

async function hmacHex(body: ArrayBuffer, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, body)
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Encode the current Y.Doc state and POST to Nitro's /api/collab/flush
 * with HMAC-SHA256 over the body. y-partykit calls this on its debounce.
 * Failures are swallowed — the next debounce tick will retry naturally.
 */
export async function scheduleFlush(party: Party.Party, ydoc: Y.Doc): Promise<void> {
  const flushUrl = (party.context as unknown as { vars: Record<string, string> }).vars.FLUSH_URL
  const secret = (party.context as unknown as { vars: Record<string, string> }).vars.PARTYKIT_FLUSH_SECRET
  if (!flushUrl || !secret) return

  const update = Y.encodeStateAsUpdate(ydoc)
  const buf = update.buffer.slice(update.byteOffset, update.byteOffset + update.byteLength) as ArrayBuffer
  const sig = await hmacHex(buf, secret)

  await fetch(flushUrl, {
    method: 'POST',
    body: buf,
    headers: {
      'content-type': 'application/octet-stream',
      'x-collab-signature': sig,
      'x-collab-mapid': party.id,
      'x-collab-author': ''
    }
  }).catch(() => { /* swallow; next debounce will retry */ })
}
