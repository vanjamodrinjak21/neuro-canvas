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
    // /parties/main/<mapId>/kick — Nitro broadcasts this when a share is revoked.
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const url = new URL(req.url)
    if (!url.pathname.endsWith('/kick')) return new Response('Not found', { status: 404 })

    const vars = (this.party.context as unknown as { vars: RoomVars }).vars
    const sig = req.headers.get('x-collab-signature') || ''
    const body = await req.text()
    const expected = await hmacHex(body, vars.PARTYKIT_FLUSH_SECRET)
    if (sig !== expected) return new Response('Unauthorized', { status: 401 })

    // We don't store the share-token -> session-id mapping in the room (it lives
    // in the JWT only). Closing every connection is heavier than necessary but
    // simple and correct: each client will re-mint its JWT, hit /api/collab/token,
    // and either get a fresh JWT (link still valid) or a 410 (link revoked).
    for (const conn of this.party.getConnections()) {
      conn.close(4001, 'Share token revoked — please reload')
    }
    return new Response('ok')
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const role = ctx.request.headers.get('x-collab-role') || 'viewer'
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
