import type * as Party from 'partykit/server'
import { onConnect, type YPartyKitOptions } from 'y-partykit'
import { verifyConnectionJwt } from './auth'
import { scheduleFlush } from './flush'

interface RoomVars {
  PARTYKIT_JWT_SECRET: string
  FLUSH_URL: string
  PARTYKIT_FLUSH_SECRET: string
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
