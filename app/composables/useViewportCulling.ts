// Viewport culling composable — wraps QuadTree for fast visibility queries
// Also provides LOD (Level of Detail) based on zoom level

import type { Camera, Node, Edge, NodeLOD, Point } from '~/types/canvas'
import { QuadTree, type QTRect } from '~/utils/QuadTree'

/**
 * Zoom at/above which nodes render at full detail. Selection-only UI such as
 * resize handles is both drawn AND hit-tested only at full LOD, so renderer
 * and interaction share this single threshold and can never drift apart.
 */
export const FULL_LOD_ZOOM = 0.4

/**
 * Slack (world units) added around the node extent so a node nudged slightly
 * past the current edge during a drag still indexes without an immediate
 * rebuild. Structural changes (add/remove) mark the index dirty and rebuild.
 */
const BOUNDS_MARGIN = 4000
/** Minimum index span so a single/clustered map still subdivides sensibly. */
const MIN_SPAN = 4000
/** Fallback bounds for an empty map (matches the historical default). */
const FALLBACK_BOUNDS: QTRect = { x: -50000, y: -50000, width: 100000, height: 100000 }

/**
 * Compute a quadtree bounds rect that fully encloses every node, with margin.
 *
 * Previously the index used a hard-coded ±50000 box. Large generated maps span
 * far beyond that (10k-node maps reach ~±136000), so ~99% of nodes fell outside
 * the box and `QuadTree.insert` silently rejected them — they never rendered or
 * hit-tested. Sizing the box to the actual content fixes that.
 */
export function computeNodeBounds(nodes: Map<string, Node>): QTRect {
  if (nodes.size === 0) return { ...FALLBACK_BOUNDS }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes.values()) {
    const { x, y } = node.position
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + node.size.width)
    maxY = Math.max(maxY, y + node.size.height)
  }
  minX -= BOUNDS_MARGIN
  minY -= BOUNDS_MARGIN
  maxX += BOUNDS_MARGIN
  maxY += BOUNDS_MARGIN
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, MIN_SPAN),
    height: Math.max(maxY - minY, MIN_SPAN)
  }
}

export function useViewportCulling() {
  let bounds: QTRect = { ...FALLBACK_BOUNDS }
  let quadTree = new QuadTree(bounds)

  /**
   * Rebuild the spatial index from scratch, sizing it to the current nodes.
   */
  function rebuild(nodes: Map<string, Node>) {
    bounds = computeNodeBounds(nodes)
    quadTree = new QuadTree(bounds)
    for (const node of nodes.values()) {
      quadTree.insert({
        id: node.id,
        rect: {
          x: node.position.x,
          y: node.position.y,
          width: node.size.width,
          height: node.size.height
        }
      })
    }
  }

  /**
   * Insert/update a single node in the index
   */
  function updateNode(node: Node) {
    quadTree.remove(node.id)
    quadTree.insert({
      id: node.id,
      rect: {
        x: node.position.x,
        y: node.position.y,
        width: node.size.width,
        height: node.size.height
      }
    })
  }

  /**
   * Remove a node from the index
   */
  function removeNode(nodeId: string) {
    quadTree.remove(nodeId)
  }

  /**
   * Get IDs of nodes visible in the current viewport (with optional buffer)
   */
  function getVisibleNodeIds(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    buffer: number = 100
  ): Set<string> {
    // Viewport bounds in world coordinates
    const worldX = -camera.x / camera.zoom - buffer
    const worldY = -camera.y / camera.zoom - buffer
    const worldW = viewportWidth / camera.zoom + buffer * 2
    const worldH = viewportHeight / camera.zoom + buffer * 2

    return quadTree.queryRect({
      x: worldX,
      y: worldY,
      width: worldW,
      height: worldH
    })
  }

  /**
   * Spatial candidates for hit-testing: node IDs whose bounding box contains
   * the given world-space point. O(log n + k) via the quadtree instead of the
   * O(n) linear scan that hit-testing used to do over every node.
   */
  function getNodeIdsAt(point: Point): Set<string> {
    return quadTree.queryRect({ x: point.x, y: point.y, width: 0, height: 0 })
  }

  /**
   * Node IDs intersecting an arbitrary world-space rect — used to narrow edge
   * hit-testing to edges whose endpoints lie near the cursor.
   */
  function getNodeIdsInRect(rect: QTRect): Set<string> {
    return quadTree.queryRect(rect)
  }

  /**
   * Get IDs of edges that have at least one visible endpoint
   */
  function getVisibleEdgeIds(
    edges: Map<string, Edge>,
    visibleNodeIds: Set<string>
  ): Set<string> {
    const result = new Set<string>()
    for (const edge of edges.values()) {
      if (visibleNodeIds.has(edge.sourceId) || visibleNodeIds.has(edge.targetId)) {
        result.add(edge.id)
      }
    }
    return result
  }

  /**
   * Get LOD level based on zoom
   */
  function getNodeLOD(zoom: number): NodeLOD {
    if (zoom >= FULL_LOD_ZOOM) return 'full'
    if (zoom >= 0.15) return 'simplified'
    return 'dot'
  }

  return {
    rebuild,
    updateNode,
    removeNode,
    getVisibleNodeIds,
    getVisibleEdgeIds,
    getNodeIdsAt,
    getNodeIdsInRect,
    getNodeLOD
  }
}
