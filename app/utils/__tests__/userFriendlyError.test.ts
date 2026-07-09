import { describe, it, expect } from 'vitest'
import { userFriendlyError } from '../userFriendlyError'

// Identity stub: returns the i18n key verbatim so each test asserts the exact
// branch that was chosen, without needing a real i18n instance.
const t = (key: string) => key

describe('userFriendlyError', () => {
  it('maps the raw AI-stream credential error to the actionable key', () => {
    // This is the exact shape that leaked into the dock card: the H3 envelope
    // from /api/ai/stream when no provider key is configured.
    const leaked = {
      error: true,
      url: 'https://neuro-canvas.com/api/ai/stream',
      statusCode: 404,
      statusMessage: 'No API credential found. Add an API key in Settings > AI Providers.',
      message: 'No API credential found. Add an API key in Settings > AI Providers.',
    }
    expect(userFriendlyError(leaked, t)).toBe('common.errors.no_ai_credential')
  })

  it('detects a missing credential even from a bare Error message', () => {
    expect(userFriendlyError(new Error('No API credential found.'), t)).toBe(
      'common.errors.no_ai_credential',
    )
    expect(userFriendlyError(new Error('Failed to decrypt API key.'), t)).toBe(
      'common.errors.no_ai_credential',
    )
  })

  it('does not say "add an API key" for an unrelated 404', () => {
    expect(userFriendlyError({ statusCode: 404, message: 'Map not found' }, t)).toBe(
      'common.errors.not_found',
    )
  })

  it('maps well-known HTTP status codes', () => {
    expect(userFriendlyError({ statusCode: 401 }, t)).toBe('common.errors.session_expired')
    expect(userFriendlyError({ statusCode: 403 }, t)).toBe('common.errors.no_permission')
    expect(userFriendlyError({ statusCode: 408 }, t)).toBe('common.errors.timeout')
    expect(userFriendlyError({ statusCode: 429 }, t)).toBe('common.errors.rate_limited')
    expect(userFriendlyError({ statusCode: 503 }, t)).toBe('common.errors.server_error')
  })

  it('reads the status code from nested fetch-error shapes', () => {
    expect(userFriendlyError({ response: { status: 403 } }, t)).toBe('common.errors.no_permission')
    expect(userFriendlyError({ data: { statusCode: 429 } }, t)).toBe('common.errors.rate_limited')
  })

  it('falls back to offline then generic', () => {
    expect(userFriendlyError(new Error('Failed to fetch'), t)).toBe('common.errors.offline')
    expect(userFriendlyError(new Error('something odd'), t)).toBe('common.errors.generic')
    expect(userFriendlyError(null, t)).toBe('common.errors.generic')
  })

  it('maps an unreachable local Ollama to the actionable key', () => {
    // Exact message the Tauri/reqwest side logs when Ollama is not running.
    expect(userFriendlyError(
      new Error('error sending request for url (http://localhost:11434/api/chat)'), t,
    )).toBe('common.errors.ollama_unreachable')
    // Browser-side variants of the same failure.
    expect(userFriendlyError(
      new Error('Failed to fetch (http://localhost:11434/api/chat)'), t,
    )).toBe('common.errors.ollama_unreachable')
  })

  it('treats a non-Ollama send failure as offline, not Ollama', () => {
    expect(userFriendlyError(
      new Error('error sending request for url (https://api.anthropic.com/v1/messages)'), t,
    )).toBe('common.errors.offline')
  })

  it('maps the 2 MB stream budget abort from either side', () => {
    // Client pipeline (StreamingPipeline.ts) …
    expect(userFriendlyError(
      new Error('AI response exceeded the 2 MB stream limit. Try a smaller generation.'), t,
    )).toBe('common.errors.ai_output_too_large')
    // … and the server budget (streamBudget.ts) wording.
    expect(userFriendlyError(
      new Error('AI stream exceeded the 2 MB output limit. Try a smaller generation.'), t,
    )).toBe('common.errors.ai_output_too_large')
  })

  it('maps malformed and empty AI output to the model-quality key', () => {
    expect(userFriendlyError(
      new Error('Failed to parse AI response. The model returned malformed output — try again or use a larger model. Got: "```json {…"'), t,
    )).toBe('common.errors.ai_malformed_output')
    expect(userFriendlyError(
      new Error('AI returned an empty response. Try again — the model may have timed out.'), t,
    )).toBe('common.errors.ai_malformed_output')
  })
})
