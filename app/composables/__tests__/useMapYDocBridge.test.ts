// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { reactive, ref, watch } from 'vue'
import { useMapYDocBridge } from '../useMapYDocBridge'
import type { MapDocument, NodeStyle } from '~/types'

const nodeStyle: NodeStyle = {
  shape: 'rounded', fillColor: '#fff', borderColor: '#000', borderWidth: 1,
  textColor: '#000', fontSize: 14, fontWeight: 500, shadowEnabled: false, glowEnabled: false
}
function makeStoreSurface(initial?: Partial<MapDocument>) {
  const state = reactive<MapDocument>({
    id: 'm', title: 't',
    nodes: new Map(), edges: new Map(),
    camera: { x: 0, y: 0, zoom: 1 },
    rootNodeId: undefined,
    createdAt: 0, updatedAt: 0,
    settings: { gridEnabled: true, gridSize: 24, snapToGrid: false, backgroundColor: '#09090B', defaultNodeStyle: {}, defaultEdgeStyle: {} },
    ...initial
  })
  // Mimic Pinia $subscribe by re-emitting on a reactive ref bump.
  const tick = ref(0)
  const $subscribe = (fn: () => void) => {
    const stop = watch(tick, () => fn(), { flush: 'sync' })
    return stop
  }
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

describe('useMapYDocBridge', () => {
  it('mirrors local mapStore changes into the Y.Doc', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    surface.state.nodes.set('n1', {
      id: 'n1', type: 'text', position: { x: 0, y: 0 }, size: { width: 100, height: 40 },
      content: 'Hello', style: nodeStyle, createdAt: 0, updatedAt: 0
    })
    surface.bump()
    bridge.flushNow()
    expect(ydoc.getMap('nodes').size).toBe(1)
    expect((ydoc.getMap<Y.Map<unknown>>('nodes').get('n1')!.get('content') as Y.Text).toString()).toBe('Hello')
    bridge.dispose()
  })

  it('applies remote Y.Doc updates back into the mapStore', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    // Simulate a remote update (transaction with non-local origin).
    ydoc.transact(() => {
      const ymap = ydoc.getMap<Y.Map<unknown>>('nodes')
      const node = new Y.Map<unknown>()
      const text = new Y.Text(); text.insert(0, 'Remote')
      node.set('content', text)
      node.set('position', { x: 50, y: 50 })
      node.set('size', { width: 120, height: 40 })
      node.set('style', nodeStyle)
      node.set('type', 'text')
      node.set('createdAt', 0); node.set('updatedAt', 0)
      ymap.set('n-remote', node)
    }, 'remote-source')
    expect(surface.state.nodes.has('n-remote')).toBe(true)
    expect(surface.state.nodes.get('n-remote')!.content).toBe('Remote')
    bridge.dispose()
  })

  it('does not echo local changes back through the apply path', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    let applyCount = 0
    const origApply = surface.applySnapshot
    surface.applySnapshot = (snap: MapDocument) => { applyCount++; origApply(snap) }
    const bridge = useMapYDocBridge(ydoc, surface)
    surface.state.nodes.set('n1', {
      id: 'n1', type: 'text', position: { x: 0, y: 0 }, size: { width: 100, height: 40 },
      content: 'Hi', style: nodeStyle, createdAt: 0, updatedAt: 0
    })
    surface.bump()
    bridge.flushNow()
    expect(applyCount).toBe(0)
    bridge.dispose()
  })

  it('dispose stops both directions of sync', () => {
    const ydoc = new Y.Doc()
    const surface = makeStoreSurface()
    const bridge = useMapYDocBridge(ydoc, surface)
    bridge.dispose()
    surface.state.nodes.set('n1', {
      id: 'n1', type: 'text', position: { x: 0, y: 0 }, size: { width: 100, height: 40 },
      content: 'Hi', style: nodeStyle, createdAt: 0, updatedAt: 0
    })
    surface.bump()
    bridge.flushNow()
    expect(ydoc.getMap('nodes').size).toBe(0)
  })
})
