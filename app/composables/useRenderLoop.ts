/**
 * useRenderLoop — extracted from InfiniteCanvas.vue
 *
 * Manages the requestAnimationFrame render loop, ResizeObserver,
 * and orchestrates the full per-frame render pipeline:
 *
 *   clear → camera → grid → culling → edges → nodes → ghosts →
 *   pulses → root indicators → anchors → connection preview →
 *   smart guides → box selection → restore → compass
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { Camera, Node, Edge, Point, Anchor } from '~/types'
import type { CanvasColors } from '~/composables/useCanvasTheme'
import type { NodeAnimationsAPI } from '~/composables/useNodeAnimations'
import type { useEdgeAnimations } from '~/composables/useEdgeAnimations'
import type { useConnectionAnimation } from '~/composables/useConnectionAnimation'
import type { useViewportCulling } from '~/composables/useViewportCulling'
import type { useViewportCompass } from '~/composables/useViewportCompass'
import type { AlignmentGuide } from '~/composables/useSmartGuides'
import { drawDotGrid } from '~/components/canvas/renderers/drawGrid'
import {
  drawSmartGuides,
  drawBoxSelectionRect,
  drawConnectionPreviewLine,
  drawAnchorPoints,
  drawRootIndicator,
} from '~/components/canvas/renderers/drawOverlays'
import type { SnapTarget } from '~/components/canvas/renderers/drawOverlays'
import {
  drawNode as drawNodeRenderer,
  drawNodeSimplified as drawNodeSimplifiedRenderer,
} from '~/components/canvas/renderers/drawNode'
import type { NodeState } from '~/components/canvas/renderers/drawNode'
import {
  drawEdge as drawEdgeRenderer,
  drawAnimatedEdge as drawAnimatedEdgeRenderer,
} from '~/components/canvas/renderers/drawEdge'
import { drawGhostNodes, drawPulseEffects } from '~/components/canvas/renderers/drawGhosts'
import { lerpColor } from '~/utils/color'
import { getAnchorScale } from '~/composables/useConnectionAnimation'

// ---------------------------------------------------------------------------
// Dependencies interface
// ---------------------------------------------------------------------------

export interface RenderLoopDeps {
  canvasRef: Ref<HTMLCanvasElement | null>
  containerRef: Ref<HTMLDivElement | null>
  camera: Ref<Camera> | ComputedRef<Camera>
  colors: ComputedRef<CanvasColors>
  isLight: Ref<boolean>

  // Data sources (getters for fresh data each frame)
  nodes: () => Map<string, Node>
  edges: () => Map<string, Edge>
  settings: () => { gridEnabled: boolean; gridSize: number }
  selection: () => { nodeIds: Set<string>; edgeIds: Set<string> }
  rootNodeId: () => string | null

  // State from interaction composable
  isDragging: Ref<boolean>
  isPanning: Ref<boolean>
  isConnecting: Ref<boolean>
  hoveredNodeId: Ref<string | null>
  editingNodeId: () => string | null

  // Visual state
  aiSuggestionNodeIds: Ref<Set<string>>
  highlightedNodeIds: Ref<Set<string>>
  dimmedNodeIds: Ref<Set<string>>

  // Box selection
  getBoxRect: () => { x: number; y: number; width: number; height: number } | null
  getNodesInBox: (nodes: Map<string, Node>) => string[]

  // Connection preview
  connectionSourceNode: Ref<Node | null>
  connectionPreviewEnd: Ref<Point | null>
  connectionSourceAnchor: Ref<Anchor | null>
  connectionSnapTarget: Ref<SnapTarget | null>
  visibleAnchors: Ref<Map<string, Anchor[]>>

  // Composables
  nodeAnimations: NodeAnimationsAPI | null
  edgeAnimations: ReturnType<typeof useEdgeAnimations> | null
  connectionAnim: ReturnType<typeof useConnectionAnimation>
  culling: ReturnType<typeof useViewportCulling>
  viewportCompass: ReturnType<typeof useViewportCompass>
  smartGuides: { guides: Ref<AlignmentGuide[]> }

  // Map regions (optional — drawn at low zoom behind everything)
  mapRegions?: Ref<Array<{ label: string; centerX: number; centerY: number }>> | null

  // getNodeState function
  getNodeState: (node: Node) => NodeState

  // Resize callback
  onResize?: (width: number, height: number) => void
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useRenderLoop(deps: RenderLoopDeps) {
  // Renderer readiness gate
  const isRendererReady = ref(false)

  // Frame timing
  let lastFrameTime = 0

  // Viewport culling dirty flag
  let cullingDirty = true

  // Mobile viewport detection — evaluated once at composable init
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768

  // DPR — capped at 2 on mobile to prevent 3x rendering killing perf
  const dpr = computed(() => {
    if (typeof window === 'undefined') return 1
    const raw = window.devicePixelRatio || 1
    return isMobileViewport ? Math.min(raw, 2) : raw
  })

  // rAF handle for cleanup
  let rafId: number | null = null

  // ResizeObserver reference for cleanup
  let resizeObserver: ResizeObserver | null = null

  // -----------------------------------------------------------------------
  // Public method: mark culling dirty from outside
  // -----------------------------------------------------------------------

  function markCullingDirty() {
    cullingDirty = true
  }

  // -----------------------------------------------------------------------
  // Resize handling
  // -----------------------------------------------------------------------

  function handleResize() {
    const canvas = deps.canvasRef.value
    const container = deps.containerRef.value
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr.value
    canvas.height = rect.height * dpr.value
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    deps.onResize?.(rect.width, rect.height)
  }

  // -----------------------------------------------------------------------
  // rAF loop
  // -----------------------------------------------------------------------

  function render() {
    const canvas = deps.canvasRef.value
    if (!canvas || !isRendererReady.value) {
      rafId = requestAnimationFrame(render)
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafId = requestAnimationFrame(render)
      return
    }

    try {
      renderFrame(ctx)
    } catch (e) {
      // Don't let render errors kill the animation loop
      if (import.meta.dev) console.warn('[RenderLoop] render error:', e)
    }

    rafId = requestAnimationFrame(render)
  }

  // -----------------------------------------------------------------------
  // Full render pipeline (reproduces InfiniteCanvas.renderFrame exactly)
  // -----------------------------------------------------------------------

  function renderFrame(ctx: CanvasRenderingContext2D) {
    const canvas = deps.canvasRef.value
    if (!canvas) return

    const { width, height } = canvas
    const currentTime = performance.now()
    const cam = deps.camera.value
    const colorsVal = deps.colors.value
    const dprVal = dpr.value

    // --- Mobile idle frame skip (30fps cap when idle) --------------------
    if (
      isMobileViewport &&
      !deps.isDragging.value &&
      !deps.isPanning.value &&
      !deps.isConnecting.value
    ) {
      const elapsed = currentTime - lastFrameTime
      if (elapsed < 30) return // ~30fps cap when idle on mobile
    }

    // --- Delta time (capped at 64ms) ------------------------------------
    const dt =
      lastFrameTime === 0
        ? 0.016
        : Math.min((currentTime - lastFrameTime) / 1000, 0.064)
    lastFrameTime = currentTime

    // --- Update node animations -----------------------------------------
    const nodeAnims = deps.nodeAnimations
    if (nodeAnims) {
      nodeAnims.update(dt, deps.hoveredNodeId.value, deps.selection().nodeIds)
    }

    // --- Update edge animations -----------------------------------------
    const edgeAnims = deps.edgeAnimations
    if (edgeAnims) {
      edgeAnims.update(dt)
    }

    // --- 1. Clear canvas with background color --------------------------
    ctx.fillStyle = colorsVal.canvasBg
    ctx.fillRect(0, 0, width, height)

    // --- 2. Apply camera transform (translate + scale) ------------------
    ctx.save()
    ctx.scale(dprVal, dprVal)
    ctx.translate(cam.x, cam.y)
    ctx.scale(cam.zoom, cam.zoom)

    // --- 3. Draw dot grid -----------------------------------------------
    const settings = deps.settings()
    drawDotGrid(ctx, cam, width, height, dprVal, settings.gridSize, settings.gridEnabled, colorsVal)

    // --- 4. Rebuild culling if dirty → get visible node/edge IDs → LOD --
    const nodesMap = deps.nodes()
    const edgesMap = deps.edges()

    if (cullingDirty) {
      deps.culling.rebuild(nodesMap)
      cullingDirty = false
    }

    const viewW = width / dprVal
    const viewH = height / dprVal
    const visibleNodeIds = deps.culling.getVisibleNodeIds(cam, viewW, viewH, 200)
    const visibleEdgeIds = deps.culling.getVisibleEdgeIds(edgesMap, visibleNodeIds)
    const lod = deps.culling.getNodeLOD(cam.zoom)

    // --- Region labels (behind everything at low zoom) ------------------
    if (cam.zoom < 0.3 && deps.mapRegions?.value) {
      ctx.save()
      ctx.globalAlpha = 0.15
      ctx.fillStyle = colorsVal.nodeText
      ctx.font = `600 ${Math.max(24, 60 / cam.zoom * 0.05)}px "Inter", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const region of deps.mapRegions.value) {
        ctx.fillText(region.label, region.centerX, region.centerY)
      }
      ctx.restore()
    }

    // --- 5. Draw visible edges (animated or static) ---------------------
    const sel = deps.selection()
    const connectionAnim = deps.connectionAnim

    for (const edge of edgesMap.values()) {
      if (!visibleEdgeIds.has(edge.id)) continue

      // Check edge entrance animation
      const entranceProgress = edgeAnims?.getEntranceProgress(edge.id) ?? -1

      const animation = connectionAnim.getEdgeAnimation(edge.id)
      if (animation) {
        drawAnimatedEdgeRenderer(
          ctx, edge, animation, currentTime,
          nodesMap, sel.nodeIds, sel.edgeIds, colorsVal,
        )
      } else if (entranceProgress >= 0 && entranceProgress < 1) {
        // Partial entrance draw
        ctx.save()
        ctx.globalAlpha = entranceProgress
        drawEdgeRenderer(ctx, edge, nodesMap, sel.nodeIds, sel.edgeIds, colorsVal)
        ctx.restore()
      } else {
        // Apply edge hover highlight if active
        const hoverProps = edgeAnims?.getHoverProps(edge.id)
        if (hoverProps && hoverProps.progress > 0) {
          ctx.save()
          ctx.shadowColor = colorsVal.nodeSelected
          ctx.shadowBlur = hoverProps.glowOpacity * 12
        }
        drawEdgeRenderer(ctx, edge, nodesMap, sel.nodeIds, sel.edgeIds, colorsVal)
        if (hoverProps && hoverProps.progress > 0) {
          ctx.restore()
        }
      }
    }

    // --- 6. Draw visible nodes (dot / simplified / full based on LOD) ---
    const editingId = deps.editingNodeId()
    const rootNodeId = deps.rootNodeId()

    for (const node of nodesMap.values()) {
      if (editingId === node.id) continue
      if (!visibleNodeIds.has(node.id)) continue

      if (lod === 'dot') {
        // Extreme zoom out: colored circle
        const cx = node.position.x + node.size.width / 2
        const cy = node.position.y + node.size.height / 2
        ctx.fillStyle = node.style.borderColor || colorsVal.nodeSelected
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(4, Math.min(node.size.width, node.size.height) / 4), 0, Math.PI * 2)
        ctx.fill()
      } else if (lod === 'simplified') {
        const isSelected = sel.nodeIds.has(node.id)
        drawNodeSimplifiedRenderer(ctx, node, isSelected, colorsVal)
      } else if (nodeAnims) {
        // Full LOD with animation transforms
        const anim = nodeAnims.getAnimatedProps(node.id)
        ctx.save()
        ctx.globalAlpha = anim.opacity
        const cx = node.position.x + node.size.width / 2 + anim.offsetX
        const cy = node.position.y + node.size.height / 2 + anim.offsetY
        ctx.translate(cx, cy)
        ctx.scale(anim.scaleX, anim.scaleY)
        ctx.translate(-cx + anim.offsetX, -cy + anim.offsetY)

        const nodeState = deps.getNodeState(node)
        const isRoot = node.isRoot || node.id === rootNodeId
        const isSelected = sel.nodeIds.has(node.id)
        const parentNode = node.parentId ? nodesMap.get(node.parentId) : null
        const parentIsRoot = parentNode?.isRoot || parentNode?.id === rootNodeId

        drawNodeRenderer(
          ctx, node, nodeState, colorsVal,
          deps.isDragging.value, isSelected, isRoot,
          lerpColor,
          { hoverProgress: anim.hoverProgress, selectionProgress: anim.selectionProgress },
          deps.isLight.value,
          parentIsRoot,
        )
        ctx.restore()
      } else {
        // Full LOD without animation system
        const nodeState = deps.getNodeState(node)
        const isRoot = node.isRoot || node.id === rootNodeId
        const isSelected = sel.nodeIds.has(node.id)
        const parentNode = node.parentId ? nodesMap.get(node.parentId) : null
        const parentIsRoot = parentNode?.isRoot || parentNode?.id === rootNodeId

        drawNodeRenderer(
          ctx, node, nodeState, colorsVal,
          deps.isDragging.value, isSelected, isRoot,
          lerpColor,
          undefined,
          deps.isLight.value,
          parentIsRoot,
        )
      }
    }

    // --- 7. Draw ghost nodes (exit animations) --------------------------
    if (nodeAnims) {
      const ghosts = nodeAnims.getExitingNodes()
      drawGhostNodes(ctx, ghosts, colorsVal)

      // --- 8. Draw pulse effects ----------------------------------------
      const pulses = nodeAnims.getActivePulses()
      drawPulseEffects(ctx, pulses, nodesMap, colorsVal.nodeSelected)
    }

    // --- 9. Draw root indicators on root nodes --------------------------
    for (const node of nodesMap.values()) {
      const isRoot = node.isRoot || node.id === rootNodeId
      const nodeState = deps.getNodeState(node)
      if (isRoot && nodeState !== 'dragging' && editingId !== node.id) {
        drawRootIndicator(ctx, node, colorsVal)
      }
    }

    // --- 10. Draw anchor points on nodes with visible anchors -----------
    const snapTarget = deps.connectionSnapTarget.value
    for (const [nodeId, anchors] of deps.visibleAnchors.value) {
      const node = nodesMap.get(nodeId)
      if (node) {
        drawAnchorPoints(
          ctx, node, anchors, snapTarget, currentTime,
          colorsVal, getAnchorScale, deps.isLight.value,
        )
      }
    }

    // --- 11. Draw connection preview line (if connecting) ----------------
    if (
      deps.isConnecting.value &&
      deps.connectionSourceNode.value &&
      deps.connectionPreviewEnd.value
    ) {
      drawConnectionPreviewLine(
        ctx,
        deps.connectionSourceNode.value,
        deps.connectionPreviewEnd.value,
        deps.connectionSourceAnchor.value,
        snapTarget,
        colorsVal,
      )
    }

    // --- 12. Draw smart guides (if dragging) ----------------------------
    const guides = deps.smartGuides.guides.value
    if (deps.isDragging.value && guides.length > 0) {
      drawSmartGuides(ctx, guides, cam, width, height, dprVal, colorsVal.nodeSelected)
    }

    // --- 13. Draw box selection rectangle (if box selecting) ------------
    const boxRect = deps.getBoxRect()
    if (boxRect) {
      const boxNodeCount = deps.getNodesInBox(nodesMap).length
      drawBoxSelectionRect(ctx, boxRect, cam, boxNodeCount, colorsVal)
    }

    // --- 14. Restore canvas context (exit world-space) ------------------
    ctx.restore()

    // --- 15. Draw viewport compass (screen space, after restore) --------
    const screenWidth = width / dprVal
    const screenHeight = height / dprVal
    ctx.save()
    ctx.scale(dprVal, dprVal)
    const compassIndicators = deps.viewportCompass.computeIndicators(
      cam, nodesMap, screenWidth, screenHeight,
    )
    if (compassIndicators.length > 0) {
      deps.viewportCompass.draw(ctx, compassIndicators, screenWidth, screenHeight, colorsVal.nodeSelected)
    }
    ctx.restore()
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  onMounted(() => {
    const canvas = deps.canvasRef.value
    const container = deps.containerRef.value
    if (!canvas || !container) return

    // Initial canvas sizing
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr.value
    canvas.height = rect.height * dpr.value
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    isRendererReady.value = true

    // Set up resize observer
    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    // Initial render kick-off
    rafId = requestAnimationFrame(render)
  })

  onUnmounted(() => {
    // Cancel animation frame
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    // Disconnect resize observer
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
  })

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------

  return {
    isRendererReady,
    dpr,
    isMobileViewport,
    markCullingDirty,
  }
}
