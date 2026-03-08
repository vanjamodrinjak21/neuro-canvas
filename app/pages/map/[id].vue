<script setup lang="ts">
import type { Camera, Node, Edge, Point } from '~/types/canvas'
import type { NodeTemplate } from '~/components/canvas/NodeTemplates.vue'
import type { ContextMenuItem } from '~/components/ui/NcContextMenu.vue'
import type { AISuggestion, RichNodeSuggestion, GenerationContext } from '~/types'
import type { SidebarAction } from '~/types/sidebar'
import { useMapStore } from '~/stores/mapStore'
import { useSemanticStore } from '~/stores/semanticStore'
import { useDatabase } from '~/composables/useDatabase'
import { useAutoSave } from '~/composables/useAutoSave'
import { useAI } from '~/composables/useAI'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useSpringCamera } from '~/composables/useSpringCamera'
import { useSmoothZoom } from '~/composables/useSmoothZoom'
import { useNodeAnimations } from '~/composables/useNodeAnimations'
import { useCameraIntelligence } from '~/composables/useCameraIntelligence'
import { useMapRegions } from '~/composables/useMapRegions'
import { useViewportCulling } from '~/composables/useViewportCulling'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { useEdgeAnimations } from '~/composables/useEdgeAnimations'
import { useSpatialHUD } from '~/composables/useSpatialHUD'

// Route
const route = useRoute()
const router = useRouter()
const mapId = computed(() => route.params.id as string)

// Stores
const mapStore = useMapStore()
const semanticStore = useSemanticStore()
const db = useDatabase()
const autoSave = useAutoSave()
const ai = useAI()
const mapRenderer = useMapRenderer()

// Loading
const isLoading = ref(true)
const loadError = ref<string | null>(null)

// Reduced motion detection
const { isReduced: reducedMotion } = useReducedMotion()

// Spring camera system
const springCamera = useSpringCamera({ x: 0, y: 0, zoom: 1 })
const camera = springCamera.camera
const smoothZoom = useSmoothZoom(springCamera)

// Node animation system
const nodeAnim = useNodeAnimations()
provide('nodeAnimations', nodeAnim)

// Edge animations
const edgeAnim = useEdgeAnimations()
provide('edgeAnimations', edgeAnim)

// Spatial HUD
const spatialHUD = useSpatialHUD()
provide('spatialHUD', spatialHUD)

// Wire reduced motion to all animation composables
watch(reducedMotion, (val) => {
  springCamera.setReducedMotion(val)
  smoothZoom.setReducedMotion(val)
  nodeAnim.setReducedMotion(val)
  edgeAnim.setReducedMotion(val)
}, { immediate: true })

// Map regions for minimap
const mapRegions = useMapRegions()
provide('mapRegions', mapRegions.regions)

// Viewport culling (spatial index)
const viewportCulling = useViewportCulling()

// Camera intelligence
const cameraIntel = useCameraIntelligence(
  springCamera,
  () => mapStore.nodes,
  () => mapStore.selection.nodeIds,
  nodeAnim
)

// Tools - now includes 'connect' for connection tool
const activeTool = ref<'select' | 'pan' | 'node' | 'connect'>('select')

// Title editing
const isEditingTitle = ref(false)
const editedTitle = ref('')
const topBarRef = ref<{ focusTitleInput: () => void } | null>(null)

// Panels
const showTemplates = ref(false)
const templatePosition = ref<Point | null>(null)
const showPropertiesPanel = ref(false)
const showShortcutsModal = ref(false)
const showBacklinksPanel = ref(false)

// Selected node
const selectedNode = computed(() => {
  if (mapStore.selection.nodeIds.size === 1) {
    const nodeId = Array.from(mapStore.selection.nodeIds)[0]
    return nodeId ? mapStore.nodes.get(nodeId) ?? null : null
  }
  return null
})

watch(selectedNode, (node) => {
  showPropertiesPanel.value = !!node
})

// Context menu
const contextMenuVisible = ref(false)
const contextMenuPosition = ref<Point>({ x: 0, y: 0 })
const contextMenuTargetNode = ref<Node | null>(null)
const contextMenuTargetEdge = ref<Edge | null>(null)

// AI
const isAILoading = ref(false)
const aiSuggestions = ref<AISuggestion[]>([])
const richSuggestions = ref<RichNodeSuggestion[]>([])

// Map generation dialog
const showGenerateMapDialog = ref(false)

// Overflow menu (managed by OverflowMenu component internally)

// Sidebar visibility (desktop always visible, mobile as sheet)
const isMobile = ref(false)
const showSidebarSheet = ref(false)
const sidebarCollapsed = ref(false)

// Zoom presets (managed by ZoomControls component internally)

// Minimap: always visible on desktop (no toggle)

// Semantic field visibility (toggle with S key)
const semanticFieldEnabled = computed({
  get: () => semanticStore.fieldSettings.enabled,
  set: (val) => semanticStore.toggleField(val)
})

// Canvas ref for highlighting and wheel listener
const canvasRef = ref<{ containerRef: HTMLDivElement | null; isDragOver: boolean; highlightedNodeIds: Set<string>; dimmedNodeIds: Set<string> } | null>(null)

// Canvas container dimensions for minimap viewport calculation
const canvasContainerWidth = ref(0)
const canvasContainerHeight = ref(0)

// Load map
onMounted(async () => {
  document.body.classList.add('canvas-page')

  try {
    if (mapId.value === 'new') {
      mapStore.newDocument()
      isLoading.value = false
      autoSave.start()
      // Set up semantic store for new map
      semanticStore.setCurrentMap(mapStore.id)
      // Initialize AI in background
      ai.initialize()
      return
    }

    const map = await db.getMap(mapId.value)
    if (map) {
      mapStore.fromSerializable(map)
      springCamera.setCurrent(map.camera)
    } else {
      mapStore.newDocument()
    }
    isLoading.value = false
    autoSave.start()

    // Set up semantic store
    semanticStore.setCurrentMap(mapStore.id)

    // Initialize AI in background
    ai.initialize()

    // Trigger edge entrance animations on map load
    if (mapStore.edges.size > 0) {
      edgeAnim.triggerEntranceAll(mapStore.edges, 30)
    }

    // Compute initial regions
    mapRegions.scheduleRecompute(mapStore.nodes)

    // Mark all existing nodes as dirty for initial embedding
    const nodeIds = Array.from(mapStore.nodes.keys())
    semanticStore.markDirtyBatch(nodeIds)

    // Process embeddings after a short delay
    setTimeout(() => {
      ai.processQueue(
        (nodeId) => mapStore.nodes.get(nodeId)?.content,
        semanticStore.fieldSettings.similarityThreshold
      )
    }, 1000)
  } catch (error) {
    loadError.value = 'Failed to load map'
    console.error('Failed to load map:', error)
    isLoading.value = false
  }
})

// Attach non-passive wheel listener for smooth zoom (must be non-passive to preventDefault)
let wheelCleanup: (() => void) | null = null

watch(canvasRef, (ref) => {
  // Clean up old listener
  if (wheelCleanup) {
    wheelCleanup()
    wheelCleanup = null
  }
  if (ref?.containerRef) {
    const el = ref.containerRef
    const rect = el.getBoundingClientRect()
    smoothZoom.setContainerRect(rect)
    canvasContainerWidth.value = rect.width
    canvasContainerHeight.value = rect.height
    el.addEventListener('wheel', smoothZoom.handleWheel, { passive: false })
    wheelCleanup = () => el.removeEventListener('wheel', smoothZoom.handleWheel)

    // Update rect on resize + track container dims for minimap
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      smoothZoom.setContainerRect(r)
      canvasContainerWidth.value = r.width
      canvasContainerHeight.value = r.height
    })
    ro.observe(el)
    const oldCleanup = wheelCleanup
    wheelCleanup = () => {
      oldCleanup()
      ro.disconnect()
    }
  }
}, { immediate: true })

onUnmounted(() => {
  autoSave.stop()
  if (wheelCleanup) wheelCleanup()
  document.body.classList.remove('canvas-page')
})

onBeforeUnmount(async () => {
  if (mapStore.isDirty) {
    await autoSave.save()
  }
})

// Actions
async function handleSave() {
  await autoSave.save()
}

function startEditingTitle() {
  editedTitle.value = mapStore.title as unknown as string
  isEditingTitle.value = true
  topBarRef.value?.focusTitleInput()
}

function saveTitle() {
  if (editedTitle.value.trim()) {
    mapStore.setTitle(editedTitle.value.trim())
  }
  isEditingTitle.value = false
}

function cancelEditTitle() {
  isEditingTitle.value = false
}

// Check mobile on mount
onMounted(() => {
  isMobile.value = window.innerWidth < 768
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < 768
  })
})

// Keyboard shortcuts
onKeyStroke('v', () => activeTool.value = 'select')
onKeyStroke('h', () => activeTool.value = 'pan')
onKeyStroke('n', () => activeTool.value = 'node')
onKeyStroke('c', () => activeTool.value = 'connect')
onKeyStroke('t', () => showTemplates.value = !showTemplates.value)
onKeyStroke('Escape', () => {
  activeTool.value = 'select'
  showTemplates.value = false
  contextMenuVisible.value = false
  showShortcutsModal.value = false
  if (isEditingTitle.value) cancelEditTitle()
})
onKeyStroke('s', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    handleSave()
  }
})
onKeyStroke('?', () => showShortcutsModal.value = !showShortcutsModal.value)
onKeyStroke('g', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    mapStore.openGraphView()
  }
})
onKeyStroke('b', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    showBacklinksPanel.value = !showBacklinksPanel.value
  }
})
// M key: minimap is now always visible, no toggle needed

// Keyboard camera navigation
onKeyStroke('ArrowLeft', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ x: camera.value.x + 200 }, 'snappy')
  }
})
onKeyStroke('ArrowRight', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ x: camera.value.x - 200 }, 'snappy')
  }
})
onKeyStroke('ArrowUp', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ y: camera.value.y + 200 }, 'snappy')
  }
})
onKeyStroke('ArrowDown', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ y: camera.value.y - 200 }, 'snappy')
  }
})
onKeyStroke('=', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    zoomIn()
  }
})
onKeyStroke('-', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    zoomOut()
  }
})
onKeyStroke('0', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    fitToContent()
  }
})
onKeyStroke('1', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    resetZoom()
  }
})
onKeyStroke('Tab', (e) => {
  e.preventDefault()
  const nodeId = cameraIntel.cycleNode(e.shiftKey ? 'prev' : 'next')
  if (nodeId) mapStore.select([nodeId])
})
onKeyStroke('Home', (e) => {
  e.preventDefault()
  const nodeId = cameraIntel.flyToRoot()
  if (nodeId) mapStore.select([nodeId])
})
onKeyStroke('f', (e) => {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    cameraIntel.flyToSelection()
  }
})
onKeyStroke('Backspace', (e) => {
  // Only navigate back if no editing is active and no selection to delete
  if (!e.ctrlKey && !e.metaKey && mapStore.selection.nodeIds.size === 0 && mapStore.selection.edgeIds.size === 0) {
    cameraIntel.goBack()
  }
})
onKeyStroke('s', (e) => {
  // S without modifier toggles semantic field
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    semanticStore.toggleField()
  }
}, { eventName: 'keyup' })
onKeyStroke('\\', () => sidebarCollapsed.value = !sidebarCollapsed.value)

// Context menu
function handleCanvasContextMenu(event: { node: Node | null; edge: Edge | null; position: Point; screenPosition: Point }) {
  contextMenuTargetNode.value = event.node
  contextMenuTargetEdge.value = event.edge
  contextMenuPosition.value = event.screenPosition
  contextMenuVisible.value = true
}

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = []
  if (contextMenuTargetNode.value) {
    items.push(
      { label: 'Edit', icon: 'i-lucide-edit-2', shortcut: 'Enter', action: () => handleEditNode() },
      { label: 'Copy', icon: 'i-lucide-copy', shortcut: '⌘C', action: () => handleCopyNode() },
      { type: 'separator' },
      {
        label: 'Change color',
        icon: 'i-lucide-palette',
        children: [
          { label: 'Teal', icon: 'i-lucide-circle', action: () => changeNodeColor('#00D2BE') },
          { label: 'Purple', icon: 'i-lucide-circle', action: () => changeNodeColor('#A78BFA') },
          { label: 'Pink', icon: 'i-lucide-circle', action: () => changeNodeColor('#F472B6') },
          { label: 'Blue', icon: 'i-lucide-circle', action: () => changeNodeColor('#60A5FA') },
          { label: 'Green', icon: 'i-lucide-circle', action: () => changeNodeColor('#4ADE80') }
        ]
      },
      { label: 'Smart Expand', icon: 'i-lucide-sparkles', action: () => handleSmartExpand() },
      { label: 'View Backlinks', icon: 'i-lucide-link', shortcut: '⌘B', action: () => handleViewBacklinks() },
      { label: 'Open Local Graph', icon: 'i-lucide-git-branch', action: () => handleOpenLocalGraph() },
      { type: 'separator' },
      { label: 'Delete', icon: 'i-lucide-trash-2', shortcut: 'Del', danger: true, action: () => handleDeleteNode() }
    )
  } else if (contextMenuTargetEdge.value) {
    // Edge context menu
    items.push(
      { label: 'Disconnect', icon: 'i-lucide-unlink', shortcut: 'Del', action: () => handleDisconnect() },
      { type: 'separator' },
      { label: 'Delete Connection', icon: 'i-lucide-trash-2', danger: true, action: () => handleDisconnect() }
    )
  } else {
    items.push(
      { label: 'Add Node', icon: 'i-lucide-plus', shortcut: 'N', action: () => handleAddNode() },
      { label: 'Templates', icon: 'i-lucide-layout-template', shortcut: 'T', action: () => showTemplates.value = true },
      { type: 'separator' },
      { label: 'Paste', icon: 'i-lucide-clipboard', shortcut: '⌘V', disabled: true }
    )
  }
  return items
})

function handleEditNode() {
  if (contextMenuTargetNode.value) mapStore.select([contextMenuTargetNode.value.id])
  contextMenuVisible.value = false
}

function handleCopyNode() {
  contextMenuVisible.value = false
}

function changeNodeColor(color: string) {
  if (contextMenuTargetNode.value) {
    mapStore.updateNode(contextMenuTargetNode.value.id, {
      style: { ...contextMenuTargetNode.value.style, borderColor: color }
    })
  }
  contextMenuVisible.value = false
}

function handleDeleteNode() {
  if (contextMenuTargetNode.value) {
    const node = contextMenuTargetNode.value
    // Snapshot for exit animation before deleting
    nodeAnim.exitNode(node.id, {
      position: { ...node.position },
      size: { ...node.size },
      content: node.content,
      style: { ...node.style }
    })
    mapStore.deleteNode(node.id)
  }
  contextMenuVisible.value = false
}

function handleDisconnect() {
  if (contextMenuTargetEdge.value) mapStore.deleteEdge(contextMenuTargetEdge.value.id)
  contextMenuVisible.value = false
}

function handleViewBacklinks() {
  if (contextMenuTargetNode.value) {
    mapStore.select([contextMenuTargetNode.value.id])
    showBacklinksPanel.value = true
  }
  contextMenuVisible.value = false
}

function handleOpenLocalGraph() {
  if (contextMenuTargetNode.value) {
    mapStore.openLocalGraph(contextMenuTargetNode.value.id)
  }
  contextMenuVisible.value = false
}

function handleNavigateToNode(nodeId: string) {
  cameraIntel.flyToNode(nodeId, { preset: 'snappy', pulse: true })
  mapStore.select([nodeId])
}

function handleAddNode() {
  mapStore.addNode({ position: { x: 100, y: 100 }, content: 'New Node' })
  contextMenuVisible.value = false
}

async function handleSmartExpand() {
  const node = contextMenuTargetNode.value || selectedNode.value
  if (!node) return

  isAILoading.value = true
  contextMenuVisible.value = false

  try {
    // Build rich generation context
    const context: GenerationContext = {
      mapTitle: mapStore.title as string,
      existingNodes: Array.from(mapStore.nodes.values())
        .filter(n => n.id !== node.id)
        .slice(0, 10)
        .map(n => ({
          id: n.id,
          content: n.content,
          description: n.metadata?.description as { summary: string } | undefined
        })),
      existingEdges: Array.from(mapStore.edges.values()).map(e => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        label: e.label
      })),
      depth: 'medium',
      style: 'detailed'
    }

    // Try enhanced expand first
    try {
      const suggestions = await ai.enhancedSmartExpand(node.content, context, 5)
      richSuggestions.value = suggestions
      aiSuggestions.value = [] // Clear legacy suggestions

      // Optionally auto-add the suggestions (or let user choose from sidebar)
      // For context menu, we auto-add them
      if (contextMenuTargetNode.value) {
        const result = mapRenderer.renderRichSuggestions(suggestions, node, { layout: 'vertical', spacing: 80 })
        // Trigger batch enter animation for AI-generated nodes
        if (result?.nodeIds) {
          nodeAnim.enterNodesBatch(result.nodeIds, 60, 'ai')
        }
        richSuggestions.value = []
      }
    } catch (enhancedError) {
      console.warn('Enhanced expand failed, falling back to basic:', enhancedError)
      // Fall back to basic expand
      const basicContext = Array.from(mapStore.nodes.values())
        .filter(n => n.id !== node.id)
        .slice(0, 5)
        .map(n => n.content)

      const suggestions = await ai.smartExpand(node.content, basicContext, 3)
      const baseX = node.position.x + node.size.width + 50
      let offsetY = 0
      const newIds: string[] = []

      for (const suggestion of suggestions) {
        const newNode = mapStore.addNode({
          position: { x: baseX, y: node.position.y + offsetY },
          content: suggestion,
          style: { ...node.style, borderColor: '#00D2BE' }
        })
        newIds.push(newNode.id)
        offsetY += newNode.size.height + 20
      }
      mapStore.resolveOverlaps(newIds)
    }
  } catch (error) {
    console.error('Smart Expand failed:', error)
  } finally {
    isAILoading.value = false
  }
}

function handleTemplateSelect(template: NodeTemplate) {
  const node = mapStore.addNode({
    position: templatePosition.value || { x: 200, y: 200 },
    content: template.name,
    style: {
      shape: template.shape,
      fillColor: template.fillColor,
      borderColor: template.borderColor,
      textColor: template.textColor,
      fontSize: 14,
      fontWeight: 500,
      borderWidth: 2,
      shadowEnabled: true,
      glowEnabled: false
    }
  })
  mapStore.select([node.id])
  showTemplates.value = false
}

// Zoom — spring-based
function zoomIn() {
  springCamera.setTarget({ zoom: Math.min(camera.value.zoom * 1.2, 4) }, 'snappy')
}

function zoomOut() {
  springCamera.setTarget({ zoom: Math.max(camera.value.zoom / 1.2, 0.15) }, 'snappy')
}

function fitToContent() {
  cameraIntel.fitToContent(80)
}

function setZoom(value: number) {
  springCamera.setTarget({ zoom: Math.max(0.15, Math.min(4, value)) }, 'snappy')
}

function resetZoom() {
  springCamera.setTarget({ zoom: 1 }, 'snappy')
}

// Handle zoom slider — instant for direct manipulation
function handleZoomSlider(event: Event) {
  const target = event.target as HTMLInputElement
  springCamera.setCurrent({ ...camera.value, zoom: parseFloat(target.value) })
}

// Sidebar actions
function handleAddNodeFromSidebar() {
  // Get existing nodes count for offset positioning
  const nodeCount = mapStore.nodes.size
  const offsetX = (nodeCount % 5) * 180
  const offsetY = Math.floor(nodeCount / 5) * 80

  // Add node at visible position
  const node = mapStore.addNode({
    position: { x: 100 + offsetX, y: 100 + offsetY },
    content: 'New Node'
  })
  mapStore.select([node.id])

  // Navigate camera to show the new node
  springCamera.setTarget({
    x: -node.position.x + 400,
    y: -node.position.y + 300
  }, 'snappy')
}

function handleAddCategorizedNode(category: { id: string; label: string; color: string }) {
  // Get existing nodes count for offset positioning
  const nodeCount = mapStore.nodes.size
  const offsetX = (nodeCount % 5) * 180
  const offsetY = Math.floor(nodeCount / 5) * 80

  // Add node at visible position with category
  const node = mapStore.addNode({
    position: { x: 100 + offsetX, y: 100 + offsetY },
    content: category.label,
    style: { borderColor: category.color },
    metadata: { category: category.id }
  })
  mapStore.select([node.id])

  // Navigate camera to show the new node
  springCamera.setTarget({
    x: -node.position.x + 400,
    y: -node.position.y + 300
  }, 'snappy')
}

function handleToggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function handleSidebarAction(action: SidebarAction) {
  switch (action.type) {
    case 'nav:navigate-to-node':
      handleNavigateToNode(action.nodeId)
      break
    case 'nav:toggle-sidebar':
      handleToggleSidebar()
      showSidebarSheet.value = false
      break
    case 'node:add':
      handleAddNodeFromSidebar()
      break
    case 'node:add-categorized':
      handleAddCategorizedNode(action.category)
      break
    case 'node:duplicate':
      handleDuplicateFromSidebar()
      break
    case 'node:delete':
      if (selectedNode.value) mapStore.deleteNode(selectedNode.value.id)
      break
    case 'ai:smart-expand':
      handleGenerateSuggestions()
      break
    case 'ai:deep-expand':
      handleDeepExpand()
      break
    case 'ai:add-suggestion':
      handleAddSuggestion(action.suggestion)
      break
    case 'ai:add-rich-suggestion':
      handleAddRichSuggestion(action.suggestion)
      break
    case 'ai:generate-map':
      showGenerateMapDialog.value = true
      break
    case 'ai:generate-description':
      handleGenerateDescription()
      break
    case 'insight:add-node':
      // insight node handled by InsightPanel internally
      break
    case 'insight:highlight-nodes':
      handleHighlightNodes(action.nodeIds)
      break
    case 'insight:clear-highlights':
      handleClearHighlights()
      break
    case 'agent:apply-action':
      // Agent actions handled when agent panel is implemented
      break
    case 'drag:start-category':
      // Drag state managed by browser drag events
      break
    case 'drag:start-node':
      // Drag state managed by browser drag events
      break
  }
}

function handleDuplicateFromSidebar() {
  mapStore.duplicateSelected()
}

function handleDropCategory(event: { category: { id: string; label: string; color: string }; position: { x: number; y: number } }) {
  const node = mapStore.addNode({
    position: { x: event.position.x - 75, y: event.position.y - 25 },
    content: event.category.label,
    style: { borderColor: event.category.color },
    metadata: { category: event.category.id }
  })
  mapStore.select([node.id])
}

function handleDropNode(event: { nodeId: string; position: { x: number; y: number } }) {
  // Move the existing node to the new position
  mapStore.moveNode(event.nodeId, event.position.x - 75, event.position.y - 25)
  mapStore.select([event.nodeId])
}

async function handleGenerateSuggestions() {
  const node = selectedNode.value
  if (!node) return

  isAILoading.value = true
  aiSuggestions.value = []
  richSuggestions.value = []

  try {
    // Build rich generation context
    const context: GenerationContext = {
      mapTitle: mapStore.title as string,
      existingNodes: Array.from(mapStore.nodes.values())
        .filter(n => n.id !== node.id)
        .slice(0, 10)
        .map(n => ({
          id: n.id,
          content: n.content,
          description: n.metadata?.description as { summary: string } | undefined
        })),
      existingEdges: Array.from(mapStore.edges.values()).map(e => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        label: e.label
      })),
      depth: 'medium',
      style: 'detailed'
    }

    // Try enhanced expand
    try {
      const suggestions = await ai.enhancedSmartExpand(node.content, context, 5)
      richSuggestions.value = suggestions
    } catch (enhancedError) {
      console.warn('Enhanced expand failed, falling back to basic:', enhancedError)
      // Fall back to basic expand
      const basicContext = Array.from(mapStore.nodes.values())
        .filter(n => n.id !== node.id)
        .slice(0, 5)
        .map(n => n.content)

      const suggestions = await ai.smartExpand(node.content, basicContext, 5)
      aiSuggestions.value = suggestions.map((content, index) => ({
        id: `suggestion-${index}`,
        type: 'expand' as const,
        content,
        confidence: 0.8
      }))
    }
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
  } finally {
    isAILoading.value = false
  }
}

function handleAddSuggestion(suggestion: AISuggestion) {
  const node = selectedNode.value
  if (!node) return

  // Add the suggestion as a new node connected to the selected node
  const newNode = mapStore.addNode({
    position: {
      x: node.position.x + node.size.width + 50,
      y: node.position.y + (aiSuggestions.value.indexOf(suggestion) * (node.size.height + 20))
    },
    content: suggestion.content,
    style: { ...node.style, borderColor: '#00D2BE' }
  })
  mapStore.resolveOverlaps([newNode.id])

  // Create edge from selected node to new node
  mapStore.addEdge(node.id, newNode.id)

  // Remove suggestion from list
  aiSuggestions.value = aiSuggestions.value.filter(s => s.id !== suggestion.id)

  // Mark new node as dirty for embedding
  semanticStore.markDirty(newNode.id)
  ai.processQueue(
    (nodeId) => mapStore.nodes.get(nodeId)?.content,
    semanticStore.fieldSettings.similarityThreshold
  )
}

function handleAddRichSuggestion(suggestion: RichNodeSuggestion) {
  const node = selectedNode.value
  if (!node) return

  // Calculate position based on existing suggestions
  const index = richSuggestions.value.indexOf(suggestion)
  const position = mapRenderer.calculateSuggestionPosition(node, index >= 0 ? index : 0)

  // Add the rich suggestion using map renderer
  const { nodeId } = mapRenderer.addRichSuggestion(suggestion, node, position)

  // Remove suggestion from list
  richSuggestions.value = richSuggestions.value.filter(s => s !== suggestion)

  // Mark new node as dirty for embedding
  semanticStore.markDirty(nodeId)
  ai.processQueue(
    (nId) => mapStore.nodes.get(nId)?.content,
    semanticStore.fieldSettings.similarityThreshold
  )
}

async function handleDeepExpand() {
  const node = selectedNode.value
  if (!node) return

  isAILoading.value = true
  richSuggestions.value = []

  try {
    // Build rich generation context
    const context: GenerationContext = {
      mapTitle: mapStore.title as string,
      existingNodes: Array.from(mapStore.nodes.values())
        .filter(n => n.id !== node.id)
        .slice(0, 10)
        .map(n => ({
          id: n.id,
          content: n.content,
          description: n.metadata?.description as { summary: string } | undefined
        })),
      existingEdges: Array.from(mapStore.edges.values()).map(e => ({
        sourceId: e.sourceId,
        targetId: e.targetId,
        label: e.label
      })),
      depth: 'deep',
      style: 'detailed'
    }

    const suggestions = await ai.hierarchicalExpand(node.content, context, {
      depth: 2,
      maxPerLevel: 3,
      style: 'detailed'
    })

    // Render the hierarchical suggestions
    const { nodeIds } = mapRenderer.renderRichSuggestions(suggestions, node, {
      layout: 'radial',
      spacing: 80,
      includeChildren: true
    })

    // Trigger batch enter animation for AI-generated nodes
    nodeAnim.enterNodesBatch(nodeIds, 60, 'ai')

    // Mark all new nodes as dirty for embedding
    for (const nodeId of nodeIds) {
      semanticStore.markDirty(nodeId)
    }
    ai.processQueue(
      (nId) => mapStore.nodes.get(nId)?.content,
      semanticStore.fieldSettings.similarityThreshold
    )
  } catch (error) {
    console.error('Deep expand failed:', error)
  } finally {
    isAILoading.value = false
  }
}

async function handleGenerateDescription() {
  const node = selectedNode.value
  if (!node) return

  isAILoading.value = true

  try {
    // Get context nodes
    const contextNodes = Array.from(mapStore.nodes.values())
      .filter(n => n.id !== node.id)
      .slice(0, 5)
      .map(n => ({
        content: n.content,
        description: n.metadata?.description as { summary: string } | undefined
      }))

    const description = await ai.generateNodeDescription(node.content, contextNodes, 'detailed')

    // Update the node with the generated description
    mapStore.updateNode(node.id, {
      metadata: {
        ...node.metadata,
        description
      }
    })
  } catch (error) {
    console.error('Failed to generate description:', error)
  } finally {
    isAILoading.value = false
  }
}

async function handleGenerateMap(topic: string, options: { depth: string; style: string; domain?: string }) {
  isAILoading.value = true
  showGenerateMapDialog.value = false

  try {
    const depthMap: Record<string, number> = {
      shallow: 3,
      medium: 5,
      deep: 7
    }

    const structure = await ai.generateMapStructure(topic, {
      branchCount: depthMap[options.depth] || 5,
      maxDepth: options.depth === 'shallow' ? 1 : options.depth === 'deep' ? 3 : 2,
      style: options.style as 'concise' | 'detailed' | 'academic',
      includeCrossConnections: options.depth !== 'shallow',
      domain: options.domain
    })

    // Clear existing nodes if desired or render at offset
    const startPosition = { x: 0, y: 0 }
    const { nodeIds } = mapRenderer.renderMapStructure(structure, startPosition)

    // Mark all new nodes as dirty for embedding
    for (const nodeId of nodeIds) {
      semanticStore.markDirty(nodeId)
    }
    ai.processQueue(
      (nId) => mapStore.nodes.get(nId)?.content,
      semanticStore.fieldSettings.similarityThreshold
    )

    // Center camera on the new map
    springCamera.setTarget({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      zoom: 0.8
    }, 'navigation')
  } catch (error) {
    console.error('Failed to generate map:', error)
  } finally {
    isAILoading.value = false
  }
}

// Recompute regions and spatial index when nodes change
watch(() => mapStore.nodes.size, () => {
  mapRegions.scheduleRecompute(mapStore.nodes)
  viewportCulling.rebuild(mapStore.nodes)
})

// Track node set for enter/exit animations
let knownNodeIds = new Set<string>()
watch(
  () => mapStore.nodes.size,
  () => {
    const currentIds = new Set(mapStore.nodes.keys())

    // Detect newly added nodes
    for (const id of currentIds) {
      if (!knownNodeIds.has(id)) {
        nodeAnim.enterNode(id, 'user')
      }
    }

    // Detect deleted nodes — snapshot them for exit animation
    for (const id of knownNodeIds) {
      if (!currentIds.has(id)) {
        // Node was deleted — we can't snapshot it anymore since it's gone
        // Exit animations need to be triggered BEFORE deletion
        // This watcher handles the case where deletion happens without pre-snapshot
      }
    }

    knownNodeIds = currentIds
  },
  { flush: 'post' }
)

// Watch for node content changes to update embeddings
watch(
  () => Array.from(mapStore.nodes.values()).map(n => ({ id: n.id, content: n.content })),
  (newNodes, oldNodes) => {
    if (!oldNodes) return

    const oldMap = new Map(oldNodes.map(n => [n.id, n.content]))

    for (const node of newNodes) {
      const oldContent = oldMap.get(node.id)
      // If content changed or new node, mark as dirty
      if (oldContent === undefined || oldContent !== node.content) {
        semanticStore.markDirty(node.id)
      }
    }

    // Check for deleted nodes
    const newIds = new Set(newNodes.map(n => n.id))
    for (const oldNode of oldNodes) {
      if (!newIds.has(oldNode.id)) {
        semanticStore.removeNodeData(oldNode.id)
      }
    }

    // Process dirty nodes
    if (semanticStore.dirtyNodeCount > 0) {
      ai.processQueue(
        (nodeId) => mapStore.nodes.get(nodeId)?.content,
        semanticStore.fieldSettings.similarityThreshold
      )
    }
  },
  { deep: true }
)

// Handle highlight nodes from insight panel
function handleHighlightNodes(nodeIds: string[]) {
  if (canvasRef.value) {
    canvasRef.value.highlightedNodeIds = new Set(nodeIds)
  }
}

function handleClearHighlights() {
  if (canvasRef.value) {
    canvasRef.value.highlightedNodeIds = new Set()
  }
}

// Page meta
definePageMeta({
  layout: 'canvas',
  ssr: false
})

useHead({
  title: () => `${mapStore.title} - NeuroCanvas`
})
</script>

<template>
  <div class="h-screen w-screen overflow-hidden relative flex bg-nc-bg">
    <!-- ═══════════════ LEFT SIDEBAR (Desktop — UNTOUCHED) ═══════════════ -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="-translate-x-full opacity-0"
      leave-to-class="-translate-x-full opacity-0"
    >
      <div v-if="!sidebarCollapsed" class="nc-sidebar-wrapper">
        <CanvasSidebarShell
          :selected-node="selectedNode"
          :is-a-i-loading="isAILoading"
          :ai-suggestions="aiSuggestions"
          :rich-suggestions="richSuggestions"
          @action="handleSidebarAction"
        />
      </div>
    </Transition>

    <button
      v-if="sidebarCollapsed"
      class="nc-sidebar-show-btn"
      @click="handleToggleSidebar"
    >
      <span class="i-lucide-panel-left-open text-base" />
    </button>

    <!-- ═══════════════ MAIN CANVAS AREA ═══════════════ -->
    <div class="flex-1 relative">
      <!-- Canvas Background -->
      <div class="absolute inset-0 pointer-events-none z-0">
        <div class="nc-canvas-grid absolute inset-0" />
      </div>

      <!-- Overlays (loading, error, drop zone) -->
      <CanvasCanvasOverlay
        :loading="isLoading"
        :error="loadError"
        :is-drag-over="canvasRef?.isDragOver ?? false"
      />

      <!-- Canvas -->
      <CanvasInfiniteCanvas
        v-if="!isLoading && !loadError"
        ref="canvasRef"
        :camera="camera"
        :tool="activeTool"
        class="absolute inset-0"
        @update:camera="springCamera.setCurrent($event)"
        @pan-end="(v: { vx: number; vy: number }) => springCamera.addVelocity(v.vx, v.vy)"
        @contextmenu="handleCanvasContextMenu"
        @drop-category="handleDropCategory"
        @drop-node="handleDropNode"
      />

      <!-- Top Bar -->
      <CanvasTopBar
        ref="topBarRef"
        :is-editing-title="isEditingTitle"
        :edited-title="editedTitle"
        :is-a-i-loading="isAILoading"
        :has-selection="!!selectedNode"
        @start-editing="startEditingTitle"
        @save-title="saveTitle"
        @cancel-edit="cancelEditTitle"
        @title-input="editedTitle = $event"
        @smart-expand="handleSmartExpand"
        @save="handleSave"
        @open-shortcuts="showShortcutsModal = true"
        @undo="mapStore.undo()"
        @redo="mapStore.redo()"
      />
    </div>

    <!-- ═══════════════ BOTTOM TOOLBAR ═══════════════ -->
    <CanvasBottomToolbar
      :active-tool="activeTool"
      :zoom="camera.zoom"
      :semantic-field-enabled="semanticFieldEnabled"
      @update:active-tool="activeTool = $event"
      @toggle-semantic="semanticStore.toggleField()"
      @open-shortcuts="showShortcutsModal = true"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @zoom-change="(v: number) => springCamera.setCurrent({ ...camera, zoom: v })"
      @zoom-set="setZoom"
      @reset-zoom="resetZoom"
      @fit-to-content="fitToContent"
    />

    <!-- Minimap (always visible on desktop) -->
    <div class="absolute bottom-20 right-4 z-toolbar pointer-events-auto hidden md:block">
      <Minimap
        :camera="camera"
        :container-width="canvasContainerWidth"
        :container-height="canvasContainerHeight"
        :regions="mapRegions.regions.value"
        :breadcrumbs="cameraIntel.breadcrumbs.value"
        @update:camera="springCamera.setTarget($event, 'snappy')"
      />
    </div>

    <!-- ═══════════════ MOBILE BOTTOM BAR ═══════════════ -->
    <nav class="absolute bottom-0 left-0 right-0 z-toolbar md:hidden">
      <div class="nc-glass-elevated border-t border-nc-border px-4 py-3">
        <div class="flex items-center justify-around">
          <NcButton :variant="activeTool === 'select' ? 'primary' : 'ghost'" size="icon" @click="activeTool = 'select'">
            <span class="i-lucide-mouse-pointer" />
          </NcButton>
          <NcButton :variant="activeTool === 'pan' ? 'primary' : 'ghost'" size="icon" @click="activeTool = 'pan'">
            <span class="i-lucide-hand" />
          </NcButton>
          <NcButton :variant="activeTool === 'node' ? 'primary' : 'ghost'" size="icon" @click="activeTool = 'node'">
            <span class="i-lucide-plus" />
          </NcButton>
          <NcButton :variant="activeTool === 'connect' ? 'primary' : 'ghost'" size="icon" @click="activeTool = 'connect'">
            <span class="i-lucide-move-diagonal" />
          </NcButton>
          <button
            class="nc-ai-btn !py-2 !px-3"
            :disabled="!selectedNode || isAILoading"
            @click="handleGenerateSuggestions"
          >
            <span class="i-lucide-sparkles" />
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile Sidebar Sheet -->
    <CanvasMobileSidebarSheet
      :visible="isMobile && showSidebarSheet"
      :selected-node="selectedNode"
      :is-a-i-loading="isAILoading"
      :ai-suggestions="aiSuggestions"
      :rich-suggestions="richSuggestions"
      @action="handleSidebarAction"
    />

    <!-- Panels (UNTOUCHED) -->
    <NodeTemplates
      :visible="showTemplates"
      :position="templatePosition"
      @close="showTemplates = false"
      @select="handleTemplateSelect"
    />

    <BacklinksPanel
      :visible="showBacklinksPanel"
      :node="selectedNode"
      @close="showBacklinksPanel = false"
      @navigate="handleNavigateToNode"
    />

    <GraphView
      :visible="mapStore.graphView.isOpen"
      @close="mapStore.closeGraphView()"
      @navigate-to-node="handleNavigateToNode"
    />

    <CanvasGenerateMapDialog
      :visible="showGenerateMapDialog"
      :is-loading="isAILoading"
      @close="showGenerateMapDialog = false"
      @generate="handleGenerateMap"
    />

    <!-- Context Menu -->
    <CanvasCanvasContextMenu
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      :items="contextMenuItems"
      @close="contextMenuVisible = false"
    />

    <!-- Shortcuts Modal -->
    <CanvasShortcutsModal
      :visible="showShortcutsModal"
      @close="showShortcutsModal = false"
    />
  </div>
</template>

