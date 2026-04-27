import type * as Party from 'partykit/server'
import { onConnect, type YPartyKitOptions } from 'y-partykit'
import { verifyConnectionJwt } from './auth'
import { scheduleFlush } from './flush'

interface RoomVars {
  PARTYKIT_JWT_SECRET: string
  FLUSH_URL: string
  PARTYKIT_FLUSH_SECRET: string
}

async function hmacHex(body: ArrayBuffer | string, secret: string): Promise<string> {
  const buf = typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, buf)
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default class MapRoom implements Party.Server {
  constructor(public party: Party.Party) {}

  async onBeforeConnect(req: Party.Request) {
    const url = new URL(req.url)
    const token = url.searchParams.get('token') || ''
    const vars = (this.party.context as unknown as { vars: RoomVars }).vars
    try {
      const payload = await verifyConnectionJwt(token, vars.PARTYKIT_JWT_SECRET, this.party.id)
      req.headers.set('x-collab-role', payload.role)
      req.headers.set('x-collab-session', payload.sessionId)
      return req
    } catch {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  async onRequest(req: Party.Request) {
    // /parties/main/<mapId>/{kick,reload} — Nitro broadcasts these on
    // share revocation and version restore respectively.
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const url = new URL(req.url)
    const isKick = url.pathname.endsWith('/kick')
    const isReload = url.pathname.endsWith('/reload')
    if (!isKick && !isReload) return new Response('Not found', { status: 404 })

    const vars = (this.party.context as unknown as { vars: RoomVars }).vars
    const sig = req.headers.get('x-collab-signature') || ''
    const body = await req.text()
    const expected = await hmacHex(body, vars.PARTYKIT_FLUSH_SECRET)
    if (sig !== expected) return new Response('Unauthorized', { status: 401 })

    if (isReload) {
      // Notify clients to re-fetch Map.ydoc (version restored), then close
      // sockets so y-partykit doesn't rebroadcast the now-stale state vector.
      const reason = (() => {
        try { return (JSON.parse(body) as { reason?: string }).reason ?? 'reload' }
        catch { return 'reload' }
      })()
      for (const conn of this.party.getConnections()) {
        try { conn.send(JSON.stringify({ type: 'collab:reload', reason })) } catch { /* ignore */ }
        conn.close(4002, 'Version restored — reloading')
      }
      return new Response('ok')
    }

    // Kick: see comment in original implementation — closing all conns is
    // simple and correct since clients will re-mint and validate against
    // Postgres on reconnect.
    for (const conn of this.party.getConnections()) {
      conn.close(4001, 'Share token revoked — please reload')
    }
    return new Response('ok')
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const role = ctx.request.headers.get('x-collab-role') || 'viewer'
    // Commenters do not (yet) get write access to the canvas Y.Doc — they
    // post via the REST /api/maps/:id/comments endpoints. Per-Y.Map gating
    // (commenters writing only the `comments` Y.Map) is a follow-up.
    const opts: YPartyKitOptions = {
      readOnly: role !== 'editor',
      callback: {
        handler: async (yDoc) => {
          await scheduleFlush(this.party, yDoc)
        },
        debounceWait: 2000,
        debounceMaxWait: 10000
      }
    }
    return onConnect(conn, this.party, opts)
  }
}
