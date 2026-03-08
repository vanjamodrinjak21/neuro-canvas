// Viewport culling composable — wraps QuadTree for fast visibility queries
// Also provides LOD (Level of Detail) based on zoom level

import type { Camera, Node, Edge, NodeLOD } from '~/types/canvas'
import { QuadTree } from '~/utils/QuadTree'

export function useViewportCulling() {
  let quadTree = new QuadTree({ x: -50000, y: -50000, width: 100000, height: 100000 })

  /**
   * Rebuild the spatial index from scratch
   */
  function rebuild(nodes: Map<string, Node>) {
    quadTree = new QuadTree({ x: -50000, y: -50000, width: 100000, height: 100000 })
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
    if (zoom >= 0.4) return 'full'
    if (zoom >= 0.15) return 'simplified'
    return 'dot'
  }

  return {
    rebuild,
    updateNode,
    removeNode,
    getVisibleNodeIds,
    getVisibleEdgeIds,
    getNodeLOD
  }
}
