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
  // Tauri/reqwest surfaces any dropped or unreachable connection as
  // "error sending request for url (…)" — a plain Error with no status.
  if (msg.includes('error sending request')) return true
  if (err?.name === 'FetchError' && extractStatus(err) === 0) return true
  return false
}

/**
 * Connection failure against a local Ollama server. The native side reports
 * it as e.g. `error sending request for url (http://localhost:11434/api/chat)`
 * — the port in the message is the tell. Without this branch it would fall
 * into the generic "offline" bucket, which sends the user to check their
 * internet connection when the actual fix is starting the Ollama app.
 */
function looksOllamaUnreachable(err: MaybeFetchError): boolean {
  const msg = (err?.message || '').toLowerCase()
  if (!msg.includes('11434') && !msg.includes('ollama')) return false
  return (
    msg.includes('error sending request') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('connection refused')
  )
}

/** Client- or server-side stream budget abort (2 MB output cap). */
function looksStreamTooLarge(err: MaybeFetchError): boolean {
  const msg = `${err?.message || ''} ${err?.statusMessage || ''}`.toLowerCase()
  return msg.includes('mb stream limit') || msg.includes('mb output limit')
}

/** parseJsonResponse gave up — the model emitted unusable or empty output. */
function looksMalformedAiOutput(err: MaybeFetchError): boolean {
  const msg = (err?.message || '').toLowerCase()
  return (
    msg.includes('failed to parse ai response') ||
    msg.includes('returned malformed output') ||
    msg.includes('ai returned an empty response')
  )
}

export function userFriendlyError(err: unknown, t: TFn): string {
  const e = (err ?? {}) as MaybeFetchError
  const code = extractStatus(e)

  // Missing/undecryptable AI provider key is the most common generation
  // failure — give the actionable fix, not a generic "Not found." Detected by
  // message so an unrelated 404 elsewhere never says "add an API key."
  if (looksMissingCredential(e)) return t('common.errors.no_ai_credential')

  // AI-generation failures with no HTTP status — without these branches all
  // three would fall through to "offline"/"generic" and hide the actual fix.
  // Ollama check must precede looksOffline: its message also matches the
  // generic connection-failure phrases.
  if (looksOllamaUnreachable(e)) return t('common.errors.ollama_unreachable')
  if (looksStreamTooLarge(e)) return t('common.errors.ai_output_too_large')
  if (looksMalformedAiOutput(e)) return t('common.errors.ai_malformed_output')

  if (code === 401) return t('common.errors.session_expired')
  if (code === 403) return t('common.errors.no_permission')
  if (code === 404) return t('common.errors.not_found')
  if (code === 408) return t('common.errors.timeout')
  if (code === 429) return t('common.errors.rate_limited')
  if (code >= 500 && code < 600) return t('common.errors.server_error')
  if (code === 0 && looksOffline(e)) return t('common.errors.offline')
  return t('common.errors.generic')
}
