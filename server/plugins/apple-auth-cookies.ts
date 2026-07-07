// Sign in with Apple returns its callback via response_mode=form_post — a
// cross-site POST. Browsers do NOT send SameSite=Lax cookies on cross-site
// POSTs, so the PKCE / state / nonce cookies next-auth sets when the Apple flow
// starts are absent at the callback, which fails with:
//   [OAUTH_CALLBACK_ERROR] PKCE code_verifier cookie was missing.
//
// next-auth v4 has no per-provider cookie config, so we scope the fix here
// rather than weakening cookies globally: ONLY on the Apple auth routes, rewrite
// those flow cookies' SameSite to None (+Secure — already true in prod) so they
// survive Apple's cross-site POST. Google / GitHub use GET callbacks and keep
// their default SameSite=Lax, completely untouched.

import type { NitroApp } from 'nitropack'
import type { H3Event } from 'h3'

const APPLE_AUTH_ROUTE = /\/api\/auth\/(signin|callback)\/apple(\b|\/|\?|$)/
const FLOW_COOKIE = /^(next-auth\.pkce\.code_verifier|next-auth\.state|next-auth\.nonce|(?:__Secure-)?next-auth\.callback-url)=/

export default defineNitroPlugin((nitro: NitroApp) => {
  nitro.hooks.hook('beforeResponse', (event: H3Event) => {
    const path = event.path || event.node.req.url || ''
    if (!APPLE_AUTH_ROUTE.test(path)) return

    const res = event.node.res
    // The auth handler may have already streamed the callback response (seen
    // on Apple's form_post callback in prod: ERR_HTTP_HEADERS_SENT crashed the
    // whole request). Headers gone = nothing to rewrite — bail out.
    if (res.headersSent) return
    const existing = res.getHeader('set-cookie')
    if (!existing) return

    const cookies = Array.isArray(existing) ? existing.map(String) : [String(existing)]
    let changed = false

    const rewritten = cookies.map((cookie) => {
      if (!FLOW_COOKIE.test(cookie)) return cookie
      changed = true
      let out = /;\s*samesite=/i.test(cookie)
        ? cookie.replace(/;\s*samesite=[^;]*/i, '; SameSite=None')
        : `${cookie}; SameSite=None`
      // SameSite=None is only valid with Secure.
      if (!/;\s*secure\b/i.test(out)) out += '; Secure'
      return out
    })

    if (changed) res.setHeader('set-cookie', rewritten)
  })
})
