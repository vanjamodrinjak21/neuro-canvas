/**
 * Map an arbitrary fetch / `$fetch` failure into a localised, user-facing
 * string. Never returns the raw URL, HTTP verb, or backend status message —
 * those leak implementation detail (e.g. `[DELETE] /api/maps/x/shares/y: 403`)
 * straight into the UI.
 *
 * Always log the raw error via `console.error()` in the caller; this helper
 * only handles what the user sees.
 *
 * Usage from a component or composable:
 *   const { t } = useI18n()
 *   try { ... } catch (e) { console.error('[share] revoke', e); error.value = userFriendlyError(e, t) }
 */

type TFn = (key: string) => string

interface MaybeFetchError {
  statusCode?: number
  status?: number
  response?: { status?: number }
  data?: { statusCode?: number }
  name?: string
  message?: string
  statusMessage?: string
}

function extractStatus(err: MaybeFetchError): number {
  return (
    err?.statusCode ??
    err?.status ??
    err?.response?.status ??
    err?.data?.statusCode ??
    0
  )
}

function looksMissingCredential(err: MaybeFetchError): boolean {
  const msg = `${err?.message || ''} ${err?.statusMessage || ''}`.toLowerCase()
  return (
    msg.includes('api credential') ||
    msg.includes('api key') ||
    msg.includes('ai provider')
  )
}

function looksOffline(err: MaybeFetchError): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = (err?.message || '').toLowerCase()
  if (msg.includes('failed to fetch')) return true
  if (msg.includes('network')) return true
  if (err?.name === 'FetchError' && extractStatus(err) === 0) return true
  return false
}

export function userFriendlyError(err: unknown, t: TFn): string {
  const e = (err ?? {}) as MaybeFetchError
  const code = extractStatus(e)

  // Missing/undecryptable AI provider key is the most common generation
  // failure — give the actionable fix, not a generic "Not found." Detected by
  // message so an unrelated 404 elsewhere never says "add an API key."
  if (looksMissingCredential(e)) return t('common.errors.no_ai_credential')

  if (code === 401) return t('common.errors.session_expired')
  if (code === 403) return t('common.errors.no_permission')
  if (code === 404) return t('common.errors.not_found')
  if (code === 408) return t('common.errors.timeout')
  if (code === 429) return t('common.errors.rate_limited')
  if (code >= 500 && code < 600) return t('common.errors.server_error')
  if (code === 0 && looksOffline(e)) return t('common.errors.offline')
  return t('common.errors.generic')
}
