import { ref, nextTick, type Ref, type ComputedRef } from 'vue'
import type { Camera, CanvasTool, Point, Node, Edge, Anchor } from '~/types'
import { screenToWorld } from '~/composables/useCanvasCoordinates'
import { findNodeAtPosition, findEdgeAtPosition } from '~/composables/useNodeHitTest'
import { getAnchorPoint } from '~/composables/useAnchors'
import type { useDragInteraction } from '~/composables/useDragInteraction'
import type { useConnectionTool } from '~/composables/useConnectionTool'
import type { useBoxSelection } from '~/composables/useBoxSelection'
import type { useNodeEditing } from '~/composables/useNodeEditing'
import type { useSmartGuides } from '~/composables/useSmartGuides'
import type { useVelocityTracker } from '~/composables/useVelocityTracker'
import type { useConnectionAnimation } from '~/composables/useConnectionAnimation'
import type { useEdgeAnimations } from '~/composables/useEdgeAnimations'

// ---------------------------------------------------------------------------
// Dependency interface
// ---------------------------------------------------------------------------

export interface InteractionDeps {
  camera: Ref<Camera> | ComputedRef<Camera>
  tool: Ref<CanvasTool> | ComputedRef<CanvasTool>
  containerRef: Ref<HTMLDivElement | null>

  // Store data (read-only getters — always return fresh reactive data)
  nodes: () => Map<string, Node>
  edges: () => Map<string, Edge>
  selection: () => { nodeIds: Set<string>; edgeIds: Set<string> }
  rootNodeId: () => string | null

  // Store actions
  select: (nodeIds: string[], edgeIds?: string[]) => void
  addToSelection: (nodeIds: string[], edgeIds?: string[]) => void
  clearSelection: () => void
  addNode: (partial: Partial<Node>) => Node
  addEdge: (sourceId: string, targetId: string, style?: unknown, sourceAnchor?: Anchor, targetAnchor?: Anchor) => Edge
  deleteEdge: (id: string) => void
  deleteSelected: () => void

  // Sub-composables
  drag: ReturnType<typeof useDragInteraction>
  connection: ReturnType<typeof useConnectionTool>
  boxSelection: ReturnType<typeof useBoxSelection>
  editing: ReturnType<typeof useNodeEditing>

  // External composables
  smartGuides: ReturnType<typeof useSmartGuides>
  panVelocity: ReturnType<typeof useVelocityTracker>
  connectionAnim: ReturnType<typeof useConnectionAnimation>
  edgeAnimations: ReturnType<typeof useEdgeAnimations> | null

  // Callbacks
  emitCamera: (camera: Camera) => void
  emitPanEnd: (velocity: { vx: number; vy: number }) => void
  emitContextMenu: (event: {
    node: Node | null
    edge: Edge | null
    position: Point
    screenPosition: Point
  }) => void
  emitDropCategory: (event: { category: unknown; position: Point }) => void
  emitDropNode: (event: { nodeId: string; position: Point }) => void

  // Config
  isMobile: boolean

  // Culling dirty flag callback — tells the render loop the spatial index is stale
  markCullingDirty: () => void
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useCanvasInteraction(deps: InteractionDeps) {
  // ------- owned state -------
  const isPanning = ref(false)
  const hoveredNodeId = ref<string | null>(null)
  const lastMousePos = ref<Point>({ x: 0, y: 0 })
  const isDragOver = ref(false)

  // Shorthand accessors
  const cam = () => deps.camera.value
  const tool = () => deps.tool.value
  const container = () => deps.containerRef.value

  // ------- helper: convert screen event to screen & world positions -------
  function eventPositions(event: { clientX: number; clientY: number }) {
    const rect = container()!.getBoundingClientRect()
    const screenPos: Point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const worldPos = screenToWorld(screenPos.x, screenPos.y, cam())
    return { screenPos, worldPos }
  }

  // =======================================================================
  // handlePointerDown
  // =======================================================================
  function handlePointerDown(event: PointerEvent) {
    if (!container()) return

    // Don't process if we're editing
    if (deps.editing.editingNode.value) return

    const { screenPos, worldPos } = eventPositions(event)

    lastMousePos.value = screenPos

    if (tool() === 'pan' || event.button === 1) {
      // Middle mouse button or pan tool
      isPanning.value = true
      container()!.style.cursor = 'grabbing'
    } else if (tool() === 'connect') {
      // Connection tool — start from node
      const node = findNodeAtPosition(worldPos, deps.nodes())
      if (node) {
        deps.connection.startConnection(node, worldPos)

        // Trigger appear animations for target anchors
        for (const [nodeId, anchors] of deps.connection.visibleAnchors.value) {
          deps.connectionAnim.triggerAnchorsAppear(nodeId, anchors)
        }

        container()!.style.cursor = 'crosshair'
      }
    } else if (tool() === 'select') {
      const node = findNodeAtPosition(worldPos, deps.nodes())
      if (node) {
        if (event.shiftKey) {
          // Add to selection
          deps.addToSelection([node.id])
        } else if (!deps.selection().nodeIds.has(node.id)) {
          // Select only this node
          deps.select([node.id])
        }
        // Don't start drag immediately — wait for threshold
        deps.drag.initiateDrag(worldPos, screenPos)
      } else {
        // Check if clicked on an edge
        const edge = findEdgeAtPosition(worldPos, deps.edges(), deps.nodes(), cam())
        if (edge) {
          if (event.altKey) {
            // Alt+click: Quick delete edge (disconnect nodes)
            deps.deleteEdge(edge.id)
          } else if (event.shiftKey) {
            // Add edge to selection
            deps.addToSelection([], [edge.id])
          } else {
            // Select only this edge
            deps.select([], [edge.id])
          }
        } else {
          // Empty canvas interaction
          if (deps.isMobile && event.pointerType === 'touch') {
            // Mobile: single-finger on empty canvas → pan
            deps.clearSelection()
            isPanning.value = true
          } else {
            // Desktop: box selection
            if (!event.shiftKey) {
              deps.clearSelection()
            }
            deps.boxSelection.startBox(worldPos)
          }
        }
      }
    } else if (tool() === 'node') {
      // Create new node at position
      const node = deps.addNode({
        position: worldPos,
        content: 'New Node',
      })
      deps.select([node.id])
    }

    // Capture pointer for drag tracking
    container()!.setPointerCapture(event.pointerId)
  }

  // =======================================================================
  // handlePointerMove
  // =======================================================================
  function handlePointerMove(event: PointerEvent) {
    if (!container()) return

    const { screenPos, worldPos } = eventPositions(event)
    const dx = screenPos.x - lastMousePos.value.x
    const dy = screenPos.y - lastMousePos.value.y

    // Update hover state
    if (
      !deps.drag.isDragging.value &&
      !deps.drag.pendingDrag.value &&
      !isPanning.value &&
      !deps.connection.isConnecting.value &&
      !deps.boxSelection.isBoxSelecting.value
    ) {
      const nodeUnderMouse = findNodeAtPosition(worldPos, deps.nodes())
      const previousHovered = hoveredNodeId.value
      hoveredNodeId.value = nodeUnderMouse?.id ?? null

      // Edge hover detection for edge animations
      if (!nodeUnderMouse && deps.edgeAnimations) {
        const edge = findEdgeAtPosition(worldPos, deps.edges(), deps.nodes(), cam(), 12)
        deps.edgeAnimations.setHoveredEdge(edge?.id ?? null)
      } else if (deps.edgeAnimations) {
        deps.edgeAnimations.setHoveredEdge(null)
      }

      // Update anchor visibility when hover changes in connect mode
      if (tool() === 'connect' && previousHovered !== hoveredNodeId.value) {
        deps.connection.updateAnchorVisibility()

        // Trigger appear animation for new hovered node
        if (hoveredNodeId.value) {
          const anchors = deps.connection.visibleAnchors.value.get(hoveredNodeId.value)
          if (anchors) {
            deps.connectionAnim.triggerAnchorsAppear(hoveredNodeId.value, anchors)
          }
        }
      }
    }

    if (isPanning.value) {
      // Track velocity for momentum on release
      deps.panVelocity.addSample(screenPos.x, screenPos.y)

      deps.emitCamera({
        ...cam(),
        x: cam().x + dx,
        y: cam().y + dy,
      })
    } else if (deps.connection.isConnecting.value) {
      // Update connection preview end point and snap detection
      deps.connection.updateConnection(worldPos)

      // If no snap target, check if hovering over a node body
      if (!deps.connection.connectionSnapTarget.value) {
        const targetNode = findNodeAtPosition(worldPos, deps.nodes())
        if (targetNode && targetNode.id !== deps.connection.connectionSourceNode.value?.id) {
          hoveredNodeId.value = targetNode.id
        } else {
          hoveredNodeId.value = null
        }
      } else {
        // Snap target was set by updateConnection — mirror its node as hovered
        hoveredNodeId.value = deps.connection.connectionSnapTarget.value.node.id
      }
    } else if (deps.drag.pendingDrag.value && !deps.drag.isDragging.value) {
      // Check if drag threshold exceeded
      if (deps.drag.checkThreshold(screenPos)) {
        deps.drag.beginDrag()

        // Store local references for the smart-guide pass
        // (beginDrag already captured originals and offsets internally)
      }
    } else if (deps.drag.isDragging.value) {
      // Move selected nodes using absolute offset tracking (prevents drift)
      const worldMousePos = screenToWorld(screenPos.x, screenPos.y, cam())

      // Compute target positions via drag helper, then compute smart guides
      // We need the dragged node map for smart guides, so we do a two-step:
      // 1. Let drag update positions without snap
      deps.drag.updateDrag(worldMousePos)

      // 2. Compute smart guides and apply micro-snap
      const draggedNodes = new Map<string, Node>()
      for (const nodeId of deps.selection().nodeIds) {
        const node = deps.nodes().get(nodeId)
        if (node) draggedNodes.set(nodeId, node)
      }
      const guideResult = deps.smartGuides.compute(draggedNodes, deps.nodes(), deps.selection().nodeIds)
      if (guideResult.snapDx !== 0 || guideResult.snapDy !== 0) {
        // Apply micro-snap on top of the drag update
        deps.drag.updateDrag(worldMousePos, guideResult.snapDx, guideResult.snapDy)
      }

      deps.markCullingDirty()
    } else if (deps.boxSelection.isBoxSelecting.value) {
      // Update box selection end point
      deps.boxSelection.updateBox(worldPos)
    }

    lastMousePos.value = screenPos
  }

  // =======================================================================
  // handlePointerUp
  // =======================================================================
  function handlePointerUp(event: PointerEvent) {
    // Handle connection completion
    if (deps.connection.isConnecting.value && deps.connection.connectionSourceNode.value) {
      const rect = container()?.getBoundingClientRect()
      if (rect) {
        const screenPos: Point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        const worldPos = screenToWorld(screenPos.x, screenPos.y, cam())

        // Hit-test fallback node (for when cursor lands on a node body without snap)
        const hitNode = findNodeAtPosition(worldPos, deps.nodes())

        const result = deps.connection.finishConnection(hitNode)
        if (result) {
          // Check for duplicate edges before creating
          const existingEdge = Array.from(deps.edges().values()).find(
            e =>
              (e.sourceId === result.sourceId && e.targetId === result.targetId) ||
              (e.sourceId === result.targetId && e.targetId === result.sourceId),
          )

          if (!existingEdge) {
            const edge = deps.addEdge(
              result.sourceId,
              result.targetId,
              undefined,
              result.sourceAnchor,
              result.targetAnchor,
            )

            // Trigger connection animation
            deps.connectionAnim.startConnectionAnimation(
              edge.id,
              result.sourceId,
              result.targetId,
              result.sourceAnchor,
              result.targetAnchor,
            )
          }
        }
        // finishConnection already reset connection state
      } else {
        // No rect — just reset
        deps.connection.resetConnection()
      }
    }

    // Handle box selection completion
    if (
      deps.boxSelection.isBoxSelecting.value &&
      deps.boxSelection.boxStart.value &&
      deps.boxSelection.boxEnd.value
    ) {
      const selectedNodes: string[] = []
      const selectedEdges: string[] = []

      // Calculate selection bounds
      const minX = Math.min(deps.boxSelection.boxStart.value.x, deps.boxSelection.boxEnd.value.x)
      const maxX = Math.max(deps.boxSelection.boxStart.value.x, deps.boxSelection.boxEnd.value.x)
      const minY = Math.min(deps.boxSelection.boxStart.value.y, deps.boxSelection.boxEnd.value.y)
      const maxY = Math.max(deps.boxSelection.boxStart.value.y, deps.boxSelection.boxEnd.value.y)

      // Find nodes within the box
      for (const node of deps.nodes().values()) {
        const nodeRight = node.position.x + node.size.width
        const nodeBottom = node.position.y + node.size.height

        // Check if node intersects with selection box
        if (
          node.position.x < maxX &&
          nodeRight > minX &&
          node.position.y < maxY &&
          nodeBottom > minY
        ) {
          selectedNodes.push(node.id)
        }
      }

      // Find edges within the box (both endpoints inside)
      for (const edge of deps.edges().values()) {
        const sourceNode = deps.nodes().get(edge.sourceId)
        const targetNode = deps.nodes().get(edge.targetId)
        if (!sourceNode || !targetNode) continue

        // Get edge endpoints
        let sourcePoint: Point
        let targetPoint: Point

        if (edge.sourceAnchor) {
          sourcePoint = getAnchorPoint(sourceNode, edge.sourceAnchor)
        } else {
          sourcePoint = {
            x: sourceNode.position.x + sourceNode.size.width / 2,
            y: sourceNode.position.y + sourceNode.size.height / 2,
          }
        }

        if (edge.targetAnchor) {
          targetPoint = getAnchorPoint(targetNode, edge.targetAnchor)
        } else {
          targetPoint = {
            x: targetNode.position.x + targetNode.size.width / 2,
            y: targetNode.position.y + targetNode.size.height / 2,
          }
        }

        // Check if edge midpoint or both nodes are in selection
        const midX = (sourcePoint.x + targetPoint.x) / 2
        const midY = (sourcePoint.y + targetPoint.y) / 2

        if (
          (midX >= minX && midX <= maxX && midY >= minY && midY <= maxY) ||
          (selectedNodes.includes(edge.sourceId) && selectedNodes.includes(edge.targetId))
        ) {
          selectedEdges.push(edge.id)
        }
      }

      // Apply selection
      if (selectedNodes.length > 0 || selectedEdges.length > 0) {
        deps.select(selectedNodes, selectedEdges)
      }

      // Reset box selection state
      deps.boxSelection.commitBox()
    }

    // Finalize drag: snap-on-drop + commit undo
    if (deps.drag.isDragging.value) {
      // Clear smart guides
      deps.smartGuides.clear()

      deps.drag.commitDrag()
      deps.markCullingDirty()
    }

    // Emit pan-end with velocity for momentum
    if (isPanning.value) {
      const velocity = deps.panVelocity.getVelocity()
      if (Math.abs(velocity.vx) > 50 || Math.abs(velocity.vy) > 50) {
        deps.emitPanEnd(velocity)
      }
      deps.panVelocity.reset()
    }

    isPanning.value = false
    deps.drag.cancelDrag() // resets isDragging, pendingDrag, dragStart, dragStartScreen

    if (container()) {
      container()!.style.cursor = ''
      container()!.releasePointerCapture(event.pointerId)
    }
  }

  // =======================================================================
  // handleDoubleClick
  // =======================================================================
  function handleDoubleClick(event: MouseEvent) {
    if (!container()) return

    const { screenPos, worldPos } = eventPositions(event)

    // Check if double-clicked on a node
    const existingNode = findNodeAtPosition(worldPos, deps.nodes())
    if (existingNode) {
      // Start editing node content
      deps.editing.startEditing(existingNode)
      return
    }

    // Create new node at position (only in select mode)
    if (tool() === 'select') {
      const node = deps.addNode({
        position: {
          x: worldPos.x - 75, // Center the node
          y: worldPos.y - 25,
        },
        content: 'New Node',
      })
      deps.select([node.id])
      // Start editing the new node
      nextTick(() => {
        deps.editing.startEditing(node)
      })
    }
  }

  // =======================================================================
  // handleContextMenu
  // =======================================================================
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault()

    if (!container()) return

    const { screenPos, worldPos } = eventPositions(event)

    const node = findNodeAtPosition(worldPos, deps.nodes())
    let edge: Edge | null = null

    // If right-clicked on a node, select it if not already selected
    if (node && !deps.selection().nodeIds.has(node.id)) {
      deps.select([node.id])
    }

    // If no node, check for edge
    if (!node) {
      edge = findEdgeAtPosition(worldPos, deps.edges(), deps.nodes(), cam())
      if (edge && !deps.selection().edgeIds.has(edge.id)) {
        deps.select([], [edge.id])
      }
    }

    deps.emitContextMenu({
      node,
      edge,
      position: worldPos,
      screenPosition: { x: event.clientX, y: event.clientY },
    })
  }

  // =======================================================================
  // Drag-and-drop handlers
  // =======================================================================
  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    isDragOver.value = true
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  function handleDragLeave() {
    isDragOver.value = false
  }

  function handleDrop(event: DragEvent) {
    isDragOver.value = false
    event.preventDefault()

    if (!container() || !event.dataTransfer) return

    const rect = container()!.getBoundingClientRect()
    const screenPos: Point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const worldPos = screenToWorld(screenPos.x, screenPos.y, cam())

    try {
      const data = JSON.parse(event.dataTransfer.getData('application/json'))

      if (data.type === 'category') {
        deps.emitDropCategory({
          category: data.category,
          position: worldPos,
        })
      } else if (data.type === 'node') {
        deps.emitDropNode({
          nodeId: data.nodeId,
          position: worldPos,
        })
      }
    } catch (_e) {
      // Invalid drop data, ignore
    }
  }

  // ------- public API -------
  return {
    // State
    isPanning,
    hoveredNodeId,
    lastMousePos,
    isDragOver,

    // Handlers
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleContextMenu,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  }
}
