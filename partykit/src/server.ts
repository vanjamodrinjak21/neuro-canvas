import type * as Party from 'partykit/server'
import { onConnect, unstable_getYDoc, type YPartyKitOptions } from 'y-partykit'
import { verifyConnectionJwt } from './auth'
import { scheduleFlush } from './flush'
import { applyRestoreSnapshot, type RestoreSnapshot } from './restore'

interface RoomVars {
  PARTYKIT_JWT_SECRET: string
  FLUSH_URL: string
  PARTYKIT_FLUSH_SECRET: string
  // Optional comma-separated list of allowed WebSocket origins, e.g.
  // "https://neuro-canvas.com,https://app.neuro-canvas.com,http://localhost:3000"
  // If unset, the origin check is skipped (dev convenience). Set this in
  // PartyKit secrets for prod.
  ALLOWED_ORIGINS?: string
  // Optional Nitro endpoint that confirms a jti is still in the
  // allowlist. If set, every connect performs a quick HTTPS check so
  // tokens revoked between mint and reconnect are denied immediately.
  // Derived from FLUSH_URL when unset.
  JTI_CHECK_URL?: string
}

interface ConnectionState {
  role: 'viewer' | 'commenter' | 'editor'
  sessionId: string
  userId: string | null
  shareToken: string | null
  jti: string | null
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

// Constant-time string compare. Length check first, then bitwise OR over chars
// so a partial match doesn't short-circuit.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function parseOrigins(raw: string | undefined): Set<string> | null {
  if (!raw) return null
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
}

/**
 * Verify the jti is still in Nitro's Redis allowlist. Returns true on
 * a confirmed valid response, false on a confirmed revocation. Network
 * / signature errors fail open (return true) so a brief Nitro outage
 * doesn't kick every collaborator — the JWT exp + signature checks are
 * still binding.
 */
async function isJtiStillValid(
  jti: string,
  flushUrl: string,
  flushSecret: string,
  jtiCheckUrl: string | undefined,
): Promise<boolean> {
  if (!jti) return true
  const checkUrl = jtiCheckUrl
    || flushUrl.replace(/\/api\/collab\/flush\/?$/, '/api/collab/jti-check')
  if (!checkUrl) return true
  try {
    const body = JSON.stringify({ jti })
    const sig = await hmacHex(body, flushSecret)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-collab-signature': sig },
      body,
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return true
    const json = await res.json() as { valid?: boolean }
    return json.valid === true
  } catch {
    return true
  }
}

export default class MapRoom implements Party.Server {
  constructor(public party: Party.Party) {}

  async onBeforeConnect(req: Party.Request) {
    const vars = (this.party.context as unknown as { vars: RoomVars }).vars
    const url = new URL(req.url)
    const token = url.searchParams.get('token') || ''

    // Origin check — WebSockets bypass CORS, so a malicious site that
    // managed to obtain a token via XSS/postMessage could otherwise open
    // a socket from any origin. Reject unknown origins when configured.
    const allowed = parseOrigins(vars.ALLOWED_ORIGINS)
    if (allowed) {
      const origin = req.headers.get('origin') || ''
      if (!allowed.has(origin)) {
        return new Response('Forbidden origin', { status: 403 })
      }
    }

    try {
      const payload = await verifyConnectionJwt(token, vars.PARTYKIT_JWT_SECRET, this.party.id)

      // Redis-backed revocation check: a token that was minted minutes
      // ago but has since been revoked (share deleted, password changed,
      // user signed out) gets denied here instead of surviving until the
      // JWT's natural exp. Fails open on network errors.
      if (payload.jti) {
        const valid = await isJtiStillValid(
          payload.jti,
          vars.FLUSH_URL,
          vars.PARTYKIT_FLUSH_SECRET,
          vars.JTI_CHECK_URL,
        )
        if (!valid) return new Response('Revoked', { status: 401 })
      }

      // Stash claims on request headers so onConnect can lift them into
      // per-connection state (PartyKit's only safe handoff path).
      req.headers.set('x-collab-role', payload.role)
      req.headers.set('x-collab-session', payload.sessionId)
      if (payload.userId) req.headers.set('x-collab-user', payload.userId)
      if (payload.shareToken) req.headers.set('x-collab-share', payload.shareToken)
      if (payload.jti) req.headers.set('x-collab-jti', payload.jti)
      return req
    } catch {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  async onRequest(req: Party.Request) {
    // /parties/main/<mapId>/{kick,reload,restore} — Nitro broadcasts these on
    // share revocation, user sign-out, password change, and version restore.
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
    const url = new URL(req.url)
    const isKick = url.pathname.endsWith('/kick')
    const isReload = url.pathname.endsWith('/reload')
    const isRestore = url.pathname.endsWith('/restore')
    if (!isKick && !isReload && !isRestore) return new Response('Not found', { status: 404 })

    const vars = (this.party.context as unknown as { vars: RoomVars }).vars
    const sig = req.headers.get('x-collab-signature') || ''
    const body = await req.text()
    const expected = await hmacHex(body, vars.PARTYKIT_FLUSH_SECRET)
    if (!timingSafeEqual(sig, expected)) return new Response('Unauthorized', { status: 401 })

    if (isRestore) {
      // Reconcile the *live* room doc to the restored snapshot. y-partykit keeps
      // this doc in memory for the room's lifetime, so rewriting Map.ydoc in
      // Postgres alone never reverts it — clients would just re-sync to the
      // stale newer state. Mutating it here broadcasts the delta to every
      // connected client and updates the canonical in-memory doc.
      let snap: RestoreSnapshot
      try {
        snap = JSON.parse(body) as RestoreSnapshot
      } catch {
        return new Response('Bad request', { status: 400 })
      }
      try {
        const doc = await unstable_getYDoc(this.party, this.docOptions())
        applyRestoreSnapshot(doc, snap)
      } catch (e) {
        console.error('[collab] live restore reconcile failed', e)
        return new Response('Restore failed', { status: 500 })
      }
      return new Response('ok')
    }

    if (isReload) {
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

    // Kick — scoped to a specific shareToken, userId, or jti so revoking
    // one share doesn't disconnect every collaborator (including the owner).
    // Empty body / missing match keys → kick everyone (legacy fallback).
    let target: { shareToken?: string; userId?: string; jti?: string } = {}
    try { target = JSON.parse(body) as typeof target } catch { /* empty body OK */ }

    const all = this.party.getConnections<ConnectionState>()
    let closed = 0
    for (const conn of all) {
      const state = conn.state || null
      const matchesShare = target.shareToken && state?.shareToken === target.shareToken
      const matchesUser = target.userId && state?.userId === target.userId
      const matchesJti = target.jti && state?.jti === target.jti
      const matchAny = matchesShare || matchesUser || matchesJti
      const noTarget = !target.shareToken && !target.userId && !target.jti
      if (matchAny || noTarget) {
        try { conn.send(JSON.stringify({ type: 'collab:revoked' })) } catch { /* ignore */ }
        conn.close(4001, 'Access revoked — please reload')
        closed++
      }
    }
    return new Response(JSON.stringify({ ok: true, closed }), {
      headers: { 'content-type': 'application/json' }
    })
  }

  /**
   * Doc-level y-partykit options shared by onConnect and the /restore handler
   * so both operate on the same logical doc (and a doc created by a restore
   * while nobody is connected still gets the flush callback wired).
   */
  private docOptions(): YPartyKitOptions {
    return {
      callback: {
        handler: async (yDoc) => {
          await scheduleFlush(this.party, yDoc)
        },
        debounceWait: 2000,
        debounceMaxWait: 10000
      }
    }
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const role = (ctx.request.headers.get('x-collab-role') || 'viewer') as ConnectionState['role']
    const state: ConnectionState = {
      role,
      sessionId: ctx.request.headers.get('x-collab-session') || '',
      userId: ctx.request.headers.get('x-collab-user') || null,
      shareToken: ctx.request.headers.get('x-collab-share') || null,
      jti: ctx.request.headers.get('x-collab-jti') || null,
    }
    conn.setState(state)

    // Editor === read+write; viewer and commenter are read-only on the
    // canvas Y.Doc. Commenters post via REST /api/maps/:id/comments.
    const opts: YPartyKitOptions = {
      readOnly: role !== 'editor',
      ...this.docOptions()
    }
    return onConnect(conn, this.party, opts)
  }
}
