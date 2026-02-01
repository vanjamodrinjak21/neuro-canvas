import type { Node, Point, Anchor, Edge } from '~/types'

/**
 * Anchor calculation and snap utilities for node connection system
 */

// Anchor offset from node edge (in pixels)
const ANCHOR_OFFSET = 0

/**
 * Get the world position of an anchor point on a node
 */
export function getAnchorPoint(node: Node, anchor: Anchor): Point {
  const { x, y } = node.position
  const { width, height } = node.size

  switch (anchor) {
    case 'top':
      return { x: x + width / 2, y: y - ANCHOR_OFFSET }
    case 'right':
      return { x: x + width + ANCHOR_OFFSET, y: y + height / 2 }
    case 'bottom':
      return { x: x + width / 2, y: y + height + ANCHOR_OFFSET }
    case 'left':
      return { x: x - ANCHOR_OFFSET, y: y + height / 2 }
  }
}

/**
 * Get all anchor positions for a node
 */
export function getAllAnchorPoints(node: Node): Map<Anchor, Point> {
  const anchors: Anchor[] = ['top', 'right', 'bottom', 'left']
  const points = new Map<Anchor, Point>()

  for (const anchor of anchors) {
    points.set(anchor, getAnchorPoint(node, anchor))
  }

  return points
}

/**
 * Determine which anchors should be visible for a node
 * - Root nodes show all 4 anchors
 * - Regular nodes show 2 anchors based on connected edges (dynamic visibility)
 */
export function getVisibleAnchors(
  node: Node,
  isRoot: boolean,
  edges: Map<string, Edge>
): Anchor[] {
  // Root nodes always show all 4 anchors
  if (isRoot) {
    return ['top', 'right', 'bottom', 'left']
  }

  // For regular nodes, determine anchors based on existing connections
  const usedAnchors = new Set<Anchor>()

  for (const edge of edges.values()) {
    if (edge.sourceId === node.id && edge.sourceAnchor) {
      usedAnchors.add(edge.sourceAnchor)
    }
    if (edge.targetId === node.id && edge.targetAnchor) {
      usedAnchors.add(edge.targetAnchor)
    }
  }

  // Always show at least right and left for regular nodes (most common connection points)
  const baseAnchors: Anchor[] = ['right', 'left']

  // Add any anchors that have connections
  const allAnchors = new Set<Anchor>(baseAnchors)
  for (const anchor of usedAnchors) {
    allAnchors.add(anchor)
  }

  return Array.from(allAnchors)
}

/**
 * Find the nearest anchor to a cursor position
 */
export function findNearestAnchor(
  cursor: Point,
  node: Node,
  anchors: Anchor[]
): { anchor: Anchor; point: Point; distance: number } | null {
  if (anchors.length === 0) return null

  let nearest: { anchor: Anchor; point: Point; distance: number } | null = null

  for (const anchor of anchors) {
    const point = getAnchorPoint(node, anchor)
    const distance = Math.sqrt(
      Math.pow(cursor.x - point.x, 2) + Math.pow(cursor.y - point.y, 2)
    )

    if (!nearest || distance < nearest.distance) {
      nearest = { anchor, point, distance }
    }
  }

  return nearest
}

/**
 * Check if cursor is within snap threshold of any anchor
 */
export function checkAnchorSnap(
  cursor: Point,
  node: Node,
  anchors: Anchor[],
  threshold: number = 30
): { anchor: Anchor; point: Point } | null {
  const nearest = findNearestAnchor(cursor, node, anchors)

  if (nearest && nearest.distance <= threshold) {
    return { anchor: nearest.anchor, point: nearest.point }
  }

  return null
}

/**
 * Get the best anchor for a connection from source to target node
 * Based on relative positions of nodes
 */
export function getBestAnchorPair(
  sourceNode: Node,
  targetNode: Node
): { sourceAnchor: Anchor; targetAnchor: Anchor } {
  const sourceCenterX = sourceNode.position.x + sourceNode.size.width / 2
  const sourceCenterY = sourceNode.position.y + sourceNode.size.height / 2
  const targetCenterX = targetNode.position.x + targetNode.size.width / 2
  const targetCenterY = targetNode.position.y + targetNode.size.height / 2

  const dx = targetCenterX - sourceCenterX
  const dy = targetCenterY - sourceCenterY

  // Determine primary direction
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    if (dx > 0) {
      return { sourceAnchor: 'right', targetAnchor: 'left' }
    } else {
      return { sourceAnchor: 'left', targetAnchor: 'right' }
    }
  } else {
    // Vertical dominant
    if (dy > 0) {
      return { sourceAnchor: 'bottom', targetAnchor: 'top' }
    } else {
      return { sourceAnchor: 'top', targetAnchor: 'bottom' }
    }
  }
}

/**
 * Composable hook for anchor utilities
 */
export function useAnchors() {
  return {
    getAnchorPoint,
    getAllAnchorPoints,
    getVisibleAnchors,
    findNearestAnchor,
    checkAnchorSnap,
    getBestAnchorPair
  }
}
