import { describe, it, expect, beforeEach, vi } from 'vitest'
import { verifyCollabJwt } from '../../../utils/collabJwt'
import { mintCollabToken } from '../../../utils/collabTokenMint'

vi.mock('../../../utils/prisma', () => ({
  prisma: {
    map: { findUnique: vi.fn() },
    mapShare: { findUnique: vi.fn(), update: vi.fn() }
  }
}))

const JWT_SECRET = 'jwt-secret-32-bytes-min-aaaaaaaaaaa'

describe('mintCollabToken', () => {
  beforeEach(() => vi.resetAllMocks())

  it('mints an editor token for the map owner', async () => {
    const { prisma } = await import('../../../utils/prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', userId: 'owner1' })
    const result = await mintCollabToken({
      mapId: 'm1', authedUserId: 'owner1', shareToken: null,
      jwtSecret: JWT_SECRET, ttlSeconds: 60
    })
    const payload = await verifyCollabJwt(result.jwt, JWT_SECRET)
    expect(payload.role).toBe('editor')
    expect(result.role).toBe('editor')
    expect(result.displayName).toBeTruthy()
  })

  it('mints a viewer token for an anonymous viewer-link visitor', async () => {
    const { prisma } = await import('../../../utils/prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', userId: 'owner1' })
    ;(prisma.mapShare.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', mapId: 'm1', role: 'VIEWER', revokedAt: null, expiresAt: null
    })
    const result = await mintCollabToken({
      mapId: 'm1', authedUserId: null, shareToken: 'tok123',
      jwtSecret: JWT_SECRET, ttlSeconds: 60
    })
    expect(result.role).toBe('viewer')
    expect(result.sessionId.startsWith('guest:')).toBe(true)
  })

  it('refuses an editor token without a session', async () => {
    const { prisma } = await import('../../../utils/prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', userId: 'owner1' })
    ;(prisma.mapShare.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', mapId: 'm1', role: 'EDITOR', revokedAt: null, expiresAt: null
    })
    await expect(mintCollabToken({
      mapId: 'm1', authedUserId: null, shareToken: 'tok123',
      jwtSecret: JWT_SECRET, ttlSeconds: 60
    })).rejects.toMatchObject({ statusCode: 401 })
  })

  it('refuses a revoked share token', async () => {
    const { prisma } = await import('../../../utils/prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', userId: 'owner1' })
    ;(prisma.mapShare.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', mapId: 'm1', role: 'VIEWER', revokedAt: new Date(), expiresAt: null
    })
    await expect(mintCollabToken({
      mapId: 'm1', authedUserId: null, shareToken: 'tok123',
      jwtSecret: JWT_SECRET, ttlSeconds: 60
    })).rejects.toMatchObject({ statusCode: 410 })
  })

  it('refuses an expired share token', async () => {
    const { prisma } = await import('../../../utils/prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', userId: 'owner1' })
    ;(prisma.mapShare.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', mapId: 'm1', role: 'VIEWER', revokedAt: null, expiresAt: new Date(0)
    })
    await expect(mintCollabToken({
      mapId: 'm1', authedUserId: null, shareToken: 'tok123',
      jwtSecret: JWT_SECRET, ttlSeconds: 60
    })).rejects.toMatchObject({ statusCode: 410 })
  })

  it('refuses an unknown user with no share token', async () => {
    const { prisma } = await import('../../../utils/prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', userId: 'owner1' })
    await expect(mintCollabToken({
      mapId: 'm1', authedUserId: 'someone-else', shareToken: null,
      jwtSecret: JWT_SECRET, ttlSeconds: 60
    })).rejects.toMatchObject({ statusCode: 403 })
  })
})
