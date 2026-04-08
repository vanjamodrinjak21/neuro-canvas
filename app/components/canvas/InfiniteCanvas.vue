<script setup lang="ts">
import type { Camera, CanvasTool, Point, Node, Edge } from '~/types'
import type { NodeAnimationsAPI } from '~/composables/useNodeAnimations'
import type { useEdgeAnimations } from '~/composables/useEdgeAnimations'
import type { useSpatialHUD } from '~/composables/useSpatialHUD'
import type { NodeState } from '~/components/canvas/renderers/drawNode'

// Extracted composables
import { useCanvasTheme } from '~/composables/useCanvasTheme'
import { screenToWorld, worldToScreen } from '~/composables/useCanvasCoordinates'
import { findNodeAtPosition } from '~/composables/useNodeHitTest'
import { useNodeEditing } from '~/composables/useNodeEditing'
import { useBoxSelection } from '~/composables/useBoxSelection'
import { useConnectionTool } from '~/composables/useConnectionTool'
import { useDragInteraction } from '~/composables/useDragInteraction'
import { useCanvasInteraction } from '~/composables/useCanvasInteraction'
import { useRenderLoop } from '~/composables/useRenderLoop'
import { useTouchGestures } from '~/composables/useTouchGestures'

// Existing composables (not extracted by us)
import { useSmartGuides } from '~/composables/useSmartGuides'
import { useConnectionAnimation } from '~/composables/useConnectionAnimation'
import { useVelocityTracker } from '~/composables/useVelocityTracker'
import { useViewportCompass } from '~/composables/useViewportCompass'
import { useViewportCulling } from '~/composables/useViewportCulling'

import { useMapStore } from '~/stores/mapStore'

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

export interface InfiniteCanvasProps {
  camera: Camera
  tool: CanvasTool
}

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

// ---------------------------------------------------------------------------
// Refs
// ---------------------------------------------------------------------------

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)

// ---------------------------------------------------------------------------
// Store & Platform
// ---------------------------------------------------------------------------

const mapStore = useMapStore()
const { isMobile } = usePlatform()

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const theme = useCanvasTheme()

// ---------------------------------------------------------------------------
// External composables (not extracted by us)
// ---------------------------------------------------------------------------

const smartGuides = useSmartGuides()
const connectionAnim = useConnectionAnimation()
const panVelocity = useVelocityTracker()
const viewportCompass = useViewportCompass()
const culling = useViewportCulling()

// ---------------------------------------------------------------------------
// Injected from page
// ---------------------------------------------------------------------------

const nodeAnimations = inject<NodeAnimationsAPI | null>('nodeAnimations', null)
const edgeAnimations = inject<ReturnType<typeof useEdgeAnimations> | null>('edgeAnimations', null)
const mapRegions = inject<Ref<Array<{ label: string; centerX: number; centerY: number }>> | null>('mapRegions', null)

// Spatial HUD is rendered as a Vue overlay (SpatialHUDOverlay.vue) — inject retained for type compat
inject<ReturnType<typeof useSpatialHUD> | null>('spatialHUD', null)

// ---------------------------------------------------------------------------
// Visual state refs (exposed to parent)
// ---------------------------------------------------------------------------

const aiSuggestionNodeIds = ref<Set<string>>(new Set())
const highlightedNodeIds = ref<Set<string>>(new Set())
const dimmedNodeIds = ref<Set<string>>(new Set())

// ---------------------------------------------------------------------------
// Sub-composable wiring
// ---------------------------------------------------------------------------

const editing = useNodeEditing({
  select: (ids, eids) => mapStore.select(ids, eids),
  updateNode: (id, u) => mapStore.updateNode(id, u),
})

const boxSelection = useBoxSelection()

// Standalone hoveredNodeId ref — shared between connection tool & interaction
// (breaks the circular dep: connection reads it, interaction writes it)
const hoveredNodeId = ref<string | null>(null)

const connection = useConnectionTool({
  nodes: mapStore.nodes,
  edges: mapStore.edges,
  rootNodeId: mapStore.rootNodeId,
  hoveredNodeId,
  tool: computed(() => props.tool),
})

const drag = useDragInteraction({
  nodes: mapStore.nodes,
  selectedNodeIds: mapStore.selection.nodeIds,
  moveNode: mapStore.moveNode,
  beginMoveNodes: mapStore.beginMoveNodes,
  commitMoveNodes: mapStore.commitMoveNodes,
  bumpNodesVersion: () => { /* moveNode already bumps; extra bump for minimap reactivity */ },
})

const interaction = useCanvasInteraction({
  camera: computed(() => props.camera),
  tool: computed(() => props.tool),
  containerRef,

  // Store data (getters)
  nodes: () => mapStore.nodes,
  edges: () => mapStore.edges,
  selection: () => mapStore.selection,
  rootNodeId: () => mapStore.rootNodeId,

  // Store actions
  select: (nids, eids) => mapStore.select(nids, eids),
  addToSelection: (nids, eids) => mapStore.addToSelection(nids, eids),
  clearSelection: () => mapStore.clearSelection(),
  addNode: (partial) => mapStore.addNode(partial),
  addEdge: (src, tgt, style, sa, ta) => mapStore.addEdge(src, tgt, style, sa, ta),
  deleteEdge: (id) => mapStore.deleteEdge(id),
  deleteSelected: () => mapStore.deleteSelected(),

  // Sub-composables
  drag,
  connection,
  boxSelection,
  editing,

  // External composables
  smartGuides,
  panVelocity,
  connectionAnim,
  edgeAnimations,

  // Callbacks
  emitCamera: (cam) => emit('update:camera', cam),
  emitPanEnd: (vel) => emit('pan-end', vel),
  emitContextMenu: (ev) => emit('contextmenu', ev),
  emitDropCategory: (ev) => emit('drop-category', ev as any),
  emitDropNode: (ev) => emit('drop-node', ev),

  isMobile: isMobile.value,
  markCullingDirty: () => renderLoop.markCullingDirty(),
})

// Sync the standalone hoveredNodeId ref with interaction's internal one
watchEffect(() => {
  hoveredNodeId.value = interaction.hoveredNodeId.value
})

const touch = useTouchGestures({
  camera: props.camera,
  emitCamera: (cam) => emit('update:camera', cam),
  pendingDrag: drag.pendingDrag,
  isDragging: drag.isDragging,
  isPanning: interaction.isPanning,
})

// ---------------------------------------------------------------------------
// getNodeState
// ---------------------------------------------------------------------------

function getNodeState(node: Node): NodeState {
  if (dimmedNodeIds.value.has(node.id)) return 'dimmed'
  if (drag.isDragging.value && mapStore.selection.nodeIds.has(node.id)) return 'dragging'
  if (mapStore.selection.nodeIds.has(node.id)) return 'selected'
  if (aiSuggestionNodeIds.value.has(node.id)) return 'ai-suggestion'
  if (highlightedNodeIds.value.has(node.id)) return 'highlighted'
  if (interaction.hoveredNodeId.value === node.id) return 'hover'
  return 'normal'
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

const renderLoop = useRenderLoop({
  canvasRef,
  containerRef,
  camera: computed(() => props.camera),
  colors: theme.colors,
  isLight: theme.isLight,

  // Data sources
  nodes: () => mapStore.nodes,
  edges: () => mapStore.edges,
  settings: () => mapStore.settings,
  selection: () => mapStore.selection,
  rootNodeId: () => mapStore.rootNodeId,

  // Interaction state
  isDragging: drag.isDragging,
  isPanning: interaction.isPanning,
  isConnecting: connection.isConnecting,
  hoveredNodeId: interaction.hoveredNodeId,
  editingNodeId: () => editing.editingNode.value?.id ?? null,

  // Visual state
  aiSuggestionNodeIds,
  highlightedNodeIds,
  dimmedNodeIds,

  // Box selection
  getBoxRect: () => boxSelection.getBoxRect(),
  getNodesInBox: (nodes) => boxSelection.getNodesInBox(nodes),

  // Connection preview
  connectionSourceNode: connection.connectionSourceNode,
  connectionPreviewEnd: connection.connectionPreviewEnd,
  connectionSourceAnchor: connection.connectionSourceAnchor,
  connectionSnapTarget: connection.connectionSnapTarget,
  visibleAnchors: connection.visibleAnchors,

  // Composables
  nodeAnimations,
  edgeAnimations,
  connectionAnim,
  culling,
  viewportCompass,
  smartGuides,

  // Map regions
  mapRegions,

  // Node state callback
  getNodeState,
})

// Track node count changes to rebuild spatial index
watch(() => mapStore.nodes.size, () => { renderLoop.markCullingDirty() })

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

// Emit node-hover when hoveredNodeId changes
watch(interaction.hoveredNodeId, (nodeId) => {
  if (nodeId) {
    const node = mapStore.nodes.get(nodeId)
    if (node) {
      const sp = worldToScreen(node.position.x + node.size.width / 2, node.position.y, props.camera)
      emit('node-hover', { nodeId, screenPosition: sp })
    }
  } else {
    emit('node-hover', { nodeId: null, screenPosition: { x: 0, y: 0 } })
  }
})

// Clear anchors when switching away from connect tool
watch(() => props.tool, (newTool, oldTool) => {
  if (oldTool === 'connect' && newTool !== 'connect') {
    connection.visibleAnchors.value.clear()
    connection.connectionSnapTarget.value = null
  }
})

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

onKeyStroke('Delete', (e) => {
  if (!editing.editingNode.value) { e.preventDefault(); mapStore.deleteSelected() }
})

onKeyStroke('Backspace', (e) => {
  if (!editing.editingNode.value && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mapStore.deleteSelected() }
})

onKeyStroke('a', (e) => {
  if ((e.ctrlKey || e.metaKey) && !editing.editingNode.value) { e.preventDefault(); mapStore.selectAll() }
})

onKeyStroke('d', (e) => {
  if ((e.ctrlKey || e.metaKey) && !editing.editingNode.value) { e.preventDefault(); mapStore.duplicateSelected() }
})

onKeyStroke('z', (e) => {
  if ((e.ctrlKey || e.metaKey) && !editing.editingNode.value) {
    e.preventDefault()
    e.shiftKey ? mapStore.redo() : mapStore.undo()
  }
})

onKeyStroke('Escape', () => {
  if (editing.editingNode.value) editing.cancelNodeEdit()
})

// ---------------------------------------------------------------------------
// Cursor style
// ---------------------------------------------------------------------------

const cursorStyle = computed(() => {
  switch (props.tool) {
    case 'pan': return 'cursor-grab'
    case 'node': return 'cursor-crosshair'
    case 'connect': return 'cursor-crosshair'
    default: return 'cursor-default'
  }
})

// ---------------------------------------------------------------------------
// Expose (same surface area as before)
// ---------------------------------------------------------------------------

defineExpose({
  containerRef,
  canvasRef,
  hoveredNodeId: interaction.hoveredNodeId,
  isDragOver: interaction.isDragOver,
  aiSuggestionNodeIds,
  highlightedNodeIds,
  dimmedNodeIds,
  screenToWorld: (sx: number, sy: number) => screenToWorld(sx, sy, props.camera),
  worldToScreen: (wx: number, wy: number) => worldToScreen(wx, wy, props.camera),
  findNodeAtPosition: (pos: Point) => findNodeAtPosition(pos, mapStore.nodes),
})
</script>

<template>
  <div
    ref="containerRef"
    :class="['relative w-full h-full overflow-hidden select-none', cursorStyle]"
    style="touch-action: none"
    tabindex="0"
    @pointerdown="interaction.handlePointerDown"
    @pointermove="interaction.handlePointerMove"
    @pointerup="interaction.handlePointerUp"
    @pointercancel="interaction.handlePointerUp"
    @dblclick="interaction.handleDoubleClick"
    @touchstart="touch.handleTouchStart"
    @touchmove="touch.handleTouchMove"
    @touchend="touch.handleTouchEnd"
    @contextmenu="interaction.handleContextMenu"
    @dragover="interaction.handleDragOver"
    @dragleave="interaction.handleDragLeave"
    @drop="interaction.handleDrop"
  >
    <!-- Main canvas -->
    <canvas
      ref="canvasRef"
      class="absolute inset-0"
    />

    <!-- Semantic Field Layer -->
    <CanvasSemanticFieldLayer :camera="camera" />

    <!-- DOM overlay for editable nodes -->
    <div
      ref="overlayRef"
      class="absolute inset-0 pointer-events-none"
    >
      <NodeEditor
        v-if="editing.editingNode.value"
        :node="editing.editingNode.value"
        :camera="camera"
        @save="editing.saveNodeEdit"
        @cancel="editing.cancelNodeEdit"
      />
    </div>
  </div>
</template>
