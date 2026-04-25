import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listShares, createShare, updateShare, revokeShare, ShareError } from '../sharesService'

vi.mock('../prisma', () => ({
  prisma: {
    map: { findUnique: vi.fn() },
    mapShare: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}))

const mockOwnedMap = (mapId = 'm1', userId = 'owner1') =>
  ({ id: mapId, userId })

describe('sharesService', () => {
  beforeEach(() => vi.resetAllMocks())

  it('listShares returns rows for the owner', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 's1' }])
    const out = await listShares('m1', 'owner1')
    expect(out).toEqual([{ id: 's1' }])
  })

  it('listShares rejects a non-owner', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    await expect(listShares('m1', 'someone-else')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('createShare mints a token and stores VIEWER role by default', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data }))
    const out = await createShare('m1', 'owner1', { role: 'viewer', label: 'Design team', expiresAt: null })
    expect(out.role).toBe('VIEWER')
    expect(out.label).toBe('Design team')
    expect(typeof out.token).toBe('string')
    expect(out.token.length).toBeGreaterThanOrEqual(16)
  })

  it('createShare promotes role=editor to EDITOR', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.create as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data }))
    const out = await createShare('m1', 'owner1', { role: 'editor', label: null, expiresAt: null })
    expect(out.role).toBe('EDITOR')
  })

  it('createShare rejects an invalid role', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    await expect(createShare('m1', 'owner1', { role: 'manager' as 'viewer', label: null, expiresAt: null }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('updateShare patches label, role, expiresAt only', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1', mapId: 'm1' })
    ;(prisma.mapShare.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: 's1', ...data }))
    const out = await updateShare('m1', 'owner1', 's1', { label: 'New', role: 'editor', expiresAt: new Date(2030, 0, 1) })
    expect(out.label).toBe('New')
    expect(out.role).toBe('EDITOR')
  })

  it('updateShare rejects when share does not belong to the map', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(updateShare('m1', 'owner1', 's1', { label: 'X' }))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('revokeShare soft-revokes by setting revokedAt', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1', mapId: 'm1', token: 'tok', revokedAt: null })
    ;(prisma.mapShare.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => Promise.resolve({ id: 's1', token: 'tok', ...data }))
    const out = await revokeShare('m1', 'owner1', 's1')
    expect(out.revokedAt).toBeInstanceOf(Date)
    expect(out.token).toBe('tok')
  })

  it('revokeShare is idempotent — revoking twice returns the existing revokedAt', async () => {
    const { prisma } = await import('../prisma')
    const existingRevoke = new Date(2020, 0, 1)
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwnedMap())
    ;(prisma.mapShare.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1', mapId: 'm1', token: 'tok', revokedAt: existingRevoke })
    const out = await revokeShare('m1', 'owner1', 's1')
    expect(out.revokedAt).toBe(existingRevoke)
    expect(prisma.mapShare.update).not.toHaveBeenCalled()
  })

  it('all CRUD funnels through ownership check', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(listShares('m-missing', 'owner1')).rejects.toMatchObject({ statusCode: 404 })
    await expect(createShare('m-missing', 'owner1', { role: 'viewer', label: null, expiresAt: null })).rejects.toMatchObject({ statusCode: 404 })
    await expect(updateShare('m-missing', 'owner1', 's1', { label: 'X' })).rejects.toMatchObject({ statusCode: 404 })
    await expect(revokeShare('m-missing', 'owner1', 's1')).rejects.toMatchObject({ statusCode: 404 })
    expect(ShareError).toBeDefined()
  })
})
