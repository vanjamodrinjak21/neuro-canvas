import type { Point, Node, Edge, Camera } from '~/types/canvas'
import { resolveEdgeEndpoints } from '~/components/canvas/renderers/shared'

/**
 * Pure geometry hit-testing for nodes and edges.
 * Extracted from InfiniteCanvas.vue.
 */

/**
 * Find the node whose bounding box contains the given world-space point.
 * When nodes overlap the last one in Map iteration order wins (topmost visually).
 */
export function findNodeAtPosition(worldPos: Point, nodes: Map<string, Node>): Node | null {
  // Iterate in reverse to get topmost node first
  const nodeArray = Array.from(nodes.values()).reverse()
  for (const node of nodeArray) {
    if (
      worldPos.x >= node.position.x &&
      worldPos.x <= node.position.x + node.size.width &&
      worldPos.y >= node.position.y &&
      worldPos.y <= node.position.y + node.size.height
    ) {
      return node
    }
  }
  return null
}

/**
 * Calculate the distance from a point to a line segment (clamped projection).
 */
export function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x
  const dy = lineEnd.y - lineStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    // Line is a point
    return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2))
  }

  // Project point onto line, clamped to segment
  let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))

  const projX = lineStart.x + t * dx
  const projY = lineStart.y + t * dy

  return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2))
}


/**
 * Find the edge whose line segment is within threshold distance of the given world-space point.
 * The threshold is scaled by camera zoom so it stays consistent in screen space.
 */
export function findEdgeAtPosition(
  worldPos: Point,
  edges: Map<string, Edge>,
  nodes: Map<string, Node>,
  camera: Camera,
  threshold: number = 8
): Edge | null {
  for (const edge of edges.values()) {
    const sourceNode = nodes.get(edge.sourceId)
    const targetNode = nodes.get(edge.targetId)
    if (!sourceNode || !targetNode) continue

    // Same nearest-side endpoints the renderer uses, so the clickable area
    // tracks where the edge is actually drawn.
    const { sourcePoint, targetPoint } = resolveEdgeEndpoints(
      sourceNode, targetNode, edge.sourceAnchor, edge.targetAnchor
    )

    // Calculate distance from point to line segment
    const distance = pointToLineDistance(worldPos, sourcePoint, targetPoint)
    if (distance <= threshold / camera.zoom) {
      return edge
    }
  }
  return null
}
