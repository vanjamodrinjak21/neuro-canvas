import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Y from 'yjs'
import {
  listVersions,
  previewVersion,
  restoreVersion,
  diffVersions,
  VersionError
} from '../versionsService'

vi.mock('../prisma', () => ({
  prisma: {
    map: { findUnique: vi.fn(), update: vi.fn() },
    mapVersion: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn() }
  }
}))

const ownedMap = (id = 'm1', userId = 'owner1', extras: Record<string, unknown> = {}) =>
  ({ id, userId, ...extras })

function buildDocBytes(seed: (d: Y.Doc) => void): Uint8Array {
  const d = new Y.Doc()
  seed(d)
  return Y.encodeStateAsUpdate(d)
}

describe('versionsService', () => {
  beforeEach(() => vi.resetAllMocks())

  describe('listVersions', () => {
    it('returns paginated rows for the owner', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      ;(prisma.mapVersion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'v1', mapId: 'm1', version: 2, byteSize: 1234, authorId: 'u1', createdAt: new Date() }
      ])
      ;(prisma.mapVersion.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)
      ;(prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'u1', name: 'Alice', email: 'alice@example.com' }
      ])

      const out = await listVersions('m1', 'owner1', { limit: 50, cursor: null })
      expect(out.items).toHaveLength(1)
      expect(out.total).toBe(1)
      // Author display fields are joined onto each row.
      expect(out.items[0]!.authorName).toBe('Alice')
      // Email is hidden when name is present, to avoid leaking collaborator emails.
      expect(out.items[0]!.authorEmail).toBeNull()
    })

    it('rejects non-owner with 403', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      await expect(listVersions('m1', 'someone-else', {})).rejects.toMatchObject({ statusCode: 403 })
    })

    it('rejects missing map with 404', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      await expect(listVersions('m1', 'owner1', {})).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('previewVersion', () => {
    it('decodes the binary into a JSON snapshot', async () => {
      const { prisma } = await import('../prisma')
      const ydocBinary = buildDocBytes(d => {
        const m = d.getMap<Y.Map<unknown>>('nodes')
        const n = new Y.Map<unknown>()
        const t = new Y.Text(); t.insert(0, 'hello')
        n.set('content', t)
        n.set('position', { x: 10, y: 20 })
        n.set('size', { width: 100, height: 40 })
        n.set('type', 'text')
        m.set('n1', n)
      })

      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      ;(prisma.mapVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'v1', mapId: 'm1', ydocBinary: Buffer.from(ydocBinary), version: 1
      })

      const snap = await previewVersion('m1', 'owner1', 'v1')
      expect(snap.nodes.size).toBe(1)
      expect(snap.nodes.get('n1')?.content).toBe('hello')
    })

    it('throws 404 when ydocBinary is null (legacy version)', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      ;(prisma.mapVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'v1', mapId: 'm1', ydocBinary: null
      })
      await expect(previewVersion('m1', 'owner1', 'v1')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('restoreVersion', () => {
    it('writes the version binary back to Map.ydoc and bumps ydocVersion', async () => {
      const { prisma } = await import('../prisma')
      const bin = buildDocBytes(d => { d.getMap('nodes').set('seed', new Y.Map()) })

      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        ownedMap('m1', 'owner1', { ydocVersion: 7 })
      )
      ;(prisma.mapVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'v1', mapId: 'm1', ydocBinary: Buffer.from(bin), version: 3
      })
      ;(prisma.map.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', ydocVersion: 8 })

      const out = await restoreVersion('m1', 'owner1', 'v1')
      expect(out.ydocVersion).toBe(8)
      const updateCall = (prisma.map.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(updateCall.where).toEqual({ id: 'm1' })
      expect(updateCall.data.ydocVersion).toBe(8)
      expect(updateCall.data.ydoc).toBeDefined()
    })

    it('rejects non-owner', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      await expect(restoreVersion('m1', 'someone-else', 'v1')).rejects.toMatchObject({ statusCode: 403 })
    })

    it('falls back to the JSON data blob when the version has no Y.Doc binary', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        ownedMap('m1', 'owner1', { ydocVersion: 2, syncVersion: 5 })
      )
      // Plain-sync checkpoints (the common solo-editing case) carry only `data`.
      ;(prisma.mapVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'v9',
        mapId: 'm1',
        ydocBinary: null,
        version: 4,
        data: {
          nodes: [{ id: 'n1', type: 'text', content: 'hi', position: { x: 1, y: 2 }, size: { width: 80, height: 30 } }],
          edges: [],
          camera: { x: 0, y: 0, zoom: 1 },
          rootNodeId: 'n1',
          settings: { gridEnabled: true }
        }
      })
      ;(prisma.map.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', ydocVersion: 3, syncVersion: 6 })

      const out = await restoreVersion('m1', 'owner1', 'v9')
      expect(out.restoredFromVersion).toBe(4)
      const updateCall = (prisma.map.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
      // A canonical Y.Doc binary is rebuilt from JSON and written back to Map.ydoc.
      expect(updateCall.data.ydoc).toBeInstanceOf(Uint8Array)
      expect(updateCall.data.ydoc.byteLength).toBeGreaterThan(0)
      // Both version counters advance and the JSON snapshot is persisted.
      expect(updateCall.data.ydocVersion).toBe(3)
      expect(updateCall.data.syncVersion).toBe(6)
      expect(updateCall.data.checksum).toBeTruthy()
      expect(updateCall.data.data.nodes).toHaveLength(1)
      expect(updateCall.data.data.nodes[0].id).toBe('n1')
      // The reconcile snapshot is returned for the live-room broadcast.
      expect(out.snapshot.nodes[0]!.content).toBe('hi')
    })

    it('throws 404 only when both the binary and JSON snapshot are missing', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap('m1', 'owner1', { ydocVersion: 1 }))
      ;(prisma.mapVersion.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'v1', mapId: 'm1', ydocBinary: null, version: 1, data: null
      })
      await expect(restoreVersion('m1', 'owner1', 'v1')).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('diffVersions', () => {
    it('reports added, removed, and updated nodes between two versions', async () => {
      const { prisma } = await import('../prisma')

      const fromBin = buildDocBytes(d => {
        const m = d.getMap<Y.Map<unknown>>('nodes')
        const a = new Y.Map<unknown>(); const ta = new Y.Text(); ta.insert(0, 'A')
        a.set('content', ta); a.set('type', 'text')
        a.set('position', { x: 0, y: 0 }); a.set('size', { width: 100, height: 40 })
        m.set('a', a)

        const b = new Y.Map<unknown>(); const tb = new Y.Text(); tb.insert(0, 'B')
        b.set('content', tb); b.set('type', 'text')
        b.set('position', { x: 0, y: 0 }); b.set('size', { width: 100, height: 40 })
        m.set('b', b)
      })

      const toBin = buildDocBytes(d => {
        const m = d.getMap<Y.Map<unknown>>('nodes')
        // 'a' updated (content), 'b' removed, 'c' added
        const a = new Y.Map<unknown>(); const ta = new Y.Text(); ta.insert(0, 'A2')
        a.set('content', ta); a.set('type', 'text')
        a.set('position', { x: 0, y: 0 }); a.set('size', { width: 100, height: 40 })
        m.set('a', a)
        const c = new Y.Map<unknown>(); const tc = new Y.Text(); tc.insert(0, 'C')
        c.set('content', tc); c.set('type', 'text')
        c.set('position', { x: 0, y: 0 }); c.set('size', { width: 100, height: 40 })
        m.set('c', c)
      })

      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      ;(prisma.mapVersion.findFirst as ReturnType<typeof vi.fn>)
        .mockImplementationOnce(() => Promise.resolve({ id: 'v-from', mapId: 'm1', ydocBinary: Buffer.from(fromBin) }))
        .mockImplementationOnce(() => Promise.resolve({ id: 'v-to', mapId: 'm1', ydocBinary: Buffer.from(toBin) }))

      const diff = await diffVersions('m1', 'owner1', 'v-from', 'v-to')
      expect(diff.nodes.added.map(n => n.id).sort()).toEqual(['c'])
      expect(diff.nodes.removed.map(n => n.id).sort()).toEqual(['b'])
      const updatedIds = diff.nodes.updated.map(u => u.id).sort()
      expect(updatedIds).toEqual(['a'])
      expect(diff.nodes.updated[0].fields).toContain('content')
    })

    it('rejects non-owner', async () => {
      const { prisma } = await import('../prisma')
      ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ownedMap())
      await expect(diffVersions('m1', 'attacker', 'a', 'b')).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  it('VersionError is exported and a subclass of Error', () => {
    expect(new VersionError(404, 'x')).toBeInstanceOf(Error)
  })
})
