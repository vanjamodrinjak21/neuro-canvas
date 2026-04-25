import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { syncStateIntoYDoc, LOCAL_ORIGIN } from '../ydocBridge'
import type { MapDocument, Node, Edge, NodeStyle, EdgeStyle } from '~/types'

const nodeStyle: NodeStyle = {
  shape: 'rounded', fillColor: '#fff', borderColor: '#000', borderWidth: 1,
  textColor: '#000', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false
}
const edgeStyle: EdgeStyle = {
  type: 'bezier', strokeColor: '#999', strokeWidth: 1, arrowStart: 'none', arrowEnd: 'arrow', animated: false
}

function n(id: string, content: string, x = 0, y = 0): Node {
  return { id, type: 'text', position: { x, y }, size: { width: 100, height: 40 }, content, style: nodeStyle, createdAt: 0, updatedAt: 0 }
}
function e(id: string, src: string, tgt: string): Edge {
  return { id, sourceId: src, targetId: tgt, style: edgeStyle, createdAt: 0, updatedAt: 0 }
}
function emptyDoc(): MapDocument {
  return {
    id: 'm', title: 't', nodes: new Map(), edges: new Map(),
    camera: { x: 0, y: 0, zoom: 1 }, rootNodeId: undefined,
    createdAt: 0, updatedAt: 0,
    settings: { gridEnabled: true, gridSize: 24, snapToGrid: false, backgroundColor: '#09090B', defaultNodeStyle: {}, defaultEdgeStyle: {} }
  }
}

describe('ydocBridge.syncStateIntoYDoc', () => {
  it('inserts nodes and edges into an empty Y.Doc', () => {
    const ydoc = new Y.Doc()
    const doc = emptyDoc()
    doc.nodes.set('n1', n('n1', 'A'))
    doc.nodes.set('n2', n('n2', 'B'))
    doc.edges.set('e1', e('e1', 'n1', 'n2'))
    syncStateIntoYDoc(ydoc, doc)
    expect(ydoc.getMap('nodes').size).toBe(2)
    expect(ydoc.getMap('edges').size).toBe(1)
    const n1 = ydoc.getMap<Y.Map<unknown>>('nodes').get('n1')!
    expect((n1.get('content') as Y.Text).toString()).toBe('A')
  })

  it('removes nodes that no longer exist in source', () => {
    const ydoc = new Y.Doc()
    const doc = emptyDoc()
    doc.nodes.set('n1', n('n1', 'A'))
    doc.nodes.set('n2', n('n2', 'B'))
    syncStateIntoYDoc(ydoc, doc)
    expect(ydoc.getMap('nodes').size).toBe(2)
    doc.nodes.delete('n2')
    syncStateIntoYDoc(ydoc, doc)
    expect(ydoc.getMap('nodes').size).toBe(1)
    expect(ydoc.getMap<Y.Map<unknown>>('nodes').get('n1')).toBeDefined()
  })

  it('updates a node body via Y.Text rather than replacing it', () => {
    const ydoc = new Y.Doc()
    const doc = emptyDoc()
    doc.nodes.set('n1', n('n1', 'Hello'))
    syncStateIntoYDoc(ydoc, doc)
    const original = ydoc.getMap<Y.Map<unknown>>('nodes').get('n1')!.get('content') as Y.Text
    const node = doc.nodes.get('n1')!
    doc.nodes.set('n1', { ...node, content: 'Hello world' })
    syncStateIntoYDoc(ydoc, doc)
    const after = ydoc.getMap<Y.Map<unknown>>('nodes').get('n1')!.get('content') as Y.Text
    expect(after).toBe(original)        // same Y.Text instance preserved
    expect(after.toString()).toBe('Hello world')
  })

  it('writes meta (camera, rootNodeId, settings)', () => {
    const ydoc = new Y.Doc()
    const doc = emptyDoc()
    doc.camera = { x: 100, y: 200, zoom: 1.5 }
    doc.rootNodeId = 'n1'
    syncStateIntoYDoc(ydoc, doc)
    expect(ydoc.getMap('meta').get('camera')).toEqual({ x: 100, y: 200, zoom: 1.5 })
    expect(ydoc.getMap('meta').get('rootNodeId')).toBe('n1')
  })

  it('uses LOCAL_ORIGIN as the transaction origin', () => {
    const ydoc = new Y.Doc()
    const origins: unknown[] = []
    ydoc.on('update', (_u, origin) => { origins.push(origin) })
    syncStateIntoYDoc(ydoc, emptyDoc())
    // No-op transactions don't fire updates, so seed something first.
    const doc = emptyDoc()
    doc.nodes.set('n1', n('n1', 'A'))
    syncStateIntoYDoc(ydoc, doc)
    expect(origins).toContain(LOCAL_ORIGIN)
  })
})
