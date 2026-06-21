import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { applyRestoreSnapshot, type RestoreSnapshot } from '../src/restore'

/** Seed a live room doc the way the client bridge does. */
function seedLiveDoc(): Y.Doc {
  const doc = new Y.Doc()
  doc.transact(() => {
    const nodes = doc.getMap<Y.Map<unknown>>('nodes')
    const a = new Y.Map<unknown>()
    const ta = new Y.Text(); ta.insert(0, 'A original')
    a.set('content', ta)
    a.set('type', 'text')
    a.set('position', { x: 0, y: 0 })
    a.set('size', { width: 100, height: 40 })
    nodes.set('a', a)

    // 'b' exists live but is absent from the restored snapshot → must be removed.
    const b = new Y.Map<unknown>()
    const tb = new Y.Text(); tb.insert(0, 'B')
    b.set('content', tb)
    b.set('type', 'text')
    nodes.set('b', b)

    const edges = doc.getMap<Y.Map<unknown>>('edges')
    const e = new Y.Map<unknown>()
    e.set('sourceId', 'a'); e.set('targetId', 'b')
    edges.set('e1', e)
  })
  return doc
}

const SNAPSHOT: RestoreSnapshot = {
  nodes: [
    // 'a' updated, 'c' added; 'b' dropped.
    { id: 'a', type: 'text', content: 'A restored', position: { x: 10, y: 20 }, size: { width: 100, height: 40 } },
    { id: 'c', type: 'note', content: 'C', position: { x: 5, y: 5 }, size: { width: 60, height: 30 } }
  ],
  edges: [],
  camera: { x: 7, y: 8, zoom: 2 },
  settings: { gridEnabled: false },
  rootNodeId: 'a'
}

describe('applyRestoreSnapshot', () => {
  it('reconciles the live doc to match the snapshot (add / update / remove)', () => {
    const doc = seedLiveDoc()
    applyRestoreSnapshot(doc, SNAPSHOT)

    const nodes = doc.getMap<Y.Map<unknown>>('nodes')
    expect(Array.from(nodes.keys()).sort()).toEqual(['a', 'c'])
    expect(nodes.has('b')).toBe(false)

    const a = nodes.get('a')!
    // content stays a Y.Text and is edited in place.
    expect(a.get('content')).toBeInstanceOf(Y.Text)
    expect((a.get('content') as Y.Text).toString()).toBe('A restored')
    expect(a.get('position')).toEqual({ x: 10, y: 20 })

    const c = nodes.get('c')!
    expect((c.get('content') as Y.Text).toString()).toBe('C')
    expect(c.get('type')).toBe('note')

    // Stale edge removed; meta updated.
    expect(doc.getMap('edges').size).toBe(0)
    const meta = doc.getMap('meta')
    expect(meta.get('camera')).toEqual({ x: 7, y: 8, zoom: 2 })
    expect(meta.get('rootNodeId')).toBe('a')
  })

  it('emits a single update so y-partykit broadcasts the revert to clients', () => {
    const doc = seedLiveDoc()
    let updates = 0
    doc.on('update', () => { updates++ })
    applyRestoreSnapshot(doc, SNAPSHOT)
    // One transaction → exactly one update event to fan out to peers.
    expect(updates).toBe(1)
  })

  it('produces a binary delta that converges a peer holding the stale doc', () => {
    // Simulate a connected collaborator: same starting state, synced via update.
    const server = seedLiveDoc()
    const peer = new Y.Doc()
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(server))

    const deltas: Uint8Array[] = []
    server.on('update', (u: Uint8Array) => deltas.push(u))
    applyRestoreSnapshot(server, SNAPSHOT)
    for (const d of deltas) Y.applyUpdate(peer, d)

    const peerNodes = peer.getMap<Y.Map<unknown>>('nodes')
    expect(Array.from(peerNodes.keys()).sort()).toEqual(['a', 'c'])
    expect((peerNodes.get('a')!.get('content') as Y.Text).toString()).toBe('A restored')
  })
})
