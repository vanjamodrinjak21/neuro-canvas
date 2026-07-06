// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { parseJsonResponse } from '~/ai/utils/parseResponse'

// ---------------------------------------------------------------------------
// parseJsonResponse — correctness of the salvage pipeline, plus the AER-81
// performance guarantee: extractBalanced must be single-pass. The old
// implementation restarted a full scan at every opening bracket (O(n²)), so a
// large malformed response could hang the main thread for minutes.
// ---------------------------------------------------------------------------

describe('parseJsonResponse', () => {
  it('parses clean JSON directly', () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 })
  })

  it('extracts JSON from a markdown fence', () => {
    expect(parseJsonResponse('Here you go:\n```json\n{"a":1}\n```\nDone.')).toEqual({ a: 1 })
  })

  it('extracts a balanced object embedded in prose', () => {
    expect(parseJsonResponse('The result is {"a":{"b":2}} as requested.')).toEqual({ a: { b: 2 } })
  })

  it('prefers the longest balanced span when several exist', () => {
    const parsed = parseJsonResponse('{"x":1} and then {"a":1,"b":{"c":3}}')
    expect(parsed).toEqual({ a: 1, b: { c: 3 } })
  })

  it('is not confused by brackets inside string values', () => {
    expect(parseJsonResponse('{"a":"closing } brace and { opening"}')).toEqual({ a: 'closing } brace and { opening' })
  })

  it('is not confused by escaped quotes inside string values', () => {
    expect(parseJsonResponse('{"a":"say \\"hi\\" {ok}"}')).toEqual({ a: 'say "hi" {ok}' })
  })

  it('repairs trailing commas', () => {
    expect(parseJsonResponse('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] })
  })

  it('salvages JSON truncated mid-output', () => {
    // Truncated INSIDE the first child so no balanced sub-object exists —
    // the repair path must close the dangling string/brackets itself.
    const parsed = parseJsonResponse('{"rootTopic":"X","branches":[{"title":"A')
    expect(parsed).toMatchObject({ rootTopic: 'X' })
  })

  it('throws the empty-response error for blank content', () => {
    expect(() => parseJsonResponse('')).toThrow(/empty response/)
    expect(() => parseJsonResponse('   \n ')).toThrow(/empty response/)
  })

  it('throws a preview-carrying parse error for hopeless content', () => {
    expect(() => parseJsonResponse('no json here at all')).toThrow(/Failed to parse/)
  })

  // AER-81: the old extractBalanced was O(n²) — 120k unclosed braces meant
  // ~1.4e10 character visits and a multi-second (often minutes-long) hang.
  // Single-pass must dispose of this input within the test timeout.
  it('handles a large pathological input without quadratic blowup', () => {
    const pathological = '{'.repeat(120_000)
    expect(() => parseJsonResponse(pathological)).toThrow(/Failed to parse/)
  })
})
