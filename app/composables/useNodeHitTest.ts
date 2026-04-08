import type { Point, Node, Edge, Camera } from '~/types/canvas'
import { getAnchorPoint } from '~/composables/useAnchors'

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
 * Get the point on the node's rectangular boundary in the direction of targetPoint.
 * Used for edges that don't have explicit anchor points.
 */
function getEdgePoint(node: Node, targetPoint: Point): Point {
  const cx = node.position.x + node.size.width / 2
  const cy = node.position.y + node.size.height / 2
  const dx = targetPoint.x - cx
  const dy = targetPoint.y - cy

  const hw = node.size.width / 2
  const hh = node.size.height / 2

  // Calculate intersection with rectangle boundary
  const sx = dx === 0 ? 0 : Math.abs(hw / dx)
  const sy = dy === 0 ? 0 : Math.abs(hh / dy)
  const s = Math.min(sx || Infinity, sy || Infinity)

  return {
    x: cx + dx * s,
    y: cy + dy * s
  }
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

    // Get edge endpoint positions
    let sourcePoint: Point
    let targetPoint: Point

    if (edge.sourceAnchor) {
      sourcePoint = getAnchorPoint(sourceNode, edge.sourceAnchor)
    } else {
      const targetCenter = {
        x: targetNode.position.x + targetNode.size.width / 2,
        y: targetNode.position.y + targetNode.size.height / 2
      }
      sourcePoint = getEdgePoint(sourceNode, targetCenter)
    }

    if (edge.targetAnchor) {
      targetPoint = getAnchorPoint(targetNode, edge.targetAnchor)
    } else {
      const sourceCenter = {
        x: sourceNode.position.x + sourceNode.size.width / 2,
        y: sourceNode.position.y + sourceNode.size.height / 2
      }
      targetPoint = getEdgePoint(targetNode, sourceCenter)
    }

    // Calculate distance from point to line segment
    const distance = pointToLineDistance(worldPos, sourcePoint, targetPoint)
    if (distance <= threshold / camera.zoom) {
      return edge
    }
  }
  return null
}
