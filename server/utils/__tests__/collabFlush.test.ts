import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as Y from 'yjs'
import { signFlushBody } from '../collabAuth'
import { mapDocumentToYDoc } from '../../../app/utils/ydocConverter'
import type { MapDocument, Node, Edge, NodeStyle, EdgeStyle } from '../../../app/types'

vi.mock('../prisma', () => ({
  prisma: {
    map: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))

const SECRET = 'test-secret-32-chars-minimum-aaaa'

const nodeStyle: NodeStyle = {
  shape: 'rounded', fillColor: '#fff', borderColor: '#000', borderWidth: 1,
  textColor: '#000', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false
}
const edgeStyle: EdgeStyle = {
  type: 'bezier', strokeColor: '#999', strokeWidth: 1, arrowStart: 'none', arrowEnd: 'arrow', animated: false
}

function makeNode(id: string, content: string): Node {
  return {
    id, type: 'text', position: { x: 0, y: 0 }, size: { width: 100, height: 40 },
    content, style: nodeStyle, createdAt: 0, updatedAt: 0
  }
}
function makeEdge(id: string, sourceId: string, targetId: string): Edge {
  return { id, sourceId, targetId, style: edgeStyle, createdAt: 0, updatedAt: 0 }
}

function buildSampleYDocBuffer(): Buffer {
  const nodes = new Map([['n1', makeNode('n1', 'Hi')]])
  const edges = new Map<string, Edge>([['e1', makeEdge('e1', 'n1', 'n1')]])
  const doc: MapDocument = {
    id: 'map1', title: 'Test', nodes, edges,
    camera: { x: 0, y: 0, zoom: 1 },
    rootNodeId: 'n1',
    createdAt: 0, updatedAt: 0,
    settings: { gridEnabled: true, gridSize: 24, snapToGrid: false, backgroundColor: '#09090B', defaultNodeStyle: {}, defaultEdgeStyle: {} }
  }
  const ydoc = mapDocumentToYDoc(doc)
  return Buffer.from(Y.encodeStateAsUpdate(ydoc))
}

describe('applyFlush', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('rejects requests with an invalid signature', async () => {
    const { applyFlush } = await import('../collabFlush')
    const body = buildSampleYDocBuffer()
    await expect(applyFlush({
      body, signature: 'deadbeef', mapId: 'map1', authorId: 'user1', secret: SECRET
    })).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects when secret is missing', async () => {
    const { applyFlush } = await import('../collabFlush')
    const body = buildSampleYDocBuffer()
    const sig = signFlushBody(body, SECRET)
    await expect(applyFlush({
      body, signature: sig, mapId: 'map1', authorId: null, secret: ''
    })).rejects.toMatchObject({ statusCode: 500 })
  })

  it('rejects when the map does not exist', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { applyFlush } = await import('../collabFlush')
    const body = buildSampleYDocBuffer()
    const sig = signFlushBody(body, SECRET)
    await expect(applyFlush({
      body, signature: sig, mapId: 'missing', authorId: null, secret: SECRET
    })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('updates Map.ydoc, bumps ydocVersion, regenerates JSON snapshot', async () => {
    const { prisma } = await import('../prisma')
    ;(prisma.map.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'map1', title: 'Test', createdAt: new Date(0), updatedAt: new Date(0), ydocVersion: 7
    })
    ;(prisma.map.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const { applyFlush } = await import('../collabFlush')
    const body = buildSampleYDocBuffer()
    const sig = signFlushBody(body, SECRET)

    const result = await applyFlush({
      body, signature: sig, mapId: 'map1', authorId: 'user-abc', secret: SECRET
    })
    expect(result.ydocVersion).toBe(8)
    const updateCall = (prisma.map.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.where).toEqual({ id: 'map1' })
    expect(updateCall.data.ydocVersion).toBe(8)
    expect(updateCall.data.ydoc).toBeInstanceOf(Uint8Array)
    // JSON snapshot should be derived from the Y.Doc
    expect(updateCall.data.data.nodes).toHaveLength(1)
    expect(updateCall.data.data.nodes[0].content).toBe('Hi')
  })
})
