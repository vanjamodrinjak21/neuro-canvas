// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { encodeMobileSessionPayload, decodeMobileSessionPayload } from '../mobileSessionPayload'

// ---------------------------------------------------------------------------
// mobileSessionPayload (AER-106)
// ---------------------------------------------------------------------------
// The OAuth deep-link payload used btoa(JSON.stringify(...)) directly, which
// (a) throws on non-Latin-1 display names (Croatian diacritics), stranding
// sign-in in the in-app browser sheet, and (b) was pasted into the query
// string un-encoded, so base64 '+' arrived as a space and corrupted atob().
// ---------------------------------------------------------------------------

describe('mobileSessionPayload (AER-106)', () => {
  it('round-trips an ASCII payload', () => {
    const payload = {
      user: { id: 'u-1', name: 'Reviewer', email: 'r@example.com', image: null },
      token: 'jwt-abc',
      cookieName: '__Secure-next-auth.session-token',
    }
    expect(decodeMobileSessionPayload(encodeMobileSessionPayload(payload))).toEqual(payload)
  })

  it('round-trips non-Latin-1 names (old encoder threw here)', () => {
    const payload = {
      user: { id: 'u-2', name: 'Šime Đurđević — čćžš', email: 'sime@example.hr', image: null },
      token: 't',
      cookieName: 'c',
    }
    expect(decodeMobileSessionPayload(encodeMobileSessionPayload(payload))).toEqual(payload)
  })

  it('survives a URL query round-trip via URLSearchParams when percent-encoded', () => {
    const payload = { user: { id: 'u-3', name: 'Ana', email: 'a@x.com', image: null }, token: 'x'.repeat(300), cookieName: 'c' }
    const qs = new URLSearchParams(`session=${encodeURIComponent(encodeMobileSessionPayload(payload))}`)
    expect(decodeMobileSessionPayload(qs.get('session')!)).toEqual(payload)
  })

  it("repairs legacy space-mangled base64 ('+' → ' ' in URL parsing)", () => {
    const payload = { user: { id: 'u-4', name: 'Legacy', email: 'l@x.com', image: null }, token: 'tok', cookieName: 'c' }
    const encoded = encodeMobileSessionPayload(payload)
    // Simulate the old un-encoded query path: URLSearchParams turns '+' into ' '.
    const mangled = encoded.replace(/\+/g, ' ')
    expect(decodeMobileSessionPayload(mangled)).toEqual(payload)
  })

  it('decodes payloads produced by the legacy ASCII encoder', () => {
    const payload = { user: { id: 'u-5', name: 'Old App', email: 'o@x.com', image: null }, token: 't', cookieName: 'c' }
    const legacy = btoa(JSON.stringify(payload))
    expect(decodeMobileSessionPayload(legacy)).toEqual(payload)
  })
})
