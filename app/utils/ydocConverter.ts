/**
 * Convert between MapDocument JSON snapshots and Y.Doc binary state.
 *
 * Y.Doc layout:
 *   nodes: Y.Map<string, Y.Map>   // node-id -> per-attribute map; `content` is Y.Text
 *   edges: Y.Map<string, Y.Map>   // edge-id -> per-attribute map
 *   meta:  Y.Map                  // camera, settings, rootNodeId
 *
 * Plain (non-content) attributes are stored as plain values inside each per-node Y.Map
 * so that simultaneous moves to different nodes don't conflict (LWW per field).
 */
import * as Y from 'yjs'
import type { MapDocument, Node, Edge, Camera, MapSettings } from '~/types'

interface MapDocumentMeta {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export function mapDocumentToYDoc(doc: MapDocument): Y.Doc {
  const ydoc = new Y.Doc()
  const nodes = ydoc.getMap<Y.Map<unknown>>('nodes')
  const edges = ydoc.getMap<Y.Map<unknown>>('edges')
  const meta = ydoc.getMap<unknown>('meta')

  ydoc.transact(() => {
    doc.nodes.forEach((n, id) => {
      const ymap = new Y.Map<unknown>()
      for (const [k, v] of Object.entries(n)) {
        if (k === 'content') {
          const text = new Y.Text()
          text.insert(0, String(v ?? ''))
          ymap.set('content', text)
        } else {
          ymap.set(k, v as unknown)
        }
      }
      nodes.set(id, ymap)
    })

    doc.edges.forEach((e, id) => {
      const ymap = new Y.Map<unknown>()
      for (const [k, v] of Object.entries(e)) ymap.set(k, v as unknown)
      edges.set(id, ymap)
    })

    if (doc.camera) meta.set('camera', doc.camera)
    if (doc.settings) meta.set('settings', doc.settings)
    if (doc.rootNodeId) meta.set('rootNodeId', doc.rootNodeId)
  })

  return ydoc
}

/**
 * Decode a Y.Doc back into a MapDocument. Caller must supply the metadata
 * that doesn't live inside the Y.Doc (id, title, createdAt, updatedAt) since
 * those come from the database row, not the doc itself.
 */
export function yDocToMapDocument(ydoc: Y.Doc, meta: MapDocumentMeta): MapDocument {
  const nodesMap = ydoc.getMap<Y.Map<unknown>>('nodes')
  const edgesMap = ydoc.getMap<Y.Map<unknown>>('edges')
  const docMeta = ydoc.getMap<unknown>('meta')

  const nodes = new Map<string, Node>()
  nodesMap.forEach((ymap, id) => {
    const obj: Record<string, unknown> = {}
    ymap.forEach((value, key) => {
      obj[key] = value instanceof Y.Text ? value.toString() : value
    })
    nodes.set(id, obj as unknown as Node)
  })

  const edges = new Map<string, Edge>()
  edgesMap.forEach((ymap, id) => {
    const obj: Record<string, unknown> = {}
    ymap.forEach((value, key) => { obj[key] = value })
    edges.set(id, obj as unknown as Edge)
  })

  const camera = (docMeta.get('camera') as Camera | undefined) ?? { x: 0, y: 0, zoom: 1 }
  const settings = (docMeta.get('settings') as MapSettings | undefined) ?? defaultSettings()
  const rootNodeId = docMeta.get('rootNodeId') as string | undefined

  return {
    id: meta.id,
    title: meta.title,
    nodes,
    edges,
    camera,
    rootNodeId,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    settings
  }
}

function defaultSettings(): MapSettings {
  return {
    gridEnabled: true,
    gridSize: 24,
    snapToGrid: false,
    backgroundColor: '#09090B',
    defaultNodeStyle: {},
    defaultEdgeStyle: {}
  }
}
