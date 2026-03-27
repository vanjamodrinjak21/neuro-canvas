<script setup lang="ts">
import type { Camera, CanvasTool, Point, Node, Edge, Anchor } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import {
  getAnchorPoint,
  getVisibleAnchors,
  checkAnchorSnap,
  getBestAnchorPair
} from '~/composables/useAnchors'
import {
  useConnectionAnimation,
  getLineDrawProgress,
  getPulseProgress,
  getAnchorScale
} from '~/composables/useConnectionAnimation'
import { useVelocityTracker } from '~/composables/useVelocityTracker'
import type { NodeAnimationsAPI } from '~/composables/useNodeAnimations'
import { useViewportCompass } from '~/composables/useViewportCompass'
import { useViewportCulling } from '~/composables/useViewportCulling'
import type { useEdgeAnimations } from '~/composables/useEdgeAnimations'
import type { useSpatialHUD } from '~/composables/useSpatialHUD'
import { useSmartGuides } from '~/composables/useSmartGuides'
import { lerpColor } from '~/utils/color'
import { drawDotGrid } from '~/components/canvas/renderers/drawGrid'
import { drawSmartGuides } from '~/components/canvas/renderers/drawOverlays'

export interface InfiniteCanvasProps {
  camera: Camera
  tool: CanvasTool
}

// Node visual states for enhanced rendering
type NodeState = 'normal' | 'hover' | 'selected' | 'dragging' | 'ai-suggestion' | 'highlighted' | 'dimmed'

const props = defineProps<InfiniteCanvasProps>()

const emit = defineEmits<{
  'update:camera': [camera: Camera]
  'pan-end': [velocity: { vx: number; vy: number }]
  'contextmenu': [event: { node: Node | null; edge: Edge | null; position: Point; screenPosition: Point }]
  'node-edit': [node: Node]
  'node-hover': [event: { nodeId: string | null; screenPosition: Point }]
  'drop-category': [event: { category: { id: string; label: string; color: string }; position: Point }]
  'drop-node': [event: { nodeId: string; position: Point }]
}>()

// Canvas refs
const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)

// Store
const mapStore = useMapStore()

// State
const isDragging = ref(false)
const isPanning = ref(false)
const dragStart = ref<Point | null>(null)
const lastMousePos = ref<Point>({ x: 0, y: 0 })

// Drag threshold — prevents accidental drags on click
const DRAG_THRESHOLD = 3 // pixels in screen space
const pendingDrag = ref(false)
const dragStartScreen = ref<Point | null>(null)
let dragOriginalPositions: Map<string, { x: number; y: number }> | null = null
let dragNodeOffsets: Map<string, Point> | null = null

// Smart alignment guides
const smartGuides = useSmartGuides()

// Box selection state
const isBoxSelecting = ref(false)
const boxSelectionStart = ref<Point | null>(null)
const boxSelectionEnd = ref<Point | null>(null)

// Connection tool state
const isConnecting = ref(false)
const connectionSourceNode = ref<Node | null>(null)
const connectionPreviewEnd = ref<Point | null>(null)
const connectionSourceAnchor = ref<Anchor | null>(null)
const connectionSnapTarget = ref<{
  node: Node
  anchor: Anchor
  point: Point
} | null>(null)

// Anchor visibility state
const visibleAnchors = ref<Map<string, Anchor[]>>(new Map())

// Animation composable
const connectionAnim = useConnectionAnimation()

// Velocity tracker for pan momentum
const panVelocity = useVelocityTracker()

// Node animations (provided by page via Vue provide/inject)
const nodeAnimations = inject<NodeAnimationsAPI | null>('nodeAnimations', null)

// Frame timing for animation updates
let lastFrameTime = 0

// Viewport compass
const viewportCompass = useViewportCompass()

// Viewport culling
const culling = useViewportCulling()
let cullingDirty = true

// Track node changes to rebuild spatial index
watch(() => mapStore.nodes.size, () => { cullingDirty = true })

// Region labels (injected from page)
const mapRegions = inject<Ref<Array<{ label: string; centerX: number; centerY: number }>> | null>('mapRegions', null)

// Edge animations (injected from page)
const edgeAnimations = inject<ReturnType<typeof useEdgeAnimations> | null>('edgeAnimations', null)

// Spatial HUD (injected from page)
const spatialHUD = inject<ReturnType<typeof useSpatialHUD> | null>('spatialHUD', null)

// Editing state
const editingNode = ref<Node | null>(null)

// Hover state for node highlighting
const hoveredNodeId = ref<string | null>(null)

// AI suggestion nodes (would be populated by AI features)
const aiSuggestionNodeIds = ref<Set<string>>(new Set())

// Highlighted nodes (for search results)
const highlightedNodeIds = ref<Set<string>>(new Set())

// Dimmed nodes (for filtering)
const dimmedNodeIds = ref<Set<string>>(new Set())

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuPosition = ref<Point>({ x: 0, y: 0 })
const contextMenuNode = ref<Node | null>(null)

// Platform
const { gpu, isMobile } = usePlatform()

// Renderer state
const rendererType = ref<'webgpu' | 'webgl2' | 'canvas2d'>('canvas2d')
const isRendererReady = ref(false)

// Device pixel ratio — cap at 2 on mobile to prevent 3x rendering killing perf
const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768
const dpr = computed(() => {
  if (typeof window === 'undefined') return 1
  const raw = window.devicePixelRatio || 1
  return isMobileViewport ? Math.min(raw, 2) : raw
})

// Theme-aware color palettes
const darkColors = {
  canvasBg: '#0A0A0C',
  gridDot: '#1A1A1E',
  gridLine: 'rgba(255, 255, 255, 0.02)',
  nodeSelected: '#00D2BE',
  nodeGlow: 'rgba(0, 210, 190, 0.08)',
  nodeHoverBorder: '#00D2BE',
  nodeAiGlow: 'rgba(0, 210, 190, 0.15)',
  nodeHighlightGlow: 'rgba(0, 210, 190, 0.1)',
  edgeSelected: '#00D2BE',
  edgeDefault: '#3A3A42',
  nodeBg: '#111113',
  nodeBorder: '#27272A',
  nodeTier2Bg: '#0D0D0F',
  nodeText: '#FAFAFA'
}

const lightColors = {
  canvasBg: '#FAFAF9',
  gridDot: '#D4D4D8',
  gridLine: 'rgba(0, 0, 0, 0.03)',
  nodeSelected: '#00D2BE',
  nodeGlow: 'rgba(0, 210, 190, 0.06)',
  nodeHoverBorder: '#00D2BE',
  nodeAiGlow: 'rgba(0, 210, 190, 0.10)',
  nodeHighlightGlow: 'rgba(0, 210, 190, 0.08)',
  edgeSelected: '#00D2BE',
  edgeDefault: '#D4D4D8',
  nodeBg: '#FFFFFF',
  nodeBorder: '#E8E8E6',
  nodeTier2Bg: '#F5F5F3',
  nodeText: '#111111'
}

// Reactive theme detection
const isLightTheme = ref(false)

function checkTheme() {
  if (typeof document !== 'undefined') {
    isLightTheme.value = document.documentElement.classList.contains('light')
  }
}

onMounted(() => {
  checkTheme()
  const observer = new MutationObserver(checkTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onBeforeUnmount(() => observer.disconnect())
})

const colors = computed(() => isLightTheme.value ? lightColors : darkColors)

// Update which anchors should be visible
function updateAnchorVisibility() {
  visibleAnchors.value.clear()
  if (props.tool !== 'connect') return

  if (isConnecting.value) {
    // Show anchors on all potential targets (not source)
    for (const node of mapStore.nodes.values()) {
      if (node.id !== connectionSourceNode.value?.id) {
        const isRoot = node.isRoot || node.id === mapStore.rootNodeId
        visibleAnchors.value.set(node.id, getVisibleAnchors(node, isRoot, mapStore.edges))
      }
    }
  } else if (hoveredNodeId.value) {
    // Show only on hovered node
    const node = mapStore.nodes.get(hoveredNodeId.value)
    if (node) {
      const isRoot = node.isRoot || node.id === mapStore.rootNodeId
      visibleAnchors.value.set(node.id, getVisibleAnchors(node, isRoot, mapStore.edges))
    }
  }
}

// Get node visual state
function getNodeState(node: Node): NodeState {
  if (isDragging.value && mapStore.selection.nodeIds.has(node.id)) {
    return 'dragging'
  }
  if (aiSuggestionNodeIds.value.has(node.id)) {
    return 'ai-suggestion'
  }
  if (dimmedNodeIds.value.has(node.id)) {
    return 'dimmed'
  }
  if (highlightedNodeIds.value.has(node.id)) {
    return 'highlighted'
  }
  if (mapStore.selection.nodeIds.has(node.id)) {
    return 'selected'
  }
  if (hoveredNodeId.value === node.id) {
    return 'hover'
  }
  return 'normal'
}

// Emit node-hover when hoveredNodeId changes
watch(hoveredNodeId, (nodeId) => {
  if (nodeId) {
    const node = mapStore.nodes.get(nodeId)
    if (node) {
      const sp = worldToScreen(node.position.x + node.size.width / 2, node.position.y)
      emit('node-hover', { nodeId, screenPosition: sp })
    }
  } else {
    emit('node-hover', { nodeId: null, screenPosition: { x: 0, y: 0 } })
  }
})

// Watch for tool changes to clear anchor visibility
watch(() => props.tool, (newTool, oldTool) => {
  if (oldTool === 'connect' && newTool !== 'connect') {
    visibleAnchors.value.clear()
    connectionSnapTarget.value = null
  }
})

// Initialize renderer (Canvas2D only — WebGPU/WebGL2 stubs removed)
onMounted(async () => {
  if (!canvasRef.value || !containerRef.value) return

  rendererType.value = 'canvas2d'

  // Initial canvas sizing
  const rect = containerRef.value.getBoundingClientRect()
  canvasRef.value.width = rect.width * dpr.value
  canvasRef.value.height = rect.height * dpr.value
  canvasRef.value.style.width = `${rect.width}px`
  canvasRef.value.style.height = `${rect.height}px`

  isRendererReady.value = true

  // Set up resize observer
  const resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(containerRef.value)

  // Initial render
  requestAnimationFrame(render)

  onUnmounted(() => {
    resizeObserver.disconnect()
  })
})

// Resize handling
function handleResize() {
  if (!canvasRef.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  canvasRef.value.width = rect.width * dpr.value
  canvasRef.value.height = rect.height * dpr.value
  canvasRef.value.style.width = `${rect.width}px`
  canvasRef.value.style.height = `${rect.height}px`
}

// Main render loop
function render() {
  if (!canvasRef.value || !isRendererReady.value) {
    requestAnimationFrame(render)
    return
  }

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) {
    requestAnimationFrame(render)
    return
  }

  try {
    renderFrame(ctx)
  } catch (e) {
    // Don't let render errors kill the animation loop
    if (import.meta.dev) console.warn('[Canvas] render error:', e)
  }

  requestAnimationFrame(render)
}

function renderFrame(ctx: CanvasRenderingContext2D) {
  if (!canvasRef.value) return

  const { width, height } = canvasRef.value
  const currentTime = performance.now()

  // On mobile, skip frames to maintain 30fps instead of 60fps when idle
  if (isMobileViewport && !isDragging.value && !isPanning.value && !isConnecting.value) {
    const elapsed = currentTime - lastFrameTime
    if (elapsed < 30) { // ~30fps cap when idle on mobile
      requestAnimationFrame(render)
      return
    }
  }

  // Compute delta time for animations
  const dt = lastFrameTime === 0 ? 0.016 : Math.min((currentTime - lastFrameTime) / 1000, 0.064)
  lastFrameTime = currentTime

  // Update node animations
  if (nodeAnimations) {
    nodeAnimations.update(dt, hoveredNodeId.value, mapStore.selection.nodeIds)
  }

  // Update edge animations
  if (edgeAnimations) {
    edgeAnimations.update(dt)
  }

  // Clear canvas with warm off-white
  ctx.fillStyle = colors.value.canvasBg
  ctx.fillRect(0, 0, width, height)

  // Apply camera transform
  ctx.save()
  ctx.scale(dpr.value, dpr.value)
  ctx.translate(props.camera.x, props.camera.y)
  ctx.scale(props.camera.zoom, props.camera.zoom)

  // Draw dot grid (editorial style)
  drawDotGrid(ctx, props.camera, width, height, dpr.value, mapStore.settings.gridSize, mapStore.settings.gridEnabled, colors.value)

  // Rebuild spatial index if dirty
  if (cullingDirty) {
    culling.rebuild(mapStore.nodes)
    cullingDirty = false
  }

  // Viewport culling — determine visible nodes
  const viewW = (canvasRef.value?.width || 0) / dpr.value
  const viewH = (canvasRef.value?.height || 0) / dpr.value
  const visibleNodeIds = culling.getVisibleNodeIds(props.camera, viewW, viewH, 200)
  const visibleEdgeIds = culling.getVisibleEdgeIds(mapStore.edges, visibleNodeIds)
  const lod = culling.getNodeLOD(props.camera.zoom)

  // Draw region labels behind everything at low zoom
  if (props.camera.zoom < 0.3 && mapRegions?.value) {
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.fillStyle = colors.value.nodeText
    ctx.font = `600 ${Math.max(24, 60 / props.camera.zoom * 0.05)}px "Inter", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const region of mapRegions.value) {
      ctx.fillText(region.label, region.centerX, region.centerY)
    }
    ctx.restore()
  }

  // Draw edges (with animation support) — only visible
  for (const edge of mapStore.edges.values()) {
    if (!visibleEdgeIds.has(edge.id)) continue

    // Check edge entrance animation
    const entranceProgress = edgeAnimations?.getEntranceProgress(edge.id) ?? -1

    const animation = connectionAnim.getEdgeAnimation(edge.id)
    if (animation) {
      drawAnimatedEdge(ctx, edge, animation, currentTime)
    } else if (entranceProgress >= 0 && entranceProgress < 1) {
      // Partial entrance draw — save/restore with clip
      ctx.save()
      ctx.globalAlpha = entranceProgress
      drawEdge(ctx, edge)
      ctx.restore()
    } else {
      // Apply edge hover highlight if active
      const hoverProps = edgeAnimations?.getHoverProps(edge.id)
      if (hoverProps && hoverProps.progress > 0) {
        ctx.save()
        // Glow effect
        ctx.shadowColor = colors.value.nodeSelected
        ctx.shadowBlur = hoverProps.glowOpacity * 12
      }
      drawEdge(ctx, edge)
      if (hoverProps && hoverProps.progress > 0) {
        ctx.restore()
      }
    }
  }

  // Draw nodes (skip the one being edited) — with culling, LOD, and animation transforms
  for (const node of mapStore.nodes.values()) {
    if (editingNode.value?.id !== node.id && visibleNodeIds.has(node.id)) {
      if (lod === 'dot') {
        // Extreme zoom out: just a colored circle
        const cx = node.position.x + node.size.width / 2
        const cy = node.position.y + node.size.height / 2
        ctx.fillStyle = node.style.borderColor || colors.value.nodeSelected
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(4, Math.min(node.size.width, node.size.height) / 4), 0, Math.PI * 2)
        ctx.fill()
      } else if (lod === 'simplified') {
        // Mid zoom: shape fill only, no text
        drawNodeSimplified(ctx, node)
      } else if (nodeAnimations) {
        const anim = nodeAnimations.getAnimatedProps(node.id)
        ctx.save()
        ctx.globalAlpha = anim.opacity
        const cx = node.position.x + node.size.width / 2 + anim.offsetX
        const cy = node.position.y + node.size.height / 2 + anim.offsetY
        ctx.translate(cx, cy)
        ctx.scale(anim.scaleX, anim.scaleY)
        ctx.translate(-cx + anim.offsetX, -cy + anim.offsetY)
        drawNode(ctx, node)
        ctx.restore()
      } else {
        drawNode(ctx, node)
      }
    }
  }

  // Draw exiting node ghosts (after deletion)
  if (nodeAnimations) {
    for (const ghost of nodeAnimations.getExitingNodes()) {
      ctx.save()
      ctx.globalAlpha = ghost.opacity
      const snap = ghost.snapshot
      const cx = snap.position.x + snap.size.width / 2
      const cy = snap.position.y + snap.size.height / 2
      ctx.translate(cx, cy + ghost.offsetY)
      ctx.scale(ghost.scale, ghost.scale)
      ctx.translate(-cx, -cy)
      // Draw ghost node shape
      ctx.fillStyle = snap.style.fillColor || colors.value.nodeBg
      ctx.strokeStyle = snap.style.borderColor || colors.value.nodeBorder
      ctx.lineWidth = snap.style.borderWidth || 2
      const radius = snap.style.shape === 'circle' ? Math.min(snap.size.width, snap.size.height) / 2 : 8
      if (snap.style.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(snap.position.x + snap.size.width / 2, snap.position.y + snap.size.height / 2, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.roundRect(snap.position.x, snap.position.y, snap.size.width, snap.size.height, radius)
        ctx.fill()
        ctx.stroke()
      }
      // Ghost text
      ctx.fillStyle = snap.style.textColor || colors.value.nodeText
      ctx.font = `${snap.style.fontWeight || 500} ${snap.style.fontSize || 14}px "Inter", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(snap.content, snap.position.x + snap.size.width / 2, snap.position.y + snap.size.height / 2)
      ctx.restore()
    }

    // Draw pulse effects
    for (const pulse of nodeAnimations.getActivePulses()) {
      const node = mapStore.nodes.get(pulse.nodeId)
      if (!node) continue
      const cx = node.position.x + node.size.width / 2
      const cy = node.position.y + node.size.height / 2
      for (const ring of pulse.rings) {
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(node.size.width, node.size.height) / 2 + ring.radius, 0, Math.PI * 2)
        ctx.strokeStyle = colors.value.nodeSelected
        ctx.lineWidth = 2
        ctx.globalAlpha = ring.opacity * 0.4
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  // Draw root node indicator
  for (const node of mapStore.nodes.values()) {
    const isRoot = node.isRoot || node.id === mapStore.rootNodeId
    const nodeState = getNodeState(node)
    if (isRoot && nodeState !== 'dragging' && editingNode.value?.id !== node.id) {
      drawRootIndicator(ctx, node)
    }
  }

  // Draw anchors on visible nodes
  for (const [nodeId, anchors] of visibleAnchors.value) {
    const node = mapStore.nodes.get(nodeId)
    if (node) {
      drawAnchors(ctx, node, anchors, currentTime)
    }
  }

  // Draw connection preview line
  if (isConnecting.value && connectionSourceNode.value && connectionPreviewEnd.value) {
    drawConnectionPreview(ctx)
  }

  // Draw smart alignment guides during drag
  if (isDragging.value && smartGuides.guides.value.length > 0) {
    drawSmartGuides(ctx, smartGuides.guides.value, props.camera, width, height, dpr.value, colors.value.nodeSelected)
  }

  // Draw box selection rectangle
  if (isBoxSelecting.value && boxSelectionStart.value && boxSelectionEnd.value) {
    drawBoxSelection(ctx)
  }

  ctx.restore()

  // Draw viewport compass in screen space (after world-space restore)
  const screenWidth = width / dpr.value
  const screenHeight = height / dpr.value
  ctx.save()
  ctx.scale(dpr.value, dpr.value)
  const compassIndicators = viewportCompass.computeIndicators(
    props.camera,
    mapStore.nodes,
    screenWidth,
    screenHeight
  )
  if (compassIndicators.length > 0) {
    viewportCompass.draw(ctx, compassIndicators, screenWidth, screenHeight, colors.value.nodeSelected)
  }

  // Spatial HUD is now rendered as a Vue overlay (SpatialHUDOverlay.vue)

  ctx.restore()
}

// (drawDotGrid and lerpColor extracted to renderers/drawGrid.ts and utils/color.ts)

// Draw a single node with minimal styling
function drawNode(ctx: CanvasRenderingContext2D, node: Node) {
  const { x, y } = node.position
  const { width, height } = node.size
  const style = node.style
  const nodeState = getNodeState(node)

  // Handle dimmed state early
  if (nodeState === 'dimmed') {
    ctx.globalAlpha = 0.4
  }

  const drawX = x
  const drawY = y
  const drawWidth = width
  const drawHeight = height

  // Get interpolated animation state
  const animProps = nodeAnimations?.getAnimatedProps(node.id)
  const hoverProg = animProps?.hoverProgress ?? 0
  const selProg = animProps?.selectionProgress ?? 0

  // Enhanced drag feedback — shadow grows, scale slightly up
  if (nodeState === 'dragging') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 6
    ctx.shadowOffsetX = 0
  }

  // Determine border color and width based on state - with interpolated hover
  let borderColor = style.borderColor || colors.value.nodeBorder
  let borderWidth = style.borderWidth || 2
  let fillColor = style.fillColor || colors.value.nodeBg

  // Check if this is a root node
  const isRoot = node.isRoot || node.id === mapStore.rootNodeId

  // Root nodes: solid teal fill, no border per Paper spec
  if (isRoot) {
    fillColor = '#00D2BE'
    borderWidth = 0
  } else {
    // Tier differentiation per Paper spec:
    // Tier-1 (direct child of root): bg #111113, 1.5px border
    // Tier-2+ (deeper): bg #0D0D0F, 1px border #27272A
    const parentNode = node.parentId ? mapStore.nodes.get(node.parentId) : null
    const parentIsRoot = parentNode?.isRoot || parentNode?.id === mapStore.rootNodeId
    if (node.parentId && !parentIsRoot) {
      // Tier-2+ node
      fillColor = style.fillColor === '#111113' || !style.fillColor
        ? colors.value.nodeTier2Bg
        : fillColor
      borderWidth = 1
    }
  }

  // Interpolated hover: blend border color and fill based on hoverProgress
  if (hoverProg > 0 && nodeState !== 'selected' && nodeState !== 'dragging') {
    borderColor = lerpColor(style.borderColor || colors.value.nodeBorder, colors.value.nodeHoverBorder, hoverProg)
    fillColor = lerpColor(style.fillColor || colors.value.nodeBg, isLightTheme.value ? '#E8E8E6' : '#1E1E24', hoverProg)
  }

  switch (nodeState) {
    case 'selected':
      borderColor = colors.value.nodeSelected
      break
    case 'hover':
      // Already handled by interpolated hover above
      break
    case 'ai-suggestion':
      borderColor = colors.value.nodeSelected
      borderWidth = 1
      fillColor = 'transparent'
      ctx.setLineDash([6, 4])
      break
    case 'highlighted':
      borderColor = colors.value.nodeSelected
      break
  }

  // Dim non-dragged nodes while dragging
  if (isDragging.value && nodeState !== 'dragging' && mapStore.selection.nodeIds.size > 0) {
    ctx.globalAlpha *= 0.7
  }

  // Draw shape
  ctx.fillStyle = fillColor
  ctx.strokeStyle = borderColor
  ctx.lineWidth = borderWidth

  const radius = style.shape === 'circle' ? Math.min(drawWidth, drawHeight) / 2 : 6

  if (style.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(drawX + drawWidth / 2, drawY + drawHeight / 2, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (style.shape === 'diamond') {
    ctx.beginPath()
    ctx.moveTo(drawX + drawWidth / 2, drawY)
    ctx.lineTo(drawX + drawWidth, drawY + drawHeight / 2)
    ctx.lineTo(drawX + drawWidth / 2, drawY + drawHeight)
    ctx.lineTo(drawX, drawY + drawHeight / 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    // Rounded rectangle
    ctx.beginPath()
    ctx.roundRect(drawX, drawY, drawWidth, drawHeight, radius)
    ctx.fill()
    ctx.stroke()
  }

  // Animated selection ring — grows from center based on selectionProgress
  if (selProg > 0) {
    const ringExpand = selProg * 3
    ctx.strokeStyle = colors.value.nodeSelected
    ctx.lineWidth = 1
    ctx.globalAlpha = selProg * 0.8
    ctx.beginPath()
    ctx.roundRect(drawX - ringExpand, drawY - ringExpand, drawWidth + ringExpand * 2, drawHeight + ringExpand * 2, radius + ringExpand)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Reset line dash if it was set
  ctx.setLineDash([])

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // Draw text — root node always uses white text for contrast on teal bg
  ctx.fillStyle = isRoot ? '#FAFAFA' : (style.textColor || colors.value.nodeText)
  ctx.font = `${style.fontWeight || 500} ${style.fontSize || 14}px "Inter", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Text wrapping (must match NODE_PADDING_X in mapStore for consistent sizing)
  const maxWidth = drawWidth - 24
  const words = node.content.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  const lineHeight = (style.fontSize || 14) * 1.4
  const textY = drawY + drawHeight / 2 - ((lines.length - 1) * lineHeight) / 2

  lines.forEach((line, index) => {
    ctx.fillText(line, drawX + drawWidth / 2, textY + index * lineHeight)
  })

  // Reset alpha
  ctx.globalAlpha = 1
}

// Draw a simplified node (LOD: shape fill only, no text, minimal detail)
function drawNodeSimplified(ctx: CanvasRenderingContext2D, node: Node) {
  const { x, y } = node.position
  const { width, height } = node.size
  const style = node.style
  const isSelected = mapStore.selection.nodeIds.has(node.id)

  ctx.fillStyle = style.fillColor || colors.value.nodeBg
  ctx.strokeStyle = isSelected ? colors.value.nodeSelected : (style.borderColor || colors.value.nodeBorder)
  ctx.lineWidth = isSelected ? 2 : 1

  const radius = style.shape === 'circle' ? Math.min(width, height) / 2 : 6
  if (style.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    ctx.fill()
    ctx.stroke()
  }
}

// Draw a single edge with minimal styling
function drawEdge(ctx: CanvasRenderingContext2D, edge: Edge) {
  const sourceNode = mapStore.nodes.get(edge.sourceId)
  const targetNode = mapStore.nodes.get(edge.targetId)

  if (!sourceNode || !targetNode) return

  const style = edge.style
  const isSelected = mapStore.selection.edgeIds.has(edge.id)

  // Check if edge is connected to any selected node
  const isConnectedToSelection = mapStore.selection.nodeIds.has(edge.sourceId) ||
                                  mapStore.selection.nodeIds.has(edge.targetId)

  // Get edge points - use anchor points if available, otherwise calculate from boundaries
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

  // Edge styling - highlight if selected or connected to selected node
  const isHighlighted = isSelected || isConnectedToSelection
  ctx.strokeStyle = isHighlighted ? colors.value.edgeSelected : colors.value.edgeDefault
  ctx.lineWidth = isHighlighted ? 2 : 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (style.dashArray) {
    ctx.setLineDash(style.dashArray)
  } else {
    ctx.setLineDash([])
  }

  // Add subtle glow for highlighted edges
  if (isHighlighted) {
    ctx.shadowColor = colors.value.nodeSelected
    ctx.shadowBlur = 4
  }

  ctx.beginPath()

  // Track the tangent point for arrow direction
  let arrowTangentPoint: Point = sourcePoint

  if (style.type === 'bezier') {
    // Premium bezier curve with smart control points
    const dx = targetPoint.x - sourcePoint.x
    const dy = targetPoint.y - sourcePoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Control point offset scales with distance for elegant curves
    const controlOffset = Math.min(distance * 0.4, 80)

    // Determine control point direction based on anchor positions
    let cx1: number, cy1: number, cx2: number, cy2: number

    if (edge.sourceAnchor === 'right' || edge.sourceAnchor === 'left') {
      const dir = edge.sourceAnchor === 'right' ? 1 : -1
      cx1 = sourcePoint.x + controlOffset * dir
      cy1 = sourcePoint.y
    } else if (edge.sourceAnchor === 'top' || edge.sourceAnchor === 'bottom') {
      const dir = edge.sourceAnchor === 'bottom' ? 1 : -1
      cx1 = sourcePoint.x
      cy1 = sourcePoint.y + controlOffset * dir
    } else {
      cx1 = sourcePoint.x + controlOffset * Math.sign(dx || 1)
      cy1 = sourcePoint.y
    }

    if (edge.targetAnchor === 'right' || edge.targetAnchor === 'left') {
      const dir = edge.targetAnchor === 'right' ? 1 : -1
      cx2 = targetPoint.x + controlOffset * dir
      cy2 = targetPoint.y
    } else if (edge.targetAnchor === 'top' || edge.targetAnchor === 'bottom') {
      const dir = edge.targetAnchor === 'bottom' ? 1 : -1
      cx2 = targetPoint.x
      cy2 = targetPoint.y + controlOffset * dir
    } else {
      cx2 = targetPoint.x - controlOffset * Math.sign(dx || 1)
      cy2 = targetPoint.y
    }

    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, targetPoint.x, targetPoint.y)

    // For bezier, arrow tangent comes from second control point
    arrowTangentPoint = { x: cx2, y: cy2 }

  } else if (style.type === 'orthogonal') {
    // Orthogonal path
    const midX = (sourcePoint.x + targetPoint.x) / 2

    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.lineTo(midX, sourcePoint.y)
    ctx.lineTo(midX, targetPoint.y)
    ctx.lineTo(targetPoint.x, targetPoint.y)

    // For orthogonal, arrow tangent is horizontal from midX
    arrowTangentPoint = { x: midX, y: targetPoint.y }

  } else {
    // Straight line
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.lineTo(targetPoint.x, targetPoint.y)

    // For straight line, tangent is from source
    arrowTangentPoint = sourcePoint
  }

  ctx.stroke()

  // Reset shadow and dash
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.setLineDash([])

  // Draw arrow at end - using correct tangent point for direction
  if (style.arrowEnd !== 'none') {
    drawArrow(ctx, targetPoint, arrowTangentPoint, style.arrowEnd, isHighlighted ? colors.value.edgeSelected : colors.value.edgeDefault, isHighlighted)
  }
}

// Get the point where an edge intersects a node boundary
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

// Draw an edge with animation (line draw + pulse)
function drawAnimatedEdge(
  ctx: CanvasRenderingContext2D,
  edge: Edge,
  animation: ReturnType<typeof connectionAnim.getEdgeAnimation>,
  currentTime: number
) {
  if (!animation) {
    drawEdge(ctx, edge)
    return
  }

  const sourceNode = mapStore.nodes.get(edge.sourceId)
  const targetNode = mapStore.nodes.get(edge.targetId)
  if (!sourceNode || !targetNode) return

  const style = edge.style
  const isSelected = mapStore.selection.edgeIds.has(edge.id)
  const isConnectedToSelection = mapStore.selection.nodeIds.has(edge.sourceId) ||
                                  mapStore.selection.nodeIds.has(edge.targetId)
  const isHighlighted = isSelected || isConnectedToSelection

  // Get anchor-based points if available, otherwise use boundary calculation
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

  // Calculate bezier control points (matching drawEdge logic)
  const dx = targetPoint.x - sourcePoint.x
  const dy = targetPoint.y - sourcePoint.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const controlOffset = Math.min(distance * 0.4, 80)

  let cx1: number, cy1: number, cx2: number, cy2: number

  if (edge.sourceAnchor === 'right' || edge.sourceAnchor === 'left') {
    const dir = edge.sourceAnchor === 'right' ? 1 : -1
    cx1 = sourcePoint.x + controlOffset * dir
    cy1 = sourcePoint.y
  } else if (edge.sourceAnchor === 'top' || edge.sourceAnchor === 'bottom') {
    const dir = edge.sourceAnchor === 'bottom' ? 1 : -1
    cx1 = sourcePoint.x
    cy1 = sourcePoint.y + controlOffset * dir
  } else {
    cx1 = sourcePoint.x + controlOffset * Math.sign(dx || 1)
    cy1 = sourcePoint.y
  }

  if (edge.targetAnchor === 'right' || edge.targetAnchor === 'left') {
    const dir = edge.targetAnchor === 'right' ? 1 : -1
    cx2 = targetPoint.x + controlOffset * dir
    cy2 = targetPoint.y
  } else if (edge.targetAnchor === 'top' || edge.targetAnchor === 'bottom') {
    const dir = edge.targetAnchor === 'bottom' ? 1 : -1
    cx2 = targetPoint.x
    cy2 = targetPoint.y + controlOffset * dir
  } else {
    cx2 = targetPoint.x - controlOffset * Math.sign(dx || 1)
    cy2 = targetPoint.y
  }

  // Get animation progress
  const drawProgress = getLineDrawProgress(animation, currentTime)

  // Draw edge styling
  ctx.strokeStyle = isHighlighted ? colors.value.edgeSelected : colors.value.edgeDefault
  ctx.lineWidth = isHighlighted ? 2 : 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (style.dashArray) {
    ctx.setLineDash(style.dashArray)
  } else {
    ctx.setLineDash([])
  }

  ctx.beginPath()

  if (style.type === 'bezier') {
    // Draw partial bezier curve for animation
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    const steps = 20
    for (let i = 1; i <= steps * drawProgress; i++) {
      const t = i / steps
      const x = Math.pow(1 - t, 3) * sourcePoint.x +
                3 * Math.pow(1 - t, 2) * t * cx1 +
                3 * (1 - t) * Math.pow(t, 2) * cx2 +
                Math.pow(t, 3) * targetPoint.x
      const y = Math.pow(1 - t, 3) * sourcePoint.y +
                3 * Math.pow(1 - t, 2) * t * cy1 +
                3 * (1 - t) * Math.pow(t, 2) * cy2 +
                Math.pow(t, 3) * targetPoint.y
      ctx.lineTo(x, y)
    }
  } else {
    // Straight line - simple partial draw
    const currentEndX = sourcePoint.x + (targetPoint.x - sourcePoint.x) * drawProgress
    const currentEndY = sourcePoint.y + (targetPoint.y - sourcePoint.y) * drawProgress
    ctx.moveTo(sourcePoint.x, sourcePoint.y)
    ctx.lineTo(currentEndX, currentEndY)
  }

  ctx.stroke()
  ctx.setLineDash([])

  // Draw pulse dot (after line draw starts)
  const pulseProgress = getPulseProgress(animation, currentTime)
  if (pulseProgress >= 0 && pulseProgress <= 1) {
    let pulseX: number, pulseY: number

    if (style.type === 'bezier') {
      const t = pulseProgress
      pulseX = Math.pow(1 - t, 3) * sourcePoint.x +
               3 * Math.pow(1 - t, 2) * t * cx1 +
               3 * (1 - t) * Math.pow(t, 2) * cx2 +
               Math.pow(t, 3) * targetPoint.x
      pulseY = Math.pow(1 - t, 3) * sourcePoint.y +
               3 * Math.pow(1 - t, 2) * t * cy1 +
               3 * (1 - t) * Math.pow(t, 2) * cy2 +
               Math.pow(t, 3) * targetPoint.y
    } else {
      pulseX = sourcePoint.x + (targetPoint.x - sourcePoint.x) * pulseProgress
      pulseY = sourcePoint.y + (targetPoint.y - sourcePoint.y) * pulseProgress
    }

    const opacity = pulseProgress < 0.2 ? pulseProgress * 5 :
                    pulseProgress > 0.8 ? (1 - pulseProgress) * 5 : 1

    ctx.beginPath()
    ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2)
    ctx.fillStyle = colors.value.nodeSelected
    ctx.globalAlpha = opacity
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Draw arrow at end if animation is complete - use control point for tangent
  if (drawProgress >= 1 && style.arrowEnd !== 'none') {
    const tangentPoint = style.type === 'bezier' ? { x: cx2, y: cy2 } : sourcePoint
    drawArrow(ctx, targetPoint, tangentPoint, style.arrowEnd, isHighlighted ? colors.value.edgeSelected : colors.value.edgeDefault, isHighlighted)
  }
}

// Draw premium arrow head - follows curve tangent properly
function drawArrow(
  ctx: CanvasRenderingContext2D,
  tipPoint: Point,
  tangentFrom: Point,  // Point to calculate tangent direction (control point for bezier)
  style: string,
  color: string,
  isHighlighted: boolean = false
) {
  // Calculate angle from tangent
  const angle = Math.atan2(tipPoint.y - tangentFrom.y, tipPoint.x - tangentFrom.x)

  // Clean, minimal arrow sizing
  const arrowLength = 10
  const arrowWidth = 8

  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Subtle glow for highlighted
  if (isHighlighted) {
    ctx.shadowColor = color
    ctx.shadowBlur = 4
  }

  if (style === 'arrow') {
    // Clean triangular arrow - simple and elegant
    const tipX = tipPoint.x
    const tipY = tipPoint.y

    // Calculate perpendicular for wing spread
    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)

    // Arrow base point (pulled back from tip)
    const baseX = tipX - arrowLength * Math.cos(angle)
    const baseY = tipY - arrowLength * Math.sin(angle)

    // Wing points
    const halfWidth = arrowWidth / 2
    const wing1X = baseX + perpX * halfWidth
    const wing1Y = baseY + perpY * halfWidth
    const wing2X = baseX - perpX * halfWidth
    const wing2Y = baseY - perpY * halfWidth

    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(wing1X, wing1Y)
    ctx.lineTo(wing2X, wing2Y)
    ctx.closePath()
    ctx.fill()

  } else if (style === 'dot') {
    // Simple filled circle
    ctx.beginPath()
    ctx.arc(tipPoint.x, tipPoint.y, 4, 0, Math.PI * 2)
    ctx.fill()

  } else if (style === 'diamond') {
    // Clean diamond shape
    const size = 6

    // Diamond points along the tangent direction
    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)

    ctx.beginPath()
    ctx.moveTo(tipPoint.x, tipPoint.y)
    ctx.lineTo(tipPoint.x - size * Math.cos(angle) + size * 0.5 * perpX,
               tipPoint.y - size * Math.sin(angle) + size * 0.5 * perpY)
    ctx.lineTo(tipPoint.x - size * 2 * Math.cos(angle),
               tipPoint.y - size * 2 * Math.sin(angle))
    ctx.lineTo(tipPoint.x - size * Math.cos(angle) - size * 0.5 * perpX,
               tipPoint.y - size * Math.sin(angle) - size * 0.5 * perpY)
    ctx.closePath()
    ctx.fill()
  }

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

// Draw anchors for a node with premium styling
function drawAnchors(ctx: CanvasRenderingContext2D, node: Node, anchors: Anchor[], currentTime: number) {
  for (const anchor of anchors) {
    const point = getAnchorPoint(node, anchor)
    const isSnapped = connectionSnapTarget.value?.node.id === node.id &&
                      connectionSnapTarget.value?.anchor === anchor
    const scale = getAnchorScale(node.id, anchor, currentTime)
    const baseSize = isSnapped ? 12 : 10
    const size = baseSize * scale

    // Glow effect for snapped anchor
    if (isSnapped) {
      ctx.shadowColor = colors.value.nodeSelected
      ctx.shadowBlur = 12
    }

    // Outer ring
    ctx.beginPath()
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
    ctx.fillStyle = isSnapped ? colors.value.nodeSelected : (isLightTheme.value ? '#F5F5F3' : '#1A1A20')
    ctx.fill()

    // Border
    ctx.strokeStyle = isSnapped ? colors.value.nodeSelected : (isLightTheme.value ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)')
    ctx.lineWidth = isSnapped ? 2 : 1.5
    ctx.stroke()

    // Inner highlight dot for premium look
    ctx.beginPath()
    ctx.arc(point.x, point.y, size / 4, 0, Math.PI * 2)
    ctx.fillStyle = isSnapped ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'
    ctx.fill()

    // Reset shadow
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }
}

// Draw root node indicator (premium crown/badge above node)
function drawRootIndicator(ctx: CanvasRenderingContext2D, node: Node) {
  const { x, y } = node.position
  const { width } = node.size
  const centerX = x + width / 2
  const indicatorY = y - 10

  // Subtle glow
  ctx.shadowColor = colors.value.nodeSelected
  ctx.shadowBlur = 6

  // Draw premium pill-shaped indicator
  ctx.fillStyle = colors.value.nodeSelected
  ctx.globalAlpha = 0.6

  // Rounded rectangle (pill shape)
  const pillWidth = 20
  const pillHeight = 4
  const pillRadius = pillHeight / 2

  ctx.beginPath()
  ctx.moveTo(centerX - pillWidth / 2 + pillRadius, indicatorY)
  ctx.lineTo(centerX + pillWidth / 2 - pillRadius, indicatorY)
  ctx.arc(centerX + pillWidth / 2 - pillRadius, indicatorY + pillRadius, pillRadius, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(centerX - pillWidth / 2 + pillRadius, indicatorY + pillHeight)
  ctx.arc(centerX - pillWidth / 2 + pillRadius, indicatorY + pillRadius, pillRadius, Math.PI / 2, -Math.PI / 2)
  ctx.closePath()
  ctx.fill()

  // Reset
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

// Draw box selection rectangle
function drawBoxSelection(ctx: CanvasRenderingContext2D) {
  if (!boxSelectionStart.value || !boxSelectionEnd.value) return

  const x = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x)
  const y = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y)
  const width = Math.abs(boxSelectionEnd.value.x - boxSelectionStart.value.x)
  const height = Math.abs(boxSelectionEnd.value.y - boxSelectionStart.value.y)
  const radius = 4 / props.camera.zoom

  // Fill with semi-transparent teal (rounded corners)
  ctx.fillStyle = 'rgba(0, 210, 190, 0.08)'
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()

  // Animated dashed border with teal
  ctx.strokeStyle = colors.value.nodeSelected
  ctx.lineWidth = 1 / props.camera.zoom
  const dashSize = 4 / props.camera.zoom
  ctx.setLineDash([dashSize, dashSize])
  ctx.lineDashOffset = -(performance.now() / 50) % (dashSize * 2)
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.lineDashOffset = 0

  // Selected count badge (if nodes are being selected)
  const selectedInBox = countNodesInBox(x, y, width, height)
  if (selectedInBox > 0) {
    const badgeX = x + width
    const badgeY = y - 12 / props.camera.zoom
    const fontSize = 10 / props.camera.zoom
    ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`
    const text = selectedInBox.toString()
    const metrics = ctx.measureText(text)
    const badgeW = Math.max(metrics.width + 8 / props.camera.zoom, 16 / props.camera.zoom)
    const badgeH = 14 / props.camera.zoom

    ctx.fillStyle = colors.value.nodeSelected
    ctx.beginPath()
    ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, badgeH / 2)
    ctx.fill()

    ctx.fillStyle = '#0A0A0C'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, badgeX, badgeY)
  }
}

function countNodesInBox(x: number, y: number, width: number, height: number): number {
  let count = 0
  const maxX = x + width
  const maxY = y + height
  for (const node of mapStore.nodes.values()) {
    const nodeRight = node.position.x + node.size.width
    const nodeBottom = node.position.y + node.size.height
    if (node.position.x < maxX && nodeRight > x && node.position.y < maxY && nodeBottom > y) {
      count++
    }
  }
  return count
}

// Draw connection preview line
function drawConnectionPreview(ctx: CanvasRenderingContext2D) {
  if (!connectionSourceNode.value || !connectionPreviewEnd.value) return

  const sourceNode = connectionSourceNode.value

  // Use anchor point if available, otherwise calculate from node boundary
  let sourcePoint: Point
  if (connectionSourceAnchor.value) {
    sourcePoint = getAnchorPoint(sourceNode, connectionSourceAnchor.value)
  } else {
    sourcePoint = getEdgePoint(sourceNode, connectionPreviewEnd.value)
  }

  // Determine target point - snap to anchor if available
  let targetPoint: Point
  if (connectionSnapTarget.value) {
    targetPoint = connectionSnapTarget.value.point
  } else {
    targetPoint = connectionPreviewEnd.value
  }

  // Premium connection preview with bezier curve and glow
  const dx = targetPoint.x - sourcePoint.x
  const dy = targetPoint.y - sourcePoint.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const controlOffset = Math.min(distance * 0.4, 60)

  // Determine control points based on source anchor
  let cx1: number, cy1: number, cx2: number, cy2: number

  if (connectionSourceAnchor.value === 'right' || connectionSourceAnchor.value === 'left') {
    const dir = connectionSourceAnchor.value === 'right' ? 1 : -1
    cx1 = sourcePoint.x + controlOffset * dir
    cy1 = sourcePoint.y
  } else if (connectionSourceAnchor.value === 'top' || connectionSourceAnchor.value === 'bottom') {
    const dir = connectionSourceAnchor.value === 'bottom' ? 1 : -1
    cx1 = sourcePoint.x
    cy1 = sourcePoint.y + controlOffset * dir
  } else {
    cx1 = sourcePoint.x + controlOffset * Math.sign(dx || 1)
    cy1 = sourcePoint.y
  }

  // Target control point - pull back towards source
  if (connectionSnapTarget.value) {
    const ta = connectionSnapTarget.value.anchor
    if (ta === 'right' || ta === 'left') {
      const dir = ta === 'right' ? 1 : -1
      cx2 = targetPoint.x + controlOffset * dir
      cy2 = targetPoint.y
    } else if (ta === 'top' || ta === 'bottom') {
      const dir = ta === 'bottom' ? 1 : -1
      cx2 = targetPoint.x
      cy2 = targetPoint.y + controlOffset * dir
    } else {
      cx2 = targetPoint.x - controlOffset * Math.sign(dx || 1)
      cy2 = targetPoint.y
    }
  } else {
    cx2 = targetPoint.x - controlOffset * Math.sign(dx || 1)
    cy2 = targetPoint.y
  }

  // Subtle glow effect
  ctx.shadowColor = colors.value.nodeSelected
  ctx.shadowBlur = 8

  // Draw bezier curve with animated dashes
  ctx.strokeStyle = colors.value.nodeSelected
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  const dashOffset = -(performance.now() / 40) % 14
  ctx.lineDashOffset = dashOffset
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.8

  ctx.beginPath()
  ctx.moveTo(sourcePoint.x, sourcePoint.y)
  ctx.bezierCurveTo(cx1, cy1, cx2, cy2, targetPoint.x, targetPoint.y)
  ctx.stroke()

  // Draw end indicator
  ctx.globalAlpha = 1
  ctx.fillStyle = colors.value.nodeSelected

  if (connectionSnapTarget.value) {
    // Snapped: draw premium ring indicator
    ctx.beginPath()
    ctx.arc(targetPoint.x, targetPoint.y, 8, 0, Math.PI * 2)
    ctx.fill()

    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.arc(targetPoint.x - 1, targetPoint.y - 1, 3, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Not snapped: small dot
    ctx.beginPath()
    ctx.arc(targetPoint.x, targetPoint.y, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Reset
  ctx.setLineDash([])
  ctx.lineDashOffset = 0
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}

// Screen to world coordinate conversion
function screenToWorld(screenX: number, screenY: number): Point {
  return {
    x: (screenX - props.camera.x) / props.camera.zoom,
    y: (screenY - props.camera.y) / props.camera.zoom
  }
}

// World to screen coordinate conversion
function worldToScreen(worldX: number, worldY: number): Point {
  return {
    x: worldX * props.camera.zoom + props.camera.x,
    y: worldY * props.camera.zoom + props.camera.y
  }
}

// Find node at position
function findNodeAtPosition(worldPos: Point): Node | null {
  // Iterate in reverse to get topmost node first
  const nodes = Array.from(mapStore.nodes.values()).reverse()
  for (const node of nodes) {
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

// Find edge at position (within threshold distance from line)
function findEdgeAtPosition(worldPos: Point, threshold: number = 8): Edge | null {
  for (const edge of mapStore.edges.values()) {
    const sourceNode = mapStore.nodes.get(edge.sourceId)
    const targetNode = mapStore.nodes.get(edge.targetId)
    if (!sourceNode || !targetNode) continue

    // Get edge points
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
    if (distance <= threshold / props.camera.zoom) {
      return edge
    }
  }
  return null
}

// Calculate distance from point to line segment
function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
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

// Start editing a node
function startEditing(node: Node) {
  editingNode.value = node
  mapStore.select([node.id])
}

// Save node edit
function saveNodeEdit(content: string) {
  if (editingNode.value) {
    mapStore.updateNode(editingNode.value.id, { content })
    editingNode.value = null
  }
}

// Cancel node edit
function cancelNodeEdit() {
  editingNode.value = null
}

// Mouse/touch event handlers
function handlePointerDown(event: PointerEvent) {
  if (!containerRef.value) return

  // Don't process if we're editing
  if (editingNode.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const screenPos = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const worldPos = screenToWorld(screenPos.x, screenPos.y)

  lastMousePos.value = screenPos
  dragStart.value = screenPos

  if (props.tool === 'pan' || event.button === 1) {
    // Middle mouse button or pan tool
    isPanning.value = true
    containerRef.value.style.cursor = 'grabbing'
  } else if (props.tool === 'connect') {
    // Connection tool - start from node
    const node = findNodeAtPosition(worldPos)
    if (node) {
      isConnecting.value = true
      connectionSourceNode.value = node
      connectionPreviewEnd.value = worldPos

      // Check if clicked on a specific anchor
      const nodeAnchors = visibleAnchors.value.get(node.id)
      if (nodeAnchors) {
        const snap = checkAnchorSnap(worldPos, node, nodeAnchors, 20)
        if (snap) {
          connectionSourceAnchor.value = snap.anchor
        } else {
          // Default to right anchor
          connectionSourceAnchor.value = 'right'
        }
      } else {
        connectionSourceAnchor.value = 'right'
      }

      // Show anchors on all potential target nodes
      updateAnchorVisibility()

      // Trigger appear animations for target anchors
      for (const [nodeId, anchors] of visibleAnchors.value) {
        connectionAnim.triggerAnchorsAppear(nodeId, anchors)
      }

      containerRef.value.style.cursor = 'crosshair'
    }
  } else if (props.tool === 'select') {
    const node = findNodeAtPosition(worldPos)
    if (node) {
      if (event.shiftKey) {
        // Add to selection
        mapStore.addToSelection([node.id])
      } else if (!mapStore.selection.nodeIds.has(node.id)) {
        // Select only this node
        mapStore.select([node.id])
      }
      // Don't start drag immediately — wait for threshold
      pendingDrag.value = true
      dragStartScreen.value = screenPos
      isDragging.value = false
    } else {
      // Check if clicked on an edge
      const edge = findEdgeAtPosition(worldPos)
      if (edge) {
        if (event.altKey) {
          // Alt+click: Quick delete edge (disconnect nodes)
          mapStore.deleteEdge(edge.id)
        } else if (event.shiftKey) {
          // Add edge to selection
          mapStore.addToSelection([], [edge.id])
        } else {
          // Select only this edge
          mapStore.select([], [edge.id])
        }
      } else {
        // Empty canvas interaction
        if (isMobileViewport && event.pointerType === 'touch') {
          // Mobile: single-finger on empty canvas → pan
          mapStore.clearSelection()
          isPanning.value = true
        } else {
          // Desktop: box selection
          if (!event.shiftKey) {
            mapStore.clearSelection()
          }
          isBoxSelecting.value = true
          boxSelectionStart.value = worldPos
          boxSelectionEnd.value = worldPos
        }
      }
    }
  } else if (props.tool === 'node') {
    // Create new node at position
    const node = mapStore.addNode({
      position: worldPos,
      content: 'New Node'
    })
    mapStore.select([node.id])
  }

  // Capture pointer for drag tracking
  containerRef.value.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const screenPos = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const worldPos = screenToWorld(screenPos.x, screenPos.y)
  const dx = screenPos.x - lastMousePos.value.x
  const dy = screenPos.y - lastMousePos.value.y

  // Update hover state
  if (!isDragging.value && !pendingDrag.value && !isPanning.value && !isConnecting.value && !isBoxSelecting.value) {
    const nodeUnderMouse = findNodeAtPosition(worldPos)
    const previousHovered = hoveredNodeId.value
    hoveredNodeId.value = nodeUnderMouse?.id ?? null

    // Edge hover detection for edge animations
    if (!nodeUnderMouse && edgeAnimations) {
      const edge = findEdgeAtPosition(worldPos, 12)
      edgeAnimations.setHoveredEdge(edge?.id ?? null)
    } else if (edgeAnimations) {
      edgeAnimations.setHoveredEdge(null)
    }

    // Update anchor visibility when hover changes in connect mode
    if (props.tool === 'connect' && previousHovered !== hoveredNodeId.value) {
      updateAnchorVisibility()

      // Trigger appear animation for new hovered node
      if (hoveredNodeId.value) {
        const anchors = visibleAnchors.value.get(hoveredNodeId.value)
        if (anchors) {
          connectionAnim.triggerAnchorsAppear(hoveredNodeId.value, anchors)
        }
      }
    }
  }

  if (isPanning.value) {
    // Track velocity for momentum on release
    panVelocity.addSample(screenPos.x, screenPos.y)

    emit('update:camera', {
      ...props.camera,
      x: props.camera.x + dx,
      y: props.camera.y + dy
    })
  } else if (isConnecting.value) {
    // Update connection preview end point
    connectionPreviewEnd.value = worldPos

    // Check for anchor snap on all target nodes
    connectionSnapTarget.value = null
    for (const node of mapStore.nodes.values()) {
      if (node.id === connectionSourceNode.value?.id) continue

      const nodeAnchors = visibleAnchors.value.get(node.id)
      if (nodeAnchors) {
        const snap = checkAnchorSnap(worldPos, node, nodeAnchors, 30)
        if (snap) {
          connectionSnapTarget.value = {
            node,
            anchor: snap.anchor,
            point: snap.point
          }
          hoveredNodeId.value = node.id
          break
        }
      }
    }

    // If no snap, check if hovering over a node
    if (!connectionSnapTarget.value) {
      const targetNode = findNodeAtPosition(worldPos)
      if (targetNode && targetNode.id !== connectionSourceNode.value?.id) {
        hoveredNodeId.value = targetNode.id
      } else {
        hoveredNodeId.value = null
      }
    }
  } else if (pendingDrag.value && !isDragging.value) {
    // Check if drag threshold exceeded
    if (dragStartScreen.value) {
      const tdx = screenPos.x - dragStartScreen.value.x
      const tdy = screenPos.y - dragStartScreen.value.y
      if (Math.sqrt(tdx * tdx + tdy * tdy) >= DRAG_THRESHOLD) {
        isDragging.value = true

        // Capture pre-drag positions for undo
        const nodeIds = [...mapStore.selection.nodeIds]
        dragOriginalPositions = mapStore.beginMoveNodes(nodeIds)

        // Store absolute offset: click point relative to each node
        const worldClickPos = screenToWorld(dragStartScreen.value.x, dragStartScreen.value.y)
        dragNodeOffsets = new Map()
        for (const nodeId of nodeIds) {
          const node = mapStore.nodes.get(nodeId)
          if (node && !node.locked) {
            dragNodeOffsets.set(nodeId, {
              x: node.position.x - worldClickPos.x,
              y: node.position.y - worldClickPos.y
            })
          }
        }
      }
    }
  } else if (isDragging.value && dragNodeOffsets) {
    // Move selected nodes using absolute offset tracking (prevents drift)
    const worldMousePos = screenToWorld(screenPos.x, screenPos.y)

    // Compute target positions
    const draggedNodes = new Map<string, Node>()
    for (const [nodeId, offset] of dragNodeOffsets) {
      const targetX = worldMousePos.x + offset.x
      const targetY = worldMousePos.y + offset.y
      mapStore.moveNode(nodeId, targetX, targetY, false) // no snap during drag
      const node = mapStore.nodes.get(nodeId)
      if (node) draggedNodes.set(nodeId, node)
    }

    // Compute smart alignment guides and apply micro-snap
    const guideResult = smartGuides.compute(draggedNodes, mapStore.nodes, mapStore.selection.nodeIds)
    if (guideResult.snapDx !== 0 || guideResult.snapDy !== 0) {
      for (const [nodeId] of dragNodeOffsets) {
        const node = mapStore.nodes.get(nodeId)
        if (node && !node.locked) {
          mapStore.moveNode(nodeId, node.position.x + guideResult.snapDx, node.position.y + guideResult.snapDy, false)
        }
      }
    }

    cullingDirty = true
  } else if (isBoxSelecting.value) {
    // Update box selection end point
    boxSelectionEnd.value = worldPos
  }

  lastMousePos.value = screenPos
}

function handlePointerUp(event: PointerEvent) {
  // Handle connection completion
  if (isConnecting.value && connectionSourceNode.value) {
    const rect = containerRef.value?.getBoundingClientRect()
    if (rect) {
      const screenPos = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const worldPos = screenToWorld(screenPos.x, screenPos.y)

      // Determine target node and anchor
      let targetNode: Node | null = null
      let targetAnchor: Anchor | undefined

      if (connectionSnapTarget.value) {
        targetNode = connectionSnapTarget.value.node
        targetAnchor = connectionSnapTarget.value.anchor
      } else {
        targetNode = findNodeAtPosition(worldPos)
      }

      // Create edge if dropping on a different node
      if (targetNode && targetNode.id !== connectionSourceNode.value.id) {
        // Check for duplicate edges
        const existingEdge = Array.from(mapStore.edges.values()).find(
          e => (e.sourceId === connectionSourceNode.value!.id && e.targetId === targetNode!.id) ||
               (e.sourceId === targetNode!.id && e.targetId === connectionSourceNode.value!.id)
        )

        if (!existingEdge) {
          // Use source anchor if set, otherwise calculate best pair
          let sourceAnchor = connectionSourceAnchor.value || undefined
          if (!sourceAnchor || !targetAnchor) {
            const bestPair = getBestAnchorPair(connectionSourceNode.value, targetNode)
            sourceAnchor = sourceAnchor || bestPair.sourceAnchor
            targetAnchor = targetAnchor || bestPair.targetAnchor
          }

          const edge = mapStore.addEdge(
            connectionSourceNode.value.id,
            targetNode.id,
            undefined,
            sourceAnchor,
            targetAnchor
          )

          // Trigger connection animation
          connectionAnim.startConnectionAnimation(
            edge.id,
            connectionSourceNode.value.id,
            targetNode.id,
            sourceAnchor,
            targetAnchor
          )
        }
      }
    }

    // Reset connection state
    isConnecting.value = false
    connectionSourceNode.value = null
    connectionPreviewEnd.value = null
    connectionSourceAnchor.value = null
    connectionSnapTarget.value = null
    visibleAnchors.value.clear()
  }

  // Handle box selection completion
  if (isBoxSelecting.value && boxSelectionStart.value && boxSelectionEnd.value) {
    const selectedNodes: string[] = []
    const selectedEdges: string[] = []

    // Calculate selection bounds
    const minX = Math.min(boxSelectionStart.value.x, boxSelectionEnd.value.x)
    const maxX = Math.max(boxSelectionStart.value.x, boxSelectionEnd.value.x)
    const minY = Math.min(boxSelectionStart.value.y, boxSelectionEnd.value.y)
    const maxY = Math.max(boxSelectionStart.value.y, boxSelectionEnd.value.y)

    // Find nodes within the box
    for (const node of mapStore.nodes.values()) {
      const nodeRight = node.position.x + node.size.width
      const nodeBottom = node.position.y + node.size.height

      // Check if node intersects with selection box
      if (node.position.x < maxX && nodeRight > minX &&
          node.position.y < maxY && nodeBottom > minY) {
        selectedNodes.push(node.id)
      }
    }

    // Find edges within the box (both endpoints inside)
    for (const edge of mapStore.edges.values()) {
      const sourceNode = mapStore.nodes.get(edge.sourceId)
      const targetNode = mapStore.nodes.get(edge.targetId)
      if (!sourceNode || !targetNode) continue

      // Get edge endpoints
      let sourcePoint: Point
      let targetPoint: Point

      if (edge.sourceAnchor) {
        sourcePoint = getAnchorPoint(sourceNode, edge.sourceAnchor)
      } else {
        sourcePoint = {
          x: sourceNode.position.x + sourceNode.size.width / 2,
          y: sourceNode.position.y + sourceNode.size.height / 2
        }
      }

      if (edge.targetAnchor) {
        targetPoint = getAnchorPoint(targetNode, edge.targetAnchor)
      } else {
        targetPoint = {
          x: targetNode.position.x + targetNode.size.width / 2,
          y: targetNode.position.y + targetNode.size.height / 2
        }
      }

      // Check if edge midpoint or both nodes are in selection
      const midX = (sourcePoint.x + targetPoint.x) / 2
      const midY = (sourcePoint.y + targetPoint.y) / 2

      if ((midX >= minX && midX <= maxX && midY >= minY && midY <= maxY) ||
          (selectedNodes.includes(edge.sourceId) && selectedNodes.includes(edge.targetId))) {
        selectedEdges.push(edge.id)
      }
    }

    // Apply selection
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      mapStore.select(selectedNodes, selectedEdges)
    }

    // Reset box selection state
    isBoxSelecting.value = false
    boxSelectionStart.value = null
    boxSelectionEnd.value = null
  }

  // Finalize drag: snap-on-drop + commit undo
  if (isDragging.value && dragNodeOffsets && dragOriginalPositions) {
    // Clear smart guides
    smartGuides.clear()

    // Snap to grid on drop if enabled
    for (const [nodeId] of dragNodeOffsets) {
      const node = mapStore.nodes.get(nodeId)
      if (node && !node.locked) {
        mapStore.moveNode(nodeId, node.position.x, node.position.y, true) // snap on drop
      }
    }

    // Record single undo entry for entire drag
    const nodeIds = [...dragNodeOffsets.keys()]
    mapStore.commitMoveNodes(nodeIds, dragOriginalPositions)

    dragOriginalPositions = null
    dragNodeOffsets = null
    cullingDirty = true
  }

  // Emit pan-end with velocity for momentum
  if (isPanning.value) {
    const velocity = panVelocity.getVelocity()
    if (Math.abs(velocity.vx) > 50 || Math.abs(velocity.vy) > 50) {
      emit('pan-end', velocity)
    }
    panVelocity.reset()
  }

  isPanning.value = false
  isDragging.value = false
  pendingDrag.value = false
  dragStartScreen.value = null
  dragStart.value = null

  if (containerRef.value) {
    containerRef.value.style.cursor = ''
    containerRef.value.releasePointerCapture(event.pointerId)
  }
}

// Double-click to edit node or create new one
function handleDoubleClick(event: MouseEvent) {
  if (!containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const screenPos = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const worldPos = screenToWorld(screenPos.x, screenPos.y)

  // Check if double-clicked on a node
  const existingNode = findNodeAtPosition(worldPos)
  if (existingNode) {
    // Start editing node content
    startEditing(existingNode)
    return
  }

  // Create new node at position (only in select mode)
  if (props.tool === 'select') {
    const node = mapStore.addNode({
      position: {
        x: worldPos.x - 75, // Center the node
        y: worldPos.y - 25
      },
      content: 'New Node'
    })
    mapStore.select([node.id])
    // Start editing the new node
    nextTick(() => {
      startEditing(node)
    })
  }
}

// Touch gesture handling for mobile
const touchStartDistance = ref(0)
const touchStartZoom = ref(1)

function handleTouchStart(event: TouchEvent) {
  if (event.touches.length === 2) {
    // Pinch zoom start — cancel any single-finger drag in progress
    pendingDrag.value = false
    isDragging.value = false
    isPanning.value = false

    const touch0 = event.touches[0]
    const touch1 = event.touches[1]
    if (!touch0 || !touch1) return
    const dx = touch0.clientX - touch1.clientX
    const dy = touch0.clientY - touch1.clientY
    touchStartDistance.value = Math.sqrt(dx * dx + dy * dy)
    touchStartZoom.value = props.camera.zoom
    event.preventDefault()
  }
}

function handleTouchMove(event: TouchEvent) {
  if (event.touches.length === 2 && touchStartDistance.value > 0) {
    // Pinch zoom
    event.preventDefault()
    const touch0 = event.touches[0]
    const touch1 = event.touches[1]
    if (!touch0 || !touch1) return
    const dx = touch0.clientX - touch1.clientX
    const dy = touch0.clientY - touch1.clientY
    const distance = Math.sqrt(dx * dx + dy * dy)

    const scale = distance / touchStartDistance.value
    const newZoom = Math.max(0.1, Math.min(5, touchStartZoom.value * scale))

    emit('update:camera', {
      ...props.camera,
      zoom: newZoom
    })
  }
}

function handleTouchEnd() {
  touchStartDistance.value = 0
}

// Keyboard shortcuts
onKeyStroke('Delete', () => {
  if (!editingNode.value) {
    mapStore.deleteSelected()
  }
})

onKeyStroke('Backspace', (e) => {
  if (!editingNode.value && (e.metaKey || e.ctrlKey)) {
    mapStore.deleteSelected()
  }
})

onKeyStroke('a', (e) => {
  if ((e.ctrlKey || e.metaKey) && !editingNode.value) {
    e.preventDefault()
    mapStore.selectAll()
  }
})

onKeyStroke('d', (e) => {
  if ((e.ctrlKey || e.metaKey) && !editingNode.value) {
    e.preventDefault()
    mapStore.duplicateSelected()
  }
})

onKeyStroke('z', (e) => {
  if ((e.ctrlKey || e.metaKey) && !editingNode.value) {
    e.preventDefault()
    if (e.shiftKey) {
      mapStore.redo()
    } else {
      mapStore.undo()
    }
  }
})

onKeyStroke('Escape', () => {
  if (editingNode.value) {
    cancelNodeEdit()
  }
})

// Context menu handler
function handleContextMenu(event: MouseEvent) {
  event.preventDefault()

  if (!containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  const screenPos = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const worldPos = screenToWorld(screenPos.x, screenPos.y)

  const node = findNodeAtPosition(worldPos)
  let edge: Edge | null = null

  // If right-clicked on a node, select it if not already selected
  if (node && !mapStore.selection.nodeIds.has(node.id)) {
    mapStore.select([node.id])
  }

  // If no node, check for edge
  if (!node) {
    edge = findEdgeAtPosition(worldPos)
    if (edge && !mapStore.selection.edgeIds.has(edge.id)) {
      mapStore.select([], [edge.id])
    }
  }

  emit('contextmenu', {
    node,
    edge,
    position: worldPos,
    screenPosition: { x: event.clientX, y: event.clientY }
  })
}

// Drop zone feedback
const isDragOver = ref(false)

// Drag and drop handlers
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

  if (!containerRef.value || !event.dataTransfer) return

  const rect = containerRef.value.getBoundingClientRect()
  const screenPos = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const worldPos = screenToWorld(screenPos.x, screenPos.y)

  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'))

    if (data.type === 'category') {
      emit('drop-category', {
        category: data.category,
        position: worldPos
      })
    } else if (data.type === 'node') {
      emit('drop-node', {
        nodeId: data.nodeId,
        position: worldPos
      })
    }
  } catch (e) {
    // Invalid drop data, ignore
  }
}

// Expose methods and state for parent components
defineExpose({
  containerRef,
  canvasRef,
  hoveredNodeId,
  isDragOver,
  aiSuggestionNodeIds,
  highlightedNodeIds,
  dimmedNodeIds,
  screenToWorld,
  worldToScreen,
  findNodeAtPosition
})

// Cursor style based on tool
const cursorStyle = computed(() => {
  switch (props.tool) {
    case 'pan':
      return 'cursor-grab'
    case 'node':
      return 'cursor-crosshair'
    case 'connect':
      return 'cursor-crosshair'
    default:
      return 'cursor-default'
  }
})
</script>

<template>
  <div
    ref="containerRef"
    :class="['relative w-full h-full overflow-hidden select-none', cursorStyle]"
    style="touch-action: none"
    tabindex="0"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
    @dblclick="handleDoubleClick"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @contextmenu="handleContextMenu"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <!-- Main canvas -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0"
    />

    <!-- Semantic Field Layer (between edges and nodes visually) -->
    <CanvasSemanticFieldLayer
      :camera="camera"
    />

    <!-- DOM overlay for editable nodes -->
    <div
      ref="overlayRef"
      class="absolute inset-0 pointer-events-none"
    >
      <!-- Node editor -->
      <NodeEditor
        v-if="editingNode"
        :node="editingNode"
        :camera="camera"
        @save="saveNodeEdit"
        @cancel="cancelNodeEdit"
      />
    </div>

    <!-- Renderer indicator (dev only) -->
    <div
      v-if="false"
      class="absolute top-2 left-2 text-xs text-nc-ink-muted nc-glass rounded px-2 py-1"
    >
      {{ rendererType }}
    </div>
  </div>
</template>
