import type { Node, Edge } from '~/types/canvas'

export interface LayoutPosition {
  x: number
  y: number
}

/**
 * Reingold-Tilford-inspired radial tree layout.
 *
 * Pure function: (nodes, edges, rootNodeId) → Map<nodeId, {x, y}>
 *
 * 1. Build tree from edges (adjacency list)
 * 2. Bottom-up: compute subtree angular widths (leaves = 1 unit)
 * 3. Top-down from root at (0,0): distribute children in full circle
 * 4. Translate so all coords are positive
 */
export function radialTreeLayout(
  nodes: Map<string, Node>,
  edges: Map<string, Edge>,
  rootNodeId: string | null
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>()
  if (nodes.size === 0) return positions

  // Build adjacency list (parent → children)
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()

  for (const edge of edges.values()) {
    if (!nodes.has(edge.sourceId) || !nodes.has(edge.targetId)) continue
    const list = childrenOf.get(edge.sourceId) || []
    list.push(edge.targetId)
    childrenOf.set(edge.sourceId, list)
    hasParent.add(edge.targetId)
  }

  // Find root — prefer provided rootNodeId, otherwise find a node with no parent
  let root = rootNodeId && nodes.has(rootNodeId) ? rootNodeId : null
  if (!root) {
    for (const node of nodes.values()) {
      if (!hasParent.has(node.id)) {
        root = node.id
        break
      }
    }
  }
  if (!root) root = nodes.keys().next().value!

  // Step 1: Compute subtree sizes (number of leaf descendants)
  const subtreeSize = new Map<string, number>()
  const visited = new Set<string>()

  function computeSize(nodeId: string): number {
    if (visited.has(nodeId)) return 0
    visited.add(nodeId)

    const children = childrenOf.get(nodeId) || []
    if (children.length === 0) {
      subtreeSize.set(nodeId, 1)
      return 1
    }

    let size = 0
    for (const childId of children) {
      size += computeSize(childId)
    }
    subtreeSize.set(nodeId, size)
    return size
  }

  computeSize(root)

  // Step 2: Assign positions using radial layout
  const RADIUS_STEP = 200 // px per level

  function layoutNode(
    nodeId: string,
    depth: number,
    angleStart: number,
    angleEnd: number,
    layoutVisited: Set<string>
  ) {
    if (layoutVisited.has(nodeId)) return
    layoutVisited.add(nodeId)

    if (depth === 0) {
      positions.set(nodeId, { x: 0, y: 0 })
    } else {
      const angle = (angleStart + angleEnd) / 2
      const radius = depth * RADIUS_STEP
      positions.set(nodeId, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      })
    }

    const children = childrenOf.get(nodeId) || []
    if (children.length === 0) return

    const totalSize = subtreeSize.get(nodeId) || 1
    let currentAngle = angleStart

    for (const childId of children) {
      const childSize = subtreeSize.get(childId) || 1
      const childAngleSpan = (childSize / totalSize) * (angleEnd - angleStart)
      layoutNode(childId, depth + 1, currentAngle, currentAngle + childAngleSpan, layoutVisited)
      currentAngle += childAngleSpan
    }
  }

  const layoutVisited = new Set<string>()
  layoutNode(root, 0, 0, Math.PI * 2, layoutVisited)

  // Layout orphan nodes (not reachable from root)
  let orphanY = 0
  for (const node of nodes.values()) {
    if (!layoutVisited.has(node.id)) {
      // Find max x position so far
      let maxX = 0
      for (const pos of positions.values()) {
        maxX = Math.max(maxX, pos.x)
      }
      positions.set(node.id, { x: maxX + RADIUS_STEP, y: orphanY })
      orphanY += 80
    }
  }

  // Step 3: Translate all positions so coordinates are positive (with padding)
  const PADDING = 100
  let minX = Infinity
  let minY = Infinity

  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
  }

  for (const [id, pos] of positions) {
    positions.set(id, {
      x: pos.x - minX + PADDING,
      y: pos.y - minY + PADDING,
    })
  }

  return positions
}
