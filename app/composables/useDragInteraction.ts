import { ref } from 'vue'
import type { Node, Point } from '~/types/canvas'

const DRAG_THRESHOLD = 3 // pixels in screen space

interface DragDeps {
  nodes: () => Map<string, Node>
  selectedNodeIds: () => Set<string>
  moveNode: (id: string, x: number, y: number, snap?: boolean) => void
  beginMoveNodes: (nodeIds: string[]) => Map<string, { x: number; y: number }>
  commitMoveNodes: (nodeIds: string[], originalPositions: Map<string, { x: number; y: number }>) => void
  bumpNodesVersion: () => void
}

export function useDragInteraction(deps: DragDeps) {
  const isDragging = ref(false)
  const pendingDrag = ref(false)
  const dragStart = ref<Point | null>(null)
  const dragStartScreen = ref<Point | null>(null)

  // Plain let variables — mutable shared state between beginDrag/updateDrag/commitDrag
  let dragOriginalPositions: Map<string, { x: number; y: number }> | null = null
  let dragNodeOffsets: Map<string, Point> | null = null

  /**
   * Called on pointer-down over a node: marks drag as pending and records the
   * world and screen positions where the gesture started.
   */
  function initiateDrag(worldPos: Point, screenPos: Point) {
    pendingDrag.value = true
    isDragging.value = false
    dragStart.value = worldPos
    dragStartScreen.value = screenPos
  }

  /**
   * Returns true when the pointer has moved far enough from the drag origin to
   * be treated as a real drag (rather than an accidental micro-movement).
   */
  function checkThreshold(screenPos: Point): boolean {
    if (!dragStartScreen.value) return false
    const tdx = screenPos.x - dragStartScreen.value.x
    const tdy = screenPos.y - dragStartScreen.value.y
    return Math.sqrt(tdx * tdx + tdy * tdy) >= DRAG_THRESHOLD
  }

  /**
   * Transitions from pending → active drag. Captures each selected node's
   * original position (for undo) and its offset from the click point.
   * Must be called once, exactly when checkThreshold first returns true.
   */
  function beginDrag() {
    if (!dragStart.value) return

    isDragging.value = true

    const nodeIds = [...deps.selectedNodeIds()]
    dragOriginalPositions = deps.beginMoveNodes(nodeIds)

    // Store absolute offset: click point → node position, so we can reconstruct
    // each node's target position from the current mouse position without drift.
    dragNodeOffsets = new Map()
    for (const nodeId of nodeIds) {
      const node = deps.nodes().get(nodeId)
      if (node && !(node as any).locked) {
        dragNodeOffsets.set(nodeId, {
          x: node.position.x - dragStart.value.x,
          y: node.position.y - dragStart.value.y
        })
      }
    }
  }

  /**
   * Moves every dragged node to `worldPos + stored_offset`, then applies an
   * optional micro-snap correction (snapDx/snapDy from smart alignment guides).
   * Calls bumpNodesVersion after the snap pass so the minimap re-renders.
   */
  function updateDrag(worldPos: Point, snapDx: number = 0, snapDy: number = 0) {
    if (!dragNodeOffsets) return

    // Move each node to the absolute target position (drift-free)
    for (const [nodeId, offset] of dragNodeOffsets) {
      const targetX = worldPos.x + offset.x
      const targetY = worldPos.y + offset.y
      deps.moveNode(nodeId, targetX, targetY, false) // no snap during drag
    }

    // Apply smart-guide snap correction
    if (snapDx !== 0 || snapDy !== 0) {
      for (const [nodeId] of dragNodeOffsets) {
        const node = deps.nodes().get(nodeId)
        if (node && !(node as any).locked) {
          deps.moveNode(nodeId, node.position.x + snapDx, node.position.y + snapDy, false)
        }
      }
    }

    deps.bumpNodesVersion()
  }

  /**
   * Finalises the drag: applies snap-on-drop to each node then records a single
   * undo entry for the entire move. Resets all drag state.
   */
  function commitDrag() {
    if (!isDragging.value || !dragNodeOffsets || !dragOriginalPositions) return

    // Snap-on-drop: apply grid snap to final positions
    for (const [nodeId] of dragNodeOffsets) {
      const node = deps.nodes().get(nodeId)
      if (node && !(node as any).locked) {
        deps.moveNode(nodeId, node.position.x, node.position.y, true) // snap on drop
      }
    }

    const nodeIds = [...dragNodeOffsets.keys()]
    deps.commitMoveNodes(nodeIds, dragOriginalPositions)

    _reset()
  }

  /**
   * Cancels a pending or active drag without committing positions to history.
   */
  function cancelDrag() {
    _reset()
  }

  function _reset() {
    isDragging.value = false
    pendingDrag.value = false
    dragStart.value = null
    dragStartScreen.value = null
    dragOriginalPositions = null
    dragNodeOffsets = null
  }

  return {
    isDragging,
    pendingDrag,
    dragStart,
    dragStartScreen,
    initiateDrag,
    checkThreshold,
    beginDrag,
    updateDrag,
    commitDrag,
    cancelDrag
  }
}
