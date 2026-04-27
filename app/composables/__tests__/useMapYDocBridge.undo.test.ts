// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import * as Y from 'yjs'
import { reactive, ref, watch, nextTick } from 'vue'
import { useMapYDocBridge } from '../useMapYDocBridge'
import type { MapDocument, NodeStyle } from '~/types'

const nodeStyle: NodeStyle = {
  shape: 'rounded', fillColor: '#fff', borderColor: '#000', borderWidth: 1,
  textColor: '#000', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false
}

function makeStoreSurface() {
  const state = reactive<MapDocument>({
    id: 'm', title: 't',
    nodes: new Map(), edges: new Map(),
    camera: { x: 0, y: 0, zoom: 1 },
    rootNodeId: undefined,
    createdAt: 0, updatedAt: 0,
    settings: { gridEnabled: true, gridSize: 24, snapToGrid: false, backgroundColor: '#09090B', defaultNodeStyle: {}, defaultEdgeStyle: {} }
  })
  const tick = ref(0)
  const $subscribe = (fn: () => void) => watch(tick, () => fn(), { flush: 'sync' })
  const bump = () => { tick.value++ }
  const applySnapshot = (snap: MapDocument) => {
    state.nodes = snap.nodes
    state.edges = snap.edges
    state.camera = snap.camera
    state.rootNodeId = snap.rootNodeId
    state.settings = snap.settings
  }
  return { state, $subscribe, bump, applySnapshot }
}

function makeNode(id: string, content: string, x = 0, y = 0) {
  return {
    id, type: 'text' as const,
    position: { x, y }, size: { width: 100, height: 40 },
    content, style: nodeStyle, createdAt: 0, updatedAt: 0
  }
}

describe('useMapYDocBridge — undo/redo via Y.UndoManager', () => {
  it('local insert + undo removes the node', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    surface.state.nodes.set('n1', makeNode('n1', 'A'))
    surface.bump()
    bridge.flushNow()
    expect(ydoc.getMap('nodes').size).toBe(1)
    bridge.undo()
    expect(ydoc.getMap('nodes').size).toBe(0)
    expect(surface.state.nodes.has('n1')).toBe(false)
    bridge.dispose()
  })

  it('only undoes local edits, not remote ones', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)

    // 1. Local insert
    surface.state.nodes.set('n-local', makeNode('n-local', 'Local'))
    surface.bump()
    bridge.flushNow()

    // 2. Simulate a remote insert (different origin)
    ydoc.transact(() => {
      const ymap = ydoc.getMap<Y.Map<unknown>>('nodes')
      const n = new Y.Map<unknown>()
      const t = new Y.Text(); t.insert(0, 'Remote')
      n.set('content', t)
      n.set('position', { x: 0, y: 0 })
      n.set('size', { width: 100, height: 40 })
      n.set('style', nodeStyle)
      n.set('type', 'text')
      n.set('createdAt', 0); n.set('updatedAt', 0)
      ymap.set('n-remote', n)
    }, 'remote-source')

    expect(ydoc.getMap('nodes').size).toBe(2)

    // 3. Local undo should remove ONLY the local node
    bridge.undo()
    expect(ydoc.getMap('nodes').has('n-local')).toBe(false)
    expect(ydoc.getMap('nodes').has('n-remote')).toBe(true)
    bridge.dispose()
  })

  it('redo restores an undone local insert', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    surface.state.nodes.set('n1', makeNode('n1', 'A'))
    surface.bump()
    bridge.flushNow()
    bridge.undo()
    expect(ydoc.getMap('nodes').size).toBe(0)
    bridge.redo()
    expect(ydoc.getMap('nodes').size).toBe(1)
    bridge.dispose()
  })

  it('canUndo / canRedo refs reflect stack state', async () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    expect(bridge.canUndo.value).toBe(false)
    expect(bridge.canRedo.value).toBe(false)

    surface.state.nodes.set('n1', makeNode('n1', 'A'))
    surface.bump()
    bridge.flushNow()
    await nextTick()
    expect(bridge.canUndo.value).toBe(true)
    expect(bridge.canRedo.value).toBe(false)

    bridge.undo()
    await nextTick()
    expect(bridge.canUndo.value).toBe(false)
    expect(bridge.canRedo.value).toBe(true)
    bridge.dispose()
  })

  it('captureTimeout collapses rapid edits into one undo step', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface, { captureTimeoutMs: 500 })

    // Two flushes within the capture window
    surface.state.nodes.set('n1', makeNode('n1', 'A', 0, 0))
    surface.bump()
    bridge.flushNow()

    const node = surface.state.nodes.get('n1')!
    surface.state.nodes.set('n1', { ...node, position: { x: 50, y: 50 } })
    surface.bump()
    bridge.flushNow()

    // One undo should remove the node entirely (both ops collapsed)
    bridge.undo()
    expect(ydoc.getMap('nodes').size).toBe(0)
    bridge.dispose()
  })

  it('dispose destroys the undo manager (idempotent, no leaks)', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    surface.state.nodes.set('n1', makeNode('n1', 'A'))
    surface.bump()
    bridge.flushNow()
    expect(() => bridge.dispose()).not.toThrow()
    // Calling undo after dispose must be a safe no-op
    expect(() => bridge.undo()).not.toThrow()
  })

  it('undo persists across remote updates landing in between', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)

    surface.state.nodes.set('n-local', makeNode('n-local', 'Local'))
    surface.bump()
    bridge.flushNow()

    // Remote update lands — must NOT clear the local undo stack.
    ydoc.transact(() => {
      const ymap = ydoc.getMap<Y.Map<unknown>>('nodes')
      const n = new Y.Map<unknown>()
      const t = new Y.Text(); t.insert(0, 'R')
      n.set('content', t)
      n.set('position', { x: 0, y: 0 })
      n.set('size', { width: 100, height: 40 })
      n.set('style', nodeStyle)
      n.set('type', 'text')
      n.set('createdAt', 0); n.set('updatedAt', 0)
      ymap.set('n-remote', n)
    }, 'remote-source')

    expect(bridge.canUndo.value).toBe(true)
    bridge.undo()
    expect(ydoc.getMap('nodes').has('n-local')).toBe(false)
    expect(ydoc.getMap('nodes').has('n-remote')).toBe(true)
    bridge.dispose()
  })
})

// silence unused vi import (kept for parity with other test files)
void vi
