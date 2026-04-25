/**
 * Bidirectional bridge primitives between a MapDocument-shaped state and a
 * Y.Doc. The high-level `useMapYDocBridge` composable is in
 * `~/composables/useMapYDocBridge.ts`; this module owns the pure-data parts
 * so they can be tested without Vue or Pinia.
 */
import * as Y from 'yjs'
import type { MapDocument, Node, Edge } from '~/types'

/**
 * Tag every transaction we initiate with this symbol so the inverse direction
 * (Y.Doc -> mapStore) can ignore its own echoes and avoid feedback loops.
 */
export const LOCAL_ORIGIN = Symbol('nc.collab.local-origin')

const SCALAR_NODE_KEYS = ['type', 'parentId', 'collapsed', 'locked', 'isRoot', 'createdAt', 'updatedAt'] as const
const SCALAR_EDGE_KEYS = ['sourceId', 'targetId', 'label', 'createdAt', 'updatedAt'] as const

/**
 * Reconcile the Y.Doc to match `state` — adding/updating/removing nodes and
 * edges as needed. The Y.Text content of an existing node is updated via
 * delta editing so concurrent character-level edits from other clients merge
 * cleanly instead of being clobbered by a wholesale replacement.
 */
export function syncStateIntoYDoc(ydoc: Y.Doc, state: MapDocument): void {
  ydoc.transact(() => {
    syncNodes(ydoc, state.nodes)
    syncEdges(ydoc, state.edges)
    syncMeta(ydoc, state)
  }, LOCAL_ORIGIN)
}

function syncNodes(ydoc: Y.Doc, nodes: Map<string, Node>) {
  const ymap = ydoc.getMap<Y.Map<unknown>>('nodes')
  // Remove
  for (const id of Array.from(ymap.keys())) {
    if (!nodes.has(id)) ymap.delete(id)
  }
  // Add / update
  nodes.forEach((node, id) => {
    let entry = ymap.get(id)
    if (!entry) {
      entry = new Y.Map()
      ymap.set(id, entry)
    }
    upsertNodeAttrs(entry, node)
  })
}

function upsertNodeAttrs(entry: Y.Map<unknown>, node: Node) {
  // Position / size are objects; store as plain JSON values
  const pos = entry.get('position') as { x: number; y: number } | undefined
  if (!pos || pos.x !== node.position.x || pos.y !== node.position.y) {
    entry.set('position', { x: node.position.x, y: node.position.y })
  }
  const size = entry.get('size') as { width: number; height: number } | undefined
  if (!size || size.width !== node.size.width || size.height !== node.size.height) {
    entry.set('size', { width: node.size.width, height: node.size.height })
  }
  // Style: write only if changed (cheap deep-eq via JSON)
  const oldStyleJson = JSON.stringify(entry.get('style') ?? null)
  const newStyleJson = JSON.stringify(node.style)
  if (oldStyleJson !== newStyleJson) entry.set('style', node.style)

  // Body text: edit Y.Text in place to preserve concurrent editor state
  let text = entry.get('content') as Y.Text | undefined
  if (!(text instanceof Y.Text)) {
    text = new Y.Text()
    entry.set('content', text)
  }
  const current = text.toString()
  if (current !== node.content) {
    if (current.length) text.delete(0, current.length)
    if (node.content) text.insert(0, node.content)
  }

  // Scalar attrs
  for (const key of SCALAR_NODE_KEYS) {
    const next = node[key]
    if (entry.get(key) !== next) {
      if (next === undefined) entry.delete(key)
      else entry.set(key, next as unknown)
    }
  }
  // metadata is opaque — JSON-compare and replace wholesale if changed
  const oldMeta = JSON.stringify(entry.get('metadata') ?? null)
  const newMeta = JSON.stringify(node.metadata ?? null)
  if (oldMeta !== newMeta) {
    if (node.metadata === undefined) entry.delete('metadata')
    else entry.set('metadata', node.metadata)
  }
}

function syncEdges(ydoc: Y.Doc, edges: Map<string, Edge>) {
  const ymap = ydoc.getMap<Y.Map<unknown>>('edges')
  for (const id of Array.from(ymap.keys())) {
    if (!edges.has(id)) ymap.delete(id)
  }
  edges.forEach((edge, id) => {
    let entry = ymap.get(id)
    if (!entry) {
      entry = new Y.Map()
      ymap.set(id, entry)
    }
    for (const key of SCALAR_EDGE_KEYS) {
      const next = edge[key]
      if (entry.get(key) !== next) {
        if (next === undefined) entry.delete(key)
        else entry.set(key, next as unknown)
      }
    }
    const oldStyleJson = JSON.stringify(entry.get('style') ?? null)
    const newStyleJson = JSON.stringify(edge.style)
    if (oldStyleJson !== newStyleJson) entry.set('style', edge.style)
    const oldAi = JSON.stringify(entry.get('ai') ?? null)
    const newAi = JSON.stringify(edge.ai ?? null)
    if (oldAi !== newAi) {
      if (edge.ai === undefined) entry.delete('ai')
      else entry.set('ai', edge.ai)
    }
  })
}

function syncMeta(ydoc: Y.Doc, state: MapDocument) {
  const meta = ydoc.getMap('meta')
  const cam = state.camera
  const oldCam = meta.get('camera') as MapDocument['camera'] | undefined
  if (!oldCam || oldCam.x !== cam.x || oldCam.y !== cam.y || oldCam.zoom !== cam.zoom) {
    meta.set('camera', { x: cam.x, y: cam.y, zoom: cam.zoom })
  }
  const oldRoot = meta.get('rootNodeId') as string | undefined
  if (oldRoot !== state.rootNodeId) {
    if (state.rootNodeId === undefined) meta.delete('rootNodeId')
    else meta.set('rootNodeId', state.rootNodeId)
  }
  const oldSettingsJson = JSON.stringify(meta.get('settings') ?? null)
  const newSettingsJson = JSON.stringify(state.settings)
  if (oldSettingsJson !== newSettingsJson) meta.set('settings', state.settings)
}
