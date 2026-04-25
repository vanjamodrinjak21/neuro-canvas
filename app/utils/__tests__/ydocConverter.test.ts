import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { mapDocumentToYDoc, yDocToMapDocument } from '../ydocConverter'
import type { MapDocument, Node, Edge, NodeStyle, EdgeStyle } from '~/types'

const nodeStyle: NodeStyle = {
  shape: 'rounded', fillColor: '#fff', borderColor: '#000', borderWidth: 1,
  textColor: '#000', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false
}
const edgeStyle: EdgeStyle = {
  type: 'bezier', strokeColor: '#999', strokeWidth: 1, arrowStart: 'none', arrowEnd: 'arrow', animated: false
}

function makeNode(id: string, content: string, x: number, y: number): Node {
  return {
    id, type: 'text', position: { x, y }, size: { width: 120, height: 40 },
    content, style: nodeStyle, createdAt: 0, updatedAt: 0
  }
}

function makeEdge(id: string, sourceId: string, targetId: string): Edge {
  return { id, sourceId, targetId, style: edgeStyle, createdAt: 0, updatedAt: 0 }
}

function sampleDoc(): MapDocument {
  const nodes = new Map<string, Node>()
  nodes.set('n1', makeNode('n1', 'Root', 0, 0))
  nodes.set('n2', makeNode('n2', 'Child', 200, 0))
  const edges = new Map<string, Edge>()
  edges.set('e1', makeEdge('e1', 'n1', 'n2'))
  return {
    id: 'map-1',
    title: 'Test Map',
    nodes,
    edges,
    camera: { x: 0, y: 0, zoom: 1 },
    rootNodeId: 'n1',
    createdAt: 1000,
    updatedAt: 2000,
    settings: {
      gridEnabled: true,
      gridSize: 24,
      snapToGrid: false,
      backgroundColor: '#09090B',
      defaultNodeStyle: {},
      defaultEdgeStyle: {}
    }
  }
}

describe('ydocConverter', () => {
  it('round-trips a MapDocument through a Y.Doc preserving every field', () => {
    const original = sampleDoc()
    const ydoc = mapDocumentToYDoc(original)
    const back = yDocToMapDocument(ydoc, { id: original.id, title: original.title, createdAt: original.createdAt, updatedAt: original.updatedAt })

    expect(back.nodes.size).toBe(2)
    expect(back.nodes.get('n1')?.content).toBe('Root')
    expect(back.nodes.get('n1')?.position).toEqual({ x: 0, y: 0 })
    expect(back.nodes.get('n2')?.content).toBe('Child')

    expect(back.edges.size).toBe(1)
    expect(back.edges.get('e1')?.sourceId).toBe('n1')
    expect(back.edges.get('e1')?.targetId).toBe('n2')

    expect(back.rootNodeId).toBe('n1')
    expect(back.camera).toEqual(original.camera)
    expect(back.settings).toEqual(original.settings)
  })

  it('writes node body as Y.Text so character co-edits merge cleanly', () => {
    const ydoc = mapDocumentToYDoc(sampleDoc())
    const nodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    const n1 = nodes.get('n1')!
    expect(n1.get('content')).toBeInstanceOf(Y.Text)
    expect((n1.get('content') as Y.Text).toString()).toBe('Root')
  })

  it('returns an empty MapDocument when given an empty Y.Doc', () => {
    const empty = new Y.Doc()
    const back = yDocToMapDocument(empty, { id: 'm', title: 't', createdAt: 0, updatedAt: 0 })
    expect(back.nodes.size).toBe(0)
    expect(back.edges.size).toBe(0)
    expect(back.rootNodeId).toBeUndefined()
  })

  it('preserves edits made directly to the Y.Doc node body', () => {
    const ydoc = mapDocumentToYDoc(sampleDoc())
    const n1 = ydoc.getMap<Y.Map<unknown>>('nodes').get('n1')!
    const text = n1.get('content') as Y.Text
    text.insert(4, '!')
    const back = yDocToMapDocument(ydoc, { id: 'm', title: 't', createdAt: 0, updatedAt: 0 })
    expect(back.nodes.get('n1')?.content).toBe('Root!')
  })
})
