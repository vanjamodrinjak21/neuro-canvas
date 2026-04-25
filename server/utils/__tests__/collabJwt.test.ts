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
})
