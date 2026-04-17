import { ref, type Ref } from 'vue'
import type { Node, Edge, Anchor, Point } from '~/types'
import {
  getVisibleAnchors,
  checkAnchorSnap,
  getBestAnchorPair
} from '~/composables/useAnchors'

export interface ConnectionResult {
  sourceId: string
  targetId: string
  sourceAnchor: Anchor
  targetAnchor: Anchor
}

interface ConnectionToolDeps {
  nodes: () => Map<string, Node>
  edges: () => Map<string, Edge>
  rootNodeId: () => string | null
  hoveredNodeId: Ref<string | null>
  tool: Ref<string>
}

export function useConnectionTool(deps: ConnectionToolDeps) {
  const isConnecting = ref(false)
  const connectionSourceNode = ref<Node | null>(null)
  const connectionPreviewEnd = ref<Point | null>(null)
  const connectionSourceAnchor = ref<Anchor | null>(null)
  const connectionSnapTarget = ref<{ node: Node; anchor: Anchor; point: Point } | null>(null)
  const visibleAnchors = ref<Map<string, Anchor[]>>(new Map())

  /**
   * Recompute which anchors are visible.
   * - In connect mode while dragging: show anchors on all non-source nodes.
   * - In connect mode idle: show anchors only on the hovered node.
   * - Any other tool: clear all anchors.
   */
  function updateAnchorVisibility() {
    visibleAnchors.value.clear()
    if (deps.tool.value !== 'connect') return

    if (isConnecting.value) {
      // Show anchors on all potential target nodes (skip the source)
      for (const node of deps.nodes().values()) {
        if (node.id !== connectionSourceNode.value?.id) {
          const isRoot = node.isRoot || node.id === deps.rootNodeId()
          visibleAnchors.value.set(node.id, getVisibleAnchors(node, isRoot, deps.edges()))
        }
      }
    } else if (deps.hoveredNodeId.value) {
      // Show only on the currently hovered node
      const node = deps.nodes().get(deps.hoveredNodeId.value)
      if (node) {
        const isRoot = node.isRoot || node.id === deps.rootNodeId()
        visibleAnchors.value.set(node.id, getVisibleAnchors(node, isRoot, deps.edges()))
      }
    }
  }

  /**
   * Begin a connection drag from a node.
   * Snaps to a specific anchor if the cursor is close enough (threshold 20 px),
   * otherwise defaults to the 'right' anchor.
   */
  function startConnection(node: Node, worldPos: Point) {
    isConnecting.value = true
    connectionSourceNode.value = node
    connectionPreviewEnd.value = worldPos

    const nodeAnchors = visibleAnchors.value.get(node.id)
    if (nodeAnchors) {
      const snap = checkAnchorSnap(worldPos, node, nodeAnchors, 20)
      connectionSourceAnchor.value = snap ? snap.anchor : 'right'
    } else {
      connectionSourceAnchor.value = 'right'
    }

    updateAnchorVisibility()
  }

  /**
   * Update the preview line endpoint and check for target anchor snap
   * while the user is dragging.
   */
  function updateConnection(worldPos: Point) {
    connectionPreviewEnd.value = worldPos
    connectionSnapTarget.value = null

    for (const node of deps.nodes().values()) {
      if (node.id === connectionSourceNode.value?.id) continue

      const nodeAnchors = visibleAnchors.value.get(node.id)
      if (nodeAnchors) {
        const snap = checkAnchorSnap(worldPos, node, nodeAnchors, 30)
        if (snap) {
          connectionSnapTarget.value = { node, anchor: snap.anchor, point: snap.point }
          deps.hoveredNodeId.value = node.id
          break
        }
      }
    }
  }

  /**
   * Finish the connection drag.
   * Returns edge endpoint data when a valid snap target exists, otherwise null.
   * Accepts an optional fallback hit-test result for when the cursor lands on a
   * node body without snapping to an anchor.
   * Always resets connection state.
   */
  function finishConnection(
    hitNode?: Node | null
  ): ConnectionResult | null {
    let result: ConnectionResult | null = null

    const sourceNode = connectionSourceNode.value
    if (sourceNode) {
      let targetNode: Node | null = null
      let targetAnchor: Anchor | undefined

      if (connectionSnapTarget.value) {
        targetNode = connectionSnapTarget.value.node
        targetAnchor = connectionSnapTarget.value.anchor
      } else if (hitNode) {
        targetNode = hitNode
      }

      if (targetNode && targetNode.id !== sourceNode.id) {
        let sourceAnchor: Anchor = connectionSourceAnchor.value ?? 'right'

        if (!targetAnchor) {
          const bestPair = getBestAnchorPair(sourceNode, targetNode)
          if (!connectionSourceAnchor.value) {
            sourceAnchor = bestPair.sourceAnchor
          }
          targetAnchor = bestPair.targetAnchor
        }

        result = {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          sourceAnchor,
          targetAnchor
        }
      }
    }

    resetConnection()
    return result
  }

  /**
   * Reset all connection state to idle.
   */
  function resetConnection() {
    isConnecting.value = false
    connectionSourceNode.value = null
    connectionPreviewEnd.value = null
    connectionSourceAnchor.value = null
    connectionSnapTarget.value = null
    visibleAnchors.value.clear()
  }

  return {
    isConnecting,
    connectionSourceNode,
    connectionPreviewEnd,
    connectionSourceAnchor,
    connectionSnapTarget,
    visibleAnchors,
    updateAnchorVisibility,
    startConnection,
    updateConnection,
    finishConnection,
    resetConnection
  }
}
