// Last-line-of-defence error handler. Any throw that escapes a Nitro
// route handler without already being a `createError` ends up here, and
// Nitro's default renderer would otherwise include the original
// `error.message` (and, in dev, the full stack) in the response body.
// That message often contains SQL fragments, constraint names, file
// paths, Prisma error metadata, or upstream API responses.
//
// We rewrite anything that isn't an explicit H3/Nitro error into a
// generic 500, log the structured detail server-side, and let the
// existing `createError(...)` calls flow through untouched.
//
// Optional external aggregation: if `ERROR_WEBHOOK_URL` is set in the
// environment, sanitized error payloads are POSTed to it (Sentry,
// Logtail, Axiom, custom collector — anything that accepts JSON over
// HTTPS). When unset this is a no-op and all logging stays local.

import type { NitroApp } from 'nitropack'
import { isScannerPath } from '../utils/scannerPatterns'

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL || ''
const WEBHOOK_TIMEOUT_MS = 1500
const ENV = process.env.NODE_ENV || 'unknown'

type Sanitized = {
  level: 'warn' | 'error'
  path?: string
  statusCode?: number
  name?: string
  code?: string
  message?: string
  stack?: string
  env: string
  ts: string
}

async function forwardToWebhook(payload: Sanitized): Promise<void> {
  if (!WEBHOOK_URL) return
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS)
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    }).catch(() => {})
    clearTimeout(timer)
  } catch {
    // Never throw from the error handler — best-effort only.
  }
}

export default defineNitroPlugin((nitro: NitroApp) => {
  nitro.hooks.hook('error', (err, ctx) => {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const event = ctx?.event
    const path = event?.path

    // Expected, high-volume bot probes for `.git`, `.env`, `wp-*`, etc. are
    // already turned into a 404 by the block-scanners middleware. Logging
    // each one floods production logs and buries real errors, so drop them
    // here. Genuine 404s (real missing app routes) still log.
    if (statusCode === 404 && isScannerPath(path || '')) return

    // Errors that already carry an h3-style statusCode are intentional
    // (createError, validation, auth refusals) — log lightly, don't mask.
    if (statusCode && statusCode >= 400 && statusCode < 600) {
      const payload: Sanitized = {
        level: 'warn',
        path,
        statusCode,
        name: (err as Error)?.name,
        message: (err as Error)?.message,
        env: ENV,
        ts: new Date().toISOString(),
      }
      console.warn('handled error', payload)
      // Forward 5xx createErrors too so unexpected server-side failures
      // (DB down, upstream timeout) reach the aggregator.
      if (statusCode >= 500) void forwardToWebhook(payload)
      return
    }

    // Anything else is unexpected — log the real shape, rewrite the
    // wire response to a generic 500 so the original `message` /
    // stack never reaches the client.
    const payload: Sanitized = {
      level: 'error',
      path,
      name: (err as Error)?.name,
      code: (err as { code?: string })?.code,
      message: (err as Error)?.message,
      // Truncated stack only — never the raw error object, which can
      // be a Prisma error carrying parameter values.
      stack: (err as Error)?.stack?.split('\n').slice(0, 5).join('\n'),
      env: ENV,
      ts: new Date().toISOString(),
    }
    console.error('unhandled error', payload)
    void forwardToWebhook(payload)

    if (event && !event.handled) {
      event.node.res.statusCode = 500
      event.node.res.setHeader('Content-Type', 'application/json')
      event.node.res.end(JSON.stringify({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      }))
    }
  })
})
