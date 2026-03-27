import { nanoid } from 'nanoid'
import { produce, enablePatches, applyPatches, setAutoFreeze, type Patch } from 'immer'
import type {
  Node,
  Edge,
  Camera,
  Selection,
  NodeStyle,
  EdgeStyle,
  MapDocument,
  MapSettings,
  HistoryEntry,
  GraphViewOptions,
  Anchor
} from '~/types'
import { useLinkIndex } from '~/composables/useLinkIndex'
import type { DBMapDocument, DBNode, DBEdge } from '~/composables/useDatabase'

// Enable Immer patches for undo/redo
enablePatches()

// Disable Immer's auto-freeze: frozen objects break Vue 3's reactive Proxy
// (Proxy invariant requires non-configurable properties to return their exact value,
// but Vue wraps nested objects in a different Proxy, causing TypeError)
setAutoFreeze(false)

// ─── Text measurement for auto-sizing nodes ───────────────────────
let _measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!_measureCtx) {
    const c = document.createElement('canvas')
    _measureCtx = c.getContext('2d')
  }
  return _measureCtx
}

const NODE_PADDING_X = 24    // horizontal padding (12 each side)
const NODE_PADDING_Y = 20    // vertical padding (10 top + 10 bottom)
const NODE_MIN_WIDTH = 80
const NODE_MAX_WIDTH = 260
const NODE_MIN_HEIGHT = 40

/**
 * Compute the width and height a node needs to fit its text content.
 * Uses an offscreen canvas for measureText.
 */
function measureNodeSize(
  content: string,
  fontSize: number = 14,
  fontWeight: number = 500
): { width: number; height: number } {
  const ctx = getMeasureCtx()
  if (!ctx || !content) {
    return { width: NODE_MIN_WIDTH, height: NODE_MIN_HEIGHT }
  }

  ctx.font = `${fontWeight} ${fontSize}px "Inter", system-ui, sans-serif`
  const lineHeight = fontSize * 1.4

  // First, measure the full text width to decide natural width
  const fullWidth = ctx.measureText(content).width + NODE_PADDING_X
  // Clamp width between min and max
  const targetWidth = Math.max(NODE_MIN_WIDTH, Math.min(NODE_MAX_WIDTH, fullWidth))
  const maxTextWidth = targetWidth - NODE_PADDING_X

  // Word-wrap to compute line count
  const words = content.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  const textHeight = lines.length * lineHeight
  const height = Math.max(NODE_MIN_HEIGHT, textHeight + NODE_PADDING_Y)

  return { width: Math.ceil(targetWidth), height: Math.ceil(height) }
}

// Default styles - Midnight Paper + Petronas Teal Theme
const DEFAULT_NODE_STYLE: NodeStyle = {
  shape: 'rounded',
  fillColor: '#111113',      // Paper spec node fill
  borderColor: '#27272A',    // Paper spec node border
  borderWidth: 1.5,          // Paper spec border width
  textColor: '#FAFAFA',      // Bright text
  fontSize: 14,
  fontWeight: 500,
  shadowEnabled: true,
  glowEnabled: false
}

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  type: 'bezier',
  strokeColor: '#2A2A30',    // Pencil
  strokeWidth: 2,
  arrowStart: 'none',
  arrowEnd: 'arrow',
  animated: false
}

const DEFAULT_MAP_SETTINGS: MapSettings = {
  gridEnabled: true,
  gridSize: 32,              // 32px grid per spec
  snapToGrid: true,
  backgroundColor: '#0D0D0F', // Charcoal
  defaultNodeStyle: DEFAULT_NODE_STYLE,
  defaultEdgeStyle: DEFAULT_EDGE_STYLE
}

// Serializable state for Immer patches
interface SerializableState {
  id: string
  title: string
  nodes: Record<string, Node>
  edges: Record<string, Edge>
  camera: Camera
  settings: MapSettings
}

// Default graph view options
const DEFAULT_GRAPH_VIEW_OPTIONS: GraphViewOptions = {
  mode: 'global',
  depth: 2,
  filters: {},
  physics: {
    linkDistance: 100,
    repulsionStrength: -300,
    centerForce: 0.1,
    collisionRadius: 30
  }
}

// Map store state
export interface MapState {
  // Document
  id: string
  title: string
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  camera: Camera
  settings: MapSettings
  rootNodeId: string | null  // ID of the main topic/root node

  // Selection
  selection: Selection

  // History
  history: HistoryEntry[]
  historyIndex: number
  maxHistory: number

  // Dirty state
  isDirty: boolean
  lastSavedAt: number | null
  createdAt: number | null

  // Version counter for minimap reactivity during drag
  nodesVersion: number

  // Graph view state
  graphView: {
    isOpen: boolean
    options: GraphViewOptions
  }
}

// Map store actions
export interface MapActions {
  // Document
  newDocument(): void
  loadDocument(doc: MapDocument): void
  saveDocument(): MapDocument

  // Serialization for database
  toSerializable(): DBMapDocument
  fromSerializable(doc: DBMapDocument): void

  // Nodes
  addNode(node: Partial<Node>): Node
  updateNode(id: string, updates: Partial<Node>): void
  deleteNode(id: string): void
  moveNode(id: string, x: number, y: number, snap?: boolean): void
  beginMoveNodes(nodeIds: string[]): Map<string, { x: number; y: number }>
  commitMoveNodes(nodeIds: string[], originalPositions: Map<string, { x: number; y: number }>): void
  resizeNode(id: string, width: number, height: number): void
  resolveOverlaps(nodeIds?: string[]): void

  // Edges
  addEdge(sourceId: string, targetId: string, style?: Partial<EdgeStyle>, sourceAnchor?: Anchor, targetAnchor?: Anchor): Edge
  updateEdge(id: string, updates: Partial<Edge>): void
  deleteEdge(id: string): void

  // Selection
  select(nodeIds: string[], edgeIds?: string[]): void
  selectAll(): void
  clearSelection(): void
  addToSelection(nodeIds: string[], edgeIds?: string[]): void
  removeFromSelection(nodeIds: string[], edgeIds?: string[]): void

  // Camera
  setCamera(camera: Camera): void
  pan(dx: number, dy: number): void
  zoom(factor: number, centerX?: number, centerY?: number): void
  fitToContent(): void

  // History
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean

  // Batch operations
  batchUpdate(description: string, mutator: () => void): void
  deleteSelected(): void
  duplicateSelected(): Node[]

  // State
  setTitle(title: string): void
  markClean(): void

  // Link index
  rebuildLinkIndex(): void
  getBackLinks(nodeId: string): Node[]
  getOutLinks(nodeId: string): Node[]

  // Graph view
  openGraphView(options?: Partial<GraphViewOptions>): void
  closeGraphView(): void
  openLocalGraph(nodeId: string, depth?: number): void
  updateGraphViewOptions(options: Partial<GraphViewOptions>): void
}

export type MapStore = MapState & MapActions & {
  graphView: {
    isOpen: boolean
    options: GraphViewOptions
  }
}

// Create initial state
function createInitialState(): MapState {
  return {
    id: nanoid(),
    title: 'Untitled Map',
    nodes: new Map(),
    edges: new Map(),
    camera: { x: 0, y: 0, zoom: 1 },
    settings: { ...DEFAULT_MAP_SETTINGS },
    rootNodeId: null,
    selection: {
      nodeIds: new Set(),
      edgeIds: new Set()
    },
    history: [],
    historyIndex: -1,
    maxHistory: 100,
    isDirty: false,
    lastSavedAt: null,
    createdAt: null,
    nodesVersion: 0,
    graphView: {
      isOpen: false,
      options: { ...DEFAULT_GRAPH_VIEW_OPTIONS }
    }
  }
}

// Store instance (using reactive for Vue compatibility)
const state = reactive<MapState>(createInitialState())

// Helper to find the oldest node by createdAt (for migration of existing maps)
function findOldestNodeId(nodes: Map<string, Node>): string | null {
  if (nodes.size === 0) return null

  let oldestId: string | null = null
  let oldestTime = Infinity

  for (const [id, node] of nodes) {
    if (node.createdAt < oldestTime) {
      oldestTime = node.createdAt
      oldestId = id
    }
  }

  return oldestId
}

// Helper to get serializable state from Maps
function getSerializableState(): SerializableState {
  return {
    id: state.id,
    title: state.title,
    nodes: Object.fromEntries(state.nodes),
    edges: Object.fromEntries(state.edges),
    camera: { ...state.camera },
    settings: { ...state.settings }
  }
}

// Helper to apply serializable state to Maps
function applySerializableState(serializable: SerializableState) {
  state.id = serializable.id
  state.title = serializable.title
  state.nodes = new Map(Object.entries(serializable.nodes))
  state.edges = new Map(Object.entries(serializable.edges))
  state.camera = serializable.camera
  state.settings = serializable.settings
}

// Record history with Immer patches
function recordHistory(description: string, mutator: (draft: SerializableState) => void) {
  const currentState = getSerializableState()

  let patches: Patch[] = []
  let inversePatches: Patch[] = []

  const nextState = produce(
    currentState,
    mutator,
    (p, ip) => {
      patches = p
      inversePatches = ip
    }
  )

  // Only record if there are actual changes
  if (patches.length === 0) return nextState

  // Truncate history if we're not at the end
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1)
  }

  // Add new history entry
  const entry: HistoryEntry = {
    id: nanoid(),
    timestamp: Date.now(),
    description,
    patches,
    inversePatches
  }

  state.history.push(entry)

  // Limit history size
  if (state.history.length > state.maxHistory) {
    state.history.shift()
  } else {
    state.historyIndex++
  }

  // Apply the changes
  applySerializableState(nextState)
  state.isDirty = true

  return nextState
}

// Actions
const actions: MapActions = {
  newDocument() {
    const newState = createInitialState()
    newState.createdAt = Date.now()
    Object.assign(state, newState)
  },

  loadDocument(doc: MapDocument) {
    state.id = doc.id
    state.title = doc.title
    state.nodes = doc.nodes
    state.edges = doc.edges
    state.camera = doc.camera
    state.settings = { ...DEFAULT_MAP_SETTINGS, ...doc.settings }
    state.rootNodeId = doc.rootNodeId ?? findOldestNodeId(doc.nodes)
    state.selection = { nodeIds: new Set(), edgeIds: new Set() }
    state.history = []
    state.historyIndex = -1
    state.isDirty = false
    state.lastSavedAt = doc.updatedAt
    state.createdAt = doc.createdAt
    // Rebuild link index
    const linkIndex = useLinkIndex()
    linkIndex.rebuildIndex(state.edges)
  },

  saveDocument(): MapDocument {
    const now = Date.now()
    state.lastSavedAt = now
    state.isDirty = false

    return {
      id: state.id,
      title: state.title,
      nodes: state.nodes,
      edges: state.edges,
      camera: state.camera,
      rootNodeId: state.rootNodeId ?? undefined,
      settings: state.settings,
      createdAt: state.createdAt ?? now,
      updatedAt: now
    }
  },

  // Serialization for database storage
  // Uses JSON.parse(JSON.stringify()) to strip Vue reactivity proxies
  toSerializable(): DBMapDocument {
    const nodes: DBNode[] = Array.from(state.nodes.values()).map(node => ({
      id: node.id,
      type: node.type,
      position: { x: node.position.x, y: node.position.y },
      size: { width: node.size.width, height: node.size.height },
      content: node.content,
      style: JSON.parse(JSON.stringify(node.style)),
      parentId: node.parentId,
      collapsed: node.collapsed,
      locked: node.locked,
      isRoot: node.isRoot,
      metadata: node.metadata ? JSON.parse(JSON.stringify(node.metadata)) : {},
      createdAt: node.createdAt,
      updatedAt: node.updatedAt
    }))

    const edges: DBEdge[] = Array.from(state.edges.values()).map(edge => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      style: JSON.parse(JSON.stringify(edge.style)),
      label: edge.label,
      controlPoints: edge.controlPoints?.map(p => ({ x: p.x, y: p.y })),
      sourceAnchor: edge.sourceAnchor,
      targetAnchor: edge.targetAnchor,
      createdAt: edge.createdAt,
      updatedAt: edge.updatedAt
    }))

    return {
      id: state.id,
      title: state.title,
      nodes,
      edges,
      camera: { x: state.camera.x, y: state.camera.y, zoom: state.camera.zoom },
      rootNodeId: state.rootNodeId ?? undefined,
      settings: JSON.parse(JSON.stringify(state.settings)),
      createdAt: state.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      tags: []
    }
  },

  fromSerializable(doc: DBMapDocument) {
    state.id = doc.id
    state.title = doc.title

    // Convert arrays back to Maps
    state.nodes = new Map(doc.nodes.map(node => [node.id, node as Node]))
    state.edges = new Map(doc.edges.map(edge => [edge.id, edge as Edge]))

    // Migration: auto-resize nodes that still have the old default 150x50
    for (const [, node] of state.nodes) {
      if (node.size.width === 150 && node.size.height === 50 && node.content) {
        const measured = measureNodeSize(node.content, node.style.fontSize, node.style.fontWeight)
        if (measured.height > 50 || measured.width > 150) {
          node.size = measured
        }
      }
    }

    state.camera = doc.camera
    state.settings = { ...DEFAULT_MAP_SETTINGS, ...doc.settings }
    // Migration: use stored rootNodeId or find oldest node
    state.rootNodeId = (doc as DBMapDocument & { rootNodeId?: string }).rootNodeId ?? findOldestNodeId(state.nodes)
    state.selection = { nodeIds: new Set(), edgeIds: new Set() }
    state.history = []
    state.historyIndex = -1
    state.isDirty = false
    state.lastSavedAt = doc.updatedAt
    state.createdAt = doc.createdAt
    // Rebuild link index
    const linkIndex = useLinkIndex()
    linkIndex.rebuildIndex(state.edges)
  },

  addNode(partial: Partial<Node>): Node {
    const now = Date.now()
    const isFirstNode = state.nodes.size === 0

    // Auto-size from content when no explicit size is given
    const content = partial.content ?? ''
    const mergedStyle = { ...DEFAULT_NODE_STYLE, ...partial.style }
    const size = partial.size ?? measureNodeSize(content, mergedStyle.fontSize, mergedStyle.fontWeight)

    const node: Node = {
      id: partial.id ?? nanoid(),
      type: partial.type ?? 'text',
      position: partial.position ?? { x: 0, y: 0 },
      size,
      content,
      style: mergedStyle,
      parentId: partial.parentId,
      collapsed: partial.collapsed ?? false,
      locked: partial.locked ?? false,
      isRoot: partial.isRoot ?? isFirstNode,
      metadata: partial.metadata ?? {},
      createdAt: now,
      updatedAt: now
    }

    recordHistory('Add node', draft => {
      draft.nodes[node.id] = node
    })

    // Auto-set first node as root
    if (isFirstNode) {
      state.rootNodeId = node.id
    }

    return node
  },

  updateNode(id: string, updates: Partial<Node>) {
    const node = state.nodes.get(id)
    if (!node) return

    // Auto-resize when content changes and no explicit size update
    if (updates.content !== undefined && !updates.size) {
      const style = { ...node.style, ...updates.style }
      updates = {
        ...updates,
        size: measureNodeSize(updates.content, style.fontSize, style.fontWeight)
      }
    }

    recordHistory('Update node', draft => {
      if (draft.nodes[id]) {
        draft.nodes[id] = {
          ...draft.nodes[id],
          ...updates,
          updatedAt: Date.now()
        }
      }
    })
  },

  deleteNode(id: string) {
    recordHistory('Delete node', draft => {
      // Delete connected edges
      for (const edgeId of Object.keys(draft.edges)) {
        const edge = draft.edges[edgeId]
        if (edge && (edge.sourceId === id || edge.targetId === id)) {
          delete draft.edges[edgeId]
        }
      }

      // Delete child nodes
      for (const nodeId of Object.keys(draft.nodes)) {
        const node = draft.nodes[nodeId]
        if (node && node.parentId === id) {
          delete draft.nodes[nodeId]
        }
      }

      delete draft.nodes[id]
    })

    state.selection.nodeIds.delete(id)
  },

  moveNode(id: string, x: number, y: number, snap: boolean = false) {
    const node = state.nodes.get(id)
    if (!node || node.locked) return

    // Only snap when explicitly requested (snap-on-drop)
    let newX = x
    let newY = y
    if (snap && state.settings.snapToGrid) {
      const gridSize = state.settings.gridSize
      newX = Math.round(x / gridSize) * gridSize
      newY = Math.round(y / gridSize) * gridSize
    }

    // Direct update without history for performance during drag
    const updated = {
      ...node,
      position: { x: newX, y: newY },
      updatedAt: Date.now()
    }
    state.nodes.set(id, updated)
    state.isDirty = true
    state.nodesVersion++
  },

  /** Capture pre-drag positions for undo support */
  beginMoveNodes(nodeIds: string[]): Map<string, { x: number; y: number }> {
    const snapshot = new Map<string, { x: number; y: number }>()
    for (const id of nodeIds) {
      const node = state.nodes.get(id)
      if (node) {
        snapshot.set(id, { x: node.position.x, y: node.position.y })
      }
    }
    return snapshot
  },

  /** Record a single undo entry for a completed drag */
  commitMoveNodes(nodeIds: string[], originalPositions: Map<string, { x: number; y: number }>) {
    // Check if any node actually moved
    let hasMoved = false
    for (const id of nodeIds) {
      const node = state.nodes.get(id)
      const orig = originalPositions.get(id)
      if (node && orig && (node.position.x !== orig.x || node.position.y !== orig.y)) {
        hasMoved = true
        break
      }
    }
    if (!hasMoved) return

    // Capture current positions before recording history
    const finalPositions = new Map<string, { x: number; y: number }>()
    for (const id of nodeIds) {
      const node = state.nodes.get(id)
      if (node) {
        finalPositions.set(id, { x: node.position.x, y: node.position.y })
      }
    }

    // First restore original positions so Immer can produce correct patches
    for (const [id, pos] of originalPositions) {
      const node = state.nodes.get(id)
      if (node) {
        state.nodes.set(id, { ...node, position: { x: pos.x, y: pos.y } })
      }
    }

    // Now record the move as a history entry
    recordHistory('Move nodes', draft => {
      for (const [id, pos] of finalPositions) {
        if (draft.nodes[id]) {
          draft.nodes[id] = {
            ...draft.nodes[id],
            position: { x: pos.x, y: pos.y },
            updatedAt: Date.now()
          }
        }
      }
    })
  },

  resizeNode(id: string, width: number, height: number) {
    const node = state.nodes.get(id)
    if (!node || node.locked) return

    const minWidth = 50
    const minHeight = 30

    actions.updateNode(id, {
      size: {
        width: Math.max(width, minWidth),
        height: Math.max(height, minHeight)
      }
    })
  },

  /**
   * Push overlapping nodes apart. If nodeIds is provided, only those nodes
   * are moved; otherwise all nodes are checked.
   * Uses iterative separation — runs up to 10 passes to settle.
   */
  resolveOverlaps(nodeIds?: string[]) {
    const GAP = 20 // minimum gap between nodes
    const MAX_PASSES = 10

    const candidates = nodeIds
      ? nodeIds.map(id => state.nodes.get(id)).filter(Boolean) as Node[]
      : Array.from(state.nodes.values())

    if (candidates.length < 2) return

    const allNodes = Array.from(state.nodes.values())

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let moved = false

      for (const nodeA of candidates) {
        if (nodeA.locked) continue

        for (const nodeB of allNodes) {
          if (nodeA.id === nodeB.id) continue

          // Check AABB overlap with gap
          const aLeft = nodeA.position.x - GAP
          const aRight = nodeA.position.x + nodeA.size.width + GAP
          const aTop = nodeA.position.y - GAP
          const aBottom = nodeA.position.y + nodeA.size.height + GAP
          const bLeft = nodeB.position.x
          const bRight = nodeB.position.x + nodeB.size.width
          const bTop = nodeB.position.y
          const bBottom = nodeB.position.y + nodeB.size.height

          if (aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop) {
            // Overlap detected — compute push vector
            const overlapX = Math.min(aRight - bLeft, bRight - aLeft)
            const overlapY = Math.min(aBottom - bTop, bBottom - aTop)

            const aCenterX = nodeA.position.x + nodeA.size.width / 2
            const aCenterY = nodeA.position.y + nodeA.size.height / 2
            const bCenterX = nodeB.position.x + nodeB.size.width / 2
            const bCenterY = nodeB.position.y + nodeB.size.height / 2

            // Push along the smaller overlap axis
            if (overlapX < overlapY) {
              const dir = aCenterX < bCenterX ? -1 : 1
              nodeA.position = {
                x: nodeA.position.x + dir * overlapX * 0.5,
                y: nodeA.position.y
              }
            } else {
              const dir = aCenterY < bCenterY ? -1 : 1
              nodeA.position = {
                x: nodeA.position.x,
                y: nodeA.position.y + dir * overlapY * 0.5
              }
            }
            moved = true
          }
        }
      }

      if (!moved) break
    }

    // Commit the moved positions to state
    state.isDirty = true
    state.nodesVersion++
  },

  addEdge(sourceId: string, targetId: string, style?: Partial<EdgeStyle>, sourceAnchor?: Anchor, targetAnchor?: Anchor): Edge {
    const now = Date.now()
    const edge: Edge = {
      id: nanoid(),
      sourceId,
      targetId,
      style: { ...DEFAULT_EDGE_STYLE, ...style },
      sourceAnchor,
      targetAnchor,
      createdAt: now,
      updatedAt: now
    }

    recordHistory('Add edge', draft => {
      draft.edges[edge.id] = edge
    })

    // Update link index
    const linkIndex = useLinkIndex()
    linkIndex.onEdgeAdded(edge)

    return edge
  },

  updateEdge(id: string, updates: Partial<Edge>) {
    const edge = state.edges.get(id)
    if (!edge) return

    recordHistory('Update edge', draft => {
      if (draft.edges[id]) {
        draft.edges[id] = {
          ...draft.edges[id],
          ...updates,
          updatedAt: Date.now()
        }
      }
    })
  },

  deleteEdge(id: string) {
    // Get edge before deletion for link index update
    const edge = state.edges.get(id)

    recordHistory('Delete edge', draft => {
      delete draft.edges[id]
    })

    // Update link index
    if (edge) {
      const linkIndex = useLinkIndex()
      linkIndex.onEdgeRemoved(edge)
    }

    state.selection.edgeIds.delete(id)
  },

  select(nodeIds: string[], edgeIds: string[] = []) {
    state.selection.nodeIds = new Set(nodeIds)
    state.selection.edgeIds = new Set(edgeIds)
  },

  selectAll() {
    state.selection.nodeIds = new Set(state.nodes.keys())
    state.selection.edgeIds = new Set(state.edges.keys())
  },

  clearSelection() {
    state.selection.nodeIds.clear()
    state.selection.edgeIds.clear()
  },

  addToSelection(nodeIds: string[], edgeIds: string[] = []) {
    nodeIds.forEach(id => state.selection.nodeIds.add(id))
    edgeIds.forEach(id => state.selection.edgeIds.add(id))
  },

  removeFromSelection(nodeIds: string[], edgeIds: string[] = []) {
    nodeIds.forEach(id => state.selection.nodeIds.delete(id))
    edgeIds.forEach(id => state.selection.edgeIds.delete(id))
  },

  setCamera(camera: Camera) {
    state.camera = camera
  },

  pan(dx: number, dy: number) {
    state.camera.x += dx
    state.camera.y += dy
  },

  zoom(factor: number, centerX?: number, centerY?: number) {
    const minZoom = 0.1
    const maxZoom = 5

    const newZoom = Math.max(minZoom, Math.min(maxZoom, state.camera.zoom * factor))

    // Zoom towards center point if provided
    if (centerX !== undefined && centerY !== undefined) {
      const zoomRatio = newZoom / state.camera.zoom
      state.camera.x = centerX - (centerX - state.camera.x) * zoomRatio
      state.camera.y = centerY - (centerY - state.camera.y) * zoomRatio
    }

    state.camera.zoom = newZoom
  },

  fitToContent() {
    if (state.nodes.size === 0) {
      state.camera = { x: 0, y: 0, zoom: 1 }
      return
    }

    // Calculate bounds
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of state.nodes.values()) {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.size.width)
      maxY = Math.max(maxY, node.position.y + node.size.height)
    }

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const padding = 100

    // Assuming viewport size (this would come from the actual canvas)
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const scaleX = (viewportWidth - padding * 2) / contentWidth
    const scaleY = (viewportHeight - padding * 2) / contentHeight
    const scale = Math.min(scaleX, scaleY, 2)

    state.camera = {
      x: -(minX + contentWidth / 2) * scale + viewportWidth / 2,
      y: -(minY + contentHeight / 2) * scale + viewportHeight / 2,
      zoom: scale
    }
  },

  undo() {
    if (state.historyIndex < 0) return

    const entry = state.history[state.historyIndex]
    if (!entry) return

    // Apply inverse patches
    const currentState = getSerializableState()
    const previousState = applyPatches(currentState, entry.inversePatches as Patch[])
    applySerializableState(previousState)

    state.historyIndex--
    state.isDirty = true
  },

  redo() {
    if (state.historyIndex >= state.history.length - 1) return

    const entry = state.history[state.historyIndex + 1]
    if (!entry) return

    // Apply patches
    const currentState = getSerializableState()
    const nextState = applyPatches(currentState, entry.patches as Patch[])
    applySerializableState(nextState)

    state.historyIndex++
    state.isDirty = true
  },

  canUndo() {
    return state.historyIndex >= 0
  },

  canRedo() {
    return state.historyIndex < state.history.length - 1
  },

  deleteSelected() {
    recordHistory('Delete selected', draft => {
      // Delete selected edges first
      for (const edgeId of state.selection.edgeIds) {
        delete draft.edges[edgeId]
      }

      // Delete selected nodes and their connected edges
      for (const nodeId of state.selection.nodeIds) {
        // Delete connected edges
        for (const edgeId of Object.keys(draft.edges)) {
          const edge = draft.edges[edgeId]
          if (edge && (edge.sourceId === nodeId || edge.targetId === nodeId)) {
            delete draft.edges[edgeId]
          }
        }
        delete draft.nodes[nodeId]
      }
    })

    actions.clearSelection()
  },

  duplicateSelected(): Node[] {
    const duplicated: Node[] = []
    const offset = 20

    for (const nodeId of state.selection.nodeIds) {
      const node = state.nodes.get(nodeId)
      if (!node) continue

      const newNode = actions.addNode({
        ...node,
        id: undefined,
        position: {
          x: node.position.x + offset,
          y: node.position.y + offset
        }
      })
      duplicated.push(newNode)
    }

    // Select duplicated nodes
    actions.select(duplicated.map(n => n.id))
    return duplicated
  },

  setTitle(title: string) {
    state.title = title
    state.isDirty = true
  },

  markClean() {
    state.isDirty = false
    state.lastSavedAt = Date.now()
  },

  // Link index management
  rebuildLinkIndex() {
    const linkIndex = useLinkIndex()
    linkIndex.rebuildIndex(state.edges)
  },

  getBackLinks(nodeId: string): Node[] {
    const linkIndex = useLinkIndex()
    const backLinkIds = linkIndex.getBackLinks(nodeId)
    return backLinkIds
      .map(id => state.nodes.get(id))
      .filter((node): node is Node => node !== undefined)
  },

  getOutLinks(nodeId: string): Node[] {
    const linkIndex = useLinkIndex()
    const outLinkIds = linkIndex.getOutLinks(nodeId)
    return outLinkIds
      .map(id => state.nodes.get(id))
      .filter((node): node is Node => node !== undefined)
  },

  /** Group multiple node/edge mutations into a single undo/redo entry. */
  batchUpdate(description: string, mutator: () => void) {
    // Snapshot current serializable state before any mutations
    const before = getSerializableState()

    // Run the mutator — it will call addNode/addEdge/deleteNode etc.
    // which internally call recordHistory, BUT we want a single entry.
    // So we temporarily capture history entries and discard individual ones.
    const savedHistory = [...state.history]
    const savedIndex = state.historyIndex

    mutator()

    // Restore history to pre-mutator state and create ONE combined entry
    const after = getSerializableState()
    state.history = savedHistory
    state.historyIndex = savedIndex

    // Use Immer to produce patches for the combined change
    let patches: Patch[] = []
    let inversePatches: Patch[] = []

    produce(
      before,
      (draft: SerializableState) => {
        // Copy the "after" state into the draft
        Object.assign(draft, {
          nodes: { ...after.nodes },
          edges: { ...after.edges },
          title: after.title,
          camera: after.camera,
          settings: after.settings,
        })
      },
      (p, ip) => {
        patches = p
        inversePatches = ip
      }
    )

    if (patches.length === 0) return

    // Truncate future history
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1)
    }

    const entry: HistoryEntry = {
      id: nanoid(),
      timestamp: Date.now(),
      description,
      patches,
      inversePatches
    }

    state.history.push(entry)
    if (state.history.length > state.maxHistory) {
      state.history.shift()
    } else {
      state.historyIndex++
    }

    // Apply the final state
    applySerializableState(after)
    state.isDirty = true
  },

  // Graph view management
  openGraphView(options?: Partial<GraphViewOptions>) {
    state.graphView.isOpen = true
    if (options) {
      state.graphView.options = {
        ...state.graphView.options,
        ...options,
        filters: { ...state.graphView.options.filters, ...options.filters },
        physics: { ...state.graphView.options.physics, ...options.physics }
      }
    }
  },

  closeGraphView() {
    state.graphView.isOpen = false
  },

  openLocalGraph(nodeId: string, depth: number = 2) {
    state.graphView.isOpen = true
    state.graphView.options = {
      ...state.graphView.options,
      mode: 'local',
      centerNodeId: nodeId,
      depth
    }
  },

  updateGraphViewOptions(options: Partial<GraphViewOptions>) {
    state.graphView.options = {
      ...state.graphView.options,
      ...options,
      filters: { ...state.graphView.options.filters, ...options.filters },
      physics: { ...state.graphView.options.physics, ...options.physics }
    }
  }
}

// Composable for using the store
export function useMapStore(): MapStore {
  // Return a reactive object that combines state and actions
  // Using reactive() wrapper to maintain reactivity when spreading
  return reactive({
    // State properties (will be reactive)
    get id() { return state.id },
    get title() { return state.title },
    get nodes() { return state.nodes },
    get edges() { return state.edges },
    get camera() { return state.camera },
    get settings() { return state.settings },
    get rootNodeId() { return state.rootNodeId },
    get selection() { return state.selection },
    get history() { return state.history },
    get historyIndex() { return state.historyIndex },
    get maxHistory() { return state.maxHistory },
    get isDirty() { return state.isDirty },
    get lastSavedAt() { return state.lastSavedAt },
    get createdAt() { return state.createdAt },
    get nodesVersion() { return state.nodesVersion },
    get graphView() { return state.graphView },
    // Actions
    ...actions
  }) as unknown as MapStore
}

// Export for direct access
export { state as mapState, actions as mapActions }
