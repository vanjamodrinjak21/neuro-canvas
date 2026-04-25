import { describe, it, expect } from 'vitest'
import { signCollabJwt } from '../../server/utils/collabJwt'
import { verifyConnectionJwt } from '../src/auth'

const SECRET = 'partykit-jwt-secret-32-bytes-min-a'

describe('verifyConnectionJwt', () => {
  it('accepts a valid JWT whose mapId matches the room', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 's', role: 'editor' }, SECRET, 60)
    const payload = await verifyConnectionJwt(token, SECRET, 'm1')
    expect(payload.role).toBe('editor')
  })

  it('rejects a JWT whose mapId does not match the room', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 's', role: 'editor' }, SECRET, 60)
    await expect(verifyConnectionJwt(token, SECRET, 'm2')).rejects.toThrow()
  })

  it('rejects an expired JWT', async () => {
    const token = await signCollabJwt({ mapId: 'm1', sessionId: 's', role: 'viewer' }, SECRET, -10)
    await expect(verifyConnectionJwt(token, SECRET, 'm1')).rejects.toThrow()
  })
})
