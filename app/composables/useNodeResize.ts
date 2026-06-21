import { ref } from 'vue'
import type { Node, Point, Size } from '~/types/canvas'
import { computeResizedRect, type ResizeHandle, type Rect } from '~/utils/resizeHandles'

interface NodeRectSnapshot {
  position: Point
  size: Size
}

interface ResizeDeps {
  nodes: () => Map<string, Node>
  /** Capture pre-resize position+size for undo; null if node missing/locked. */
  beginResizeNode: (id: string) => NodeRectSnapshot | null
  /** Live, history-free rect update during the drag. */
  setNodeRect: (id: string, rect: Rect) => void
  /** Record a single undo entry for the completed resize + flag as manual. */
  commitResizeNode: (id: string, original: NodeRectSnapshot) => void
  bumpNodesVersion: () => void
  minWidth?: number
  minHeight?: number
}

/**
 * Drives an interactive node resize: begin (on a handle pointer-down),
 * update (per pointer-move, honoring the Shift→proportional modifier),
 * and commit (one undo entry on pointer-up). Mirrors useDragInteraction's
 * begin/update/commit lifecycle so the interaction layer treats them alike.
 */
export function useNodeResize(deps: ResizeDeps) {
  const isResizing = ref(false)
  const activeHandle = ref<ResizeHandle | null>(null)

  const minW = deps.minWidth ?? 50
  const minH = deps.minHeight ?? 30

  // Mutable shared state across begin/update/commit.
  let targetId: string | null = null
  let original: NodeRectSnapshot | null = null

  function beginResize(node: Node, handle: ResizeHandle) {
    const snapshot = deps.beginResizeNode(node.id)
    if (!snapshot) return
    isResizing.value = true
    activeHandle.value = handle
    targetId = node.id
    original = snapshot
  }

  function updateResize(worldPos: Point, proportional: boolean) {
    if (!isResizing.value || !original || !targetId || !activeHandle.value) return

    const o: Rect = {
      x: original.position.x,
      y: original.position.y,
      width: original.size.width,
      height: original.size.height,
    }
    const rect = computeResizedRect(activeHandle.value, o, worldPos, {
      proportional,
      minWidth: minW,
      minHeight: minH,
    })

    deps.setNodeRect(targetId, rect)
    deps.bumpNodesVersion()
  }

  function commitResize() {
    if (isResizing.value && targetId && original) {
      deps.commitResizeNode(targetId, original)
    }
    _reset()
  }

  function cancelResize() {
    // Live frames were applied history-free via setNodeRect, so revert the
    // node to the rect captured at begin — otherwise it strands at the last
    // dragged size with no undo entry.
    if (isResizing.value && targetId && original) {
      deps.setNodeRect(targetId, {
        x: original.position.x,
        y: original.position.y,
        width: original.size.width,
        height: original.size.height,
      })
      deps.bumpNodesVersion()
    }
    _reset()
  }

  function _reset() {
    isResizing.value = false
    activeHandle.value = null
    targetId = null
    original = null
  }

  return {
    isResizing,
    activeHandle,
    beginResize,
    updateResize,
    commitResize,
    cancelResize,
  }
}
