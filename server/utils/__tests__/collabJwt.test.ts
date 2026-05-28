import { describe, it, expect } from 'vitest'
import { signCollabJwt, verifyCollabJwt } from '../collabJwt'

const SECRET = 'test-jwt-secret-32-bytes-min-aaaaaa'

describe('collabJwt', () => {
  it('round-trips a payload through HS256', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 'guest:abc', role: 'editor' }, SECRET, 60)
    const payload = await verifyCollabJwt(token, SECRET)
    expect(payload.mapId).toBe('m1')
    expect(payload.sessionId).toBe('guest:abc')
    expect(payload.role).toBe('editor')
  })

  it('rejects an expired token', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 's', role: 'viewer' }, SECRET, -10)
    await expect(verifyCollabJwt(token, SECRET)).rejects.toThrow()
  })

  it('rejects a wrong secret', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 's', role: 'viewer' }, SECRET, 60)
    await expect(verifyCollabJwt(token, 'different-secret-32-bytes-min-bbb')).rejects.toThrow()
  })

  it('accepts the commenter role end-to-end (was previously rejected)', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 'guest:c', role: 'commenter' }, SECRET, 60)
    const payload = await verifyCollabJwt(token, SECRET)
    expect(payload.role).toBe('commenter')
  })

  it('preserves the optional revocation claims (jti, userId, shareToken)', async () => {
    const token = await signCollabJwt({
      mapId: 'm1',
      sessionId: 'user:u1',
      role: 'editor',
      userId: 'u1',
      shareToken: 'share-token-xyz',
      jti: 'jti-fingerprint-16',
    }, SECRET, 60)
    const payload = await verifyCollabJwt(token, SECRET)
    expect(payload.userId).toBe('u1')
    expect(payload.shareToken).toBe('share-token-xyz')
    expect(payload.jti).toBe('jti-fingerprint-16')
  })

  it('treats missing optional claims as null/undefined (back-compat with old tokens)', async () => {
    const token = await signCollabJwt({
      mapId: 'm1',
      sessionId: 'guest:g',
      role: 'viewer',
    }, SECRET, 60)
    const payload = await verifyCollabJwt(token, SECRET)
    expect(payload.userId).toBeNull()
    expect(payload.shareToken).toBeNull()
    expect(payload.jti).toBeUndefined()
  })
})
