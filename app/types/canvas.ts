// Canvas Types for NeuroCanvas

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Rect extends Point, Size {}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface Viewport extends Rect {
  zoom: number
}

// Node Types
export type NodeType = 'text' | 'image' | 'icon' | 'note'
export type NodeShape = 'rounded' | 'rectangle' | 'circle' | 'diamond'

// Anchor Types
export type Anchor = 'top' | 'right' | 'bottom' | 'left'

export interface NodeStyle {
  shape: NodeShape
  fillColor: string
  borderColor: string
  borderWidth: number
  textColor: string
  fontSize: number
  fontWeight: number
  shadowEnabled: boolean
  glowEnabled: boolean
}

export interface Node {
  id: string
  type: NodeType
  position: Point
  size: Size
  content: string
  style: NodeStyle
  parentId?: string
  collapsed?: boolean
  locked?: boolean
  isRoot?: boolean  // Main topic node marker
  metadata?: Record<string, unknown>
  // Semantic embedding data (populated by AI system)
  semantic?: {
    embedding?: number[]
    embeddingVersion?: number
  }
  createdAt: number
  updatedAt: number
}

// Edge Types
export type EdgeType = 'bezier' | 'straight' | 'orthogonal'
export type ArrowStyle = 'none' | 'arrow' | 'dot' | 'diamond'

export interface EdgeStyle {
  type: EdgeType
  strokeColor: string
  strokeWidth: number
  arrowStart: ArrowStyle
  arrowEnd: ArrowStyle
  animated: boolean
  dashArray?: number[]
}

export interface Edge {
  id: string
  sourceId: string
  targetId: string
  style: EdgeStyle
  label?: string
  controlPoints?: Point[]
  sourceAnchor?: Anchor
  targetAnchor?: Anchor
  createdAt: number
  updatedAt: number
}

// Selection
export interface Selection {
  nodeIds: Set<string>
  edgeIds: Set<string>
}

// Tool Types
export type CanvasTool = 'select' | 'pan' | 'node' | 'edge' | 'text' | 'connect'

// Layout Types
export type LayoutType = 'force' | 'radial' | 'tree' | 'orgChart'

export interface LayoutOptions {
  type: LayoutType
  spacing: number
  direction?: 'horizontal' | 'vertical'
  centerX?: number
  centerY?: number
}

// Render Types
export interface RenderContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D | GPUCanvasContext
  camera: Camera
  viewport: Viewport
  dpr: number
}

// Event Types
export interface CanvasPointerEvent {
  screenPosition: Point
  worldPosition: Point
  button: number
  buttons: number
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

// Map Document
export interface MapDocument {
  id: string
  title: string
  nodes: Map<string, Node>
  edges: Map<string, Edge>
  camera: Camera
  rootNodeId?: string  // ID of the main topic/root node
  createdAt: number
  updatedAt: number
  settings: MapSettings
}

export interface MapSettings {
  gridEnabled: boolean
  gridSize: number
  snapToGrid: boolean
  backgroundColor: string
  defaultNodeStyle: Partial<NodeStyle>
  defaultEdgeStyle: Partial<EdgeStyle>
}

// History
export interface HistoryEntry {
  id: string
  timestamp: number
  description: string
  patches: unknown[] // Immer patches
  inversePatches: unknown[]
}

// Collaboration
export interface Cursor {
  id: string
  userId: string
  userName: string
  color: string
  position: Point
  timestamp: number
}

export interface Awareness {
  cursors: Map<string, Cursor>
  selections: Map<string, Selection>
}

// Graph View Types
export interface GraphNode {
  id: string
  label: string
  type: NodeType
  x?: number  // Position from simulation
  y?: number
  fx?: number | null  // Fixed position (for pinning)
  fy?: number | null
  connections: number  // Total link count
  color?: string
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  weight: number  // Number of links
}

export interface GraphViewOptions {
  mode: 'local' | 'global'
  centerNodeId?: string  // For local mode
  depth: number  // How many hops to show in local mode
  filters: {
    nodeTypes?: NodeType[]
    tags?: string[]
    searchQuery?: string
  }
  physics: {
    linkDistance: number
    repulsionStrength: number
    centerForce: number
    collisionRadius: number
  }
}

// Link Index Types
export interface LinkIndex {
  // Forward links: nodeId → Set of nodes it links TO
  outLinks: Map<string, Set<string>>

  // Backward links: nodeId → Set of nodes that link TO it
  backLinks: Map<string, Set<string>>

  // Link counts (for weighted edges in graph view)
  linkCounts: Map<string, Map<string, number>>
}
