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
})
