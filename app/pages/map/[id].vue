<script setup lang="ts">
import type { Camera, Node, Edge, Point } from '~/types/canvas'
import type { NodeTemplate } from '~/components/canvas/NodeTemplates.vue'
import type { ContextMenuItem } from '~/components/ui/NcContextMenu.vue'
import type { AISuggestion } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { useSemanticStore } from '~/stores/semanticStore'
import { useDatabase } from '~/composables/useDatabase'
import { useAutoSave } from '~/composables/useAutoSave'
import { useAI } from '~/composables/useAI'

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

// Loading
const isLoading = ref(true)
const loadError = ref<string | null>(null)

// Camera
const camera = ref<Camera>({ x: 0, y: 0, zoom: 1 })

// Tools - now includes 'connect' for connection tool
const activeTool = ref<'select' | 'pan' | 'node' | 'connect'>('select')

// Title editing
const isEditingTitle = ref(false)
const titleInput = ref<HTMLElement | null>(null)
const editedTitle = ref('')

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

// Overflow menu
const showOverflowMenu = ref(false)

// Sidebar visibility (desktop always visible, mobile as sheet)
const isMobile = ref(false)
const showSidebarSheet = ref(false)
const sidebarCollapsed = ref(false)

// Zoom presets popover
const showZoomPresets = ref(false)

// Minimap visibility (toggle with M key)
const showMinimap = ref(false)

// Semantic field visibility (toggle with S key)
const semanticFieldEnabled = computed({
  get: () => semanticStore.fieldSettings.enabled,
  set: (val) => semanticStore.toggleField(val)
})

// Canvas ref for highlighting
const canvasRef = ref<{ highlightedNodeIds: Set<string>; dimmedNodeIds: Set<string> } | null>(null)

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
      camera.value = map.camera
    } else {
      mapStore.newDocument()
    }
    isLoading.value = false
    autoSave.start()

    // Set up semantic store
    semanticStore.setCurrentMap(mapStore.id)

    // Initialize AI in background
    ai.initialize()

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

onUnmounted(() => {
  autoSave.stop()
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
  nextTick(() => {
    const el = titleInput.value as HTMLElement | null
    if (el) {
      el.focus()
      // Select all text in contenteditable
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
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
  showOverflowMenu.value = false
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
onKeyStroke('m', () => showMinimap.value = !showMinimap.value)
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
  if (contextMenuTargetNode.value) mapStore.deleteNode(contextMenuTargetNode.value.id)
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
  const node = mapStore.nodes.get(nodeId)
  if (node) {
    // Center camera on the node
    camera.value = {
      x: -node.position.x + window.innerWidth / 2 - node.size.width / 2,
      y: -node.position.y + window.innerHeight / 2 - node.size.height / 2,
      zoom: camera.value.zoom
    }
    mapStore.select([nodeId])
  }
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
    const context = Array.from(mapStore.nodes.values())
      .filter(n => n.id !== node.id)
      .slice(0, 5)
      .map(n => n.content)

    const suggestions = await ai.smartExpand(node.content, context, 3)
    const baseX = node.position.x + node.size.width + 50
    let offsetY = 0

    for (const suggestion of suggestions) {
      mapStore.addNode({
        position: { x: baseX, y: node.position.y + offsetY },
        content: suggestion,
        style: { ...node.style, borderColor: '#00D2BE' }
      })
      offsetY += 80
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

// Zoom
function zoomIn() {
  camera.value.zoom = Math.min(camera.value.zoom * 1.2, 2)
}

function zoomOut() {
  camera.value.zoom = Math.max(camera.value.zoom / 1.2, 0.25)
}

function fitToContent() {
  mapStore.fitToContent()
  camera.value = { ...mapStore.camera as unknown as Camera }
}

function setZoom(value: number) {
  camera.value.zoom = Math.max(0.25, Math.min(2, value))
  showZoomPresets.value = false
}

function resetZoom() {
  camera.value.zoom = 1
}

// Handle zoom slider
function handleZoomSlider(event: Event) {
  const target = event.target as HTMLInputElement
  camera.value.zoom = parseFloat(target.value)
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
  camera.value = {
    x: -node.position.x + 400,
    y: -node.position.y + 300,
    zoom: camera.value.zoom
  }
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
  camera.value = {
    x: -node.position.x + 400,
    y: -node.position.y + 300,
    zoom: camera.value.zoom
  }
}

function handleToggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
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

  try {
    const context = Array.from(mapStore.nodes.values())
      .filter(n => n.id !== node.id)
      .slice(0, 5)
      .map(n => n.content)

    const suggestions = await ai.smartExpand(node.content, context, 3)
    aiSuggestions.value = suggestions.map((content, index) => ({
      id: `suggestion-${index}`,
      type: 'expand' as const,
      content,
      confidence: 0.8
    }))
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
      y: node.position.y + (aiSuggestions.value.indexOf(suggestion) * 80)
    },
    content: suggestion.content,
    style: { ...node.style, borderColor: '#00D2BE' }
  })

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
  <div
    class="h-screen w-screen overflow-hidden relative flex"
    :style="{ backgroundColor: '#0A0A0C' }"
    @click="showOverflowMenu = false; showZoomPresets = false"
  >
    <!-- ═══════════════ LEFT SIDEBAR (Desktop) ═══════════════ -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="-translate-x-full opacity-0"
      leave-to-class="-translate-x-full opacity-0"
    >
      <div v-if="!sidebarCollapsed" class="nc-sidebar-wrapper">
        <CanvasSidebar
          :selectedNode="selectedNode"
          :isAILoading="isAILoading"
          :aiSuggestions="aiSuggestions"
          @smart-expand="handleGenerateSuggestions"
          @add-suggestion="handleAddSuggestion"
          @add-node="handleAddNodeFromSidebar"
          @add-categorized-node="handleAddCategorizedNode"
          @duplicate="handleDuplicateFromSidebar"
          @delete-node="() => selectedNode && mapStore.deleteNode(selectedNode.id)"
          @navigate-to-node="handleNavigateToNode"
          @toggle-sidebar="handleToggleSidebar"
          @highlight-nodes="handleHighlightNodes"
          @clear-highlights="handleClearHighlights"
        />
      </div>
    </Transition>

    <!-- Sidebar show button (when collapsed) -->
    <button
      v-if="sidebarCollapsed"
      class="nc-sidebar-show-btn"
      @click="handleToggleSidebar"
    >
      <span class="i-lucide-panel-left-open text-base" />
    </button>

    <!-- ═══════════════ MAIN CANVAS AREA ═══════════════ -->
    <div class="flex-1 relative">
      <!-- ═══════════════ CANVAS BACKGROUND ═══════════════ -->
      <div class="absolute inset-0 pointer-events-none z-0">
        <div class="nc-canvas-grid absolute inset-0" />
      </div>

      <!-- ═══════════════ LOADING ═══════════════ -->
      <div v-if="isLoading" class="absolute inset-0 z-50 nc-center" style="background: #0A0A0C">
        <div class="text-center">
          <div class="w-12 h-12 rounded-full border-2 border-nc-accent border-t-transparent animate-spin mx-auto mb-4" />
          <p class="text-nc-ink-muted font-display">Loading map...</p>
        </div>
      </div>

      <!-- ═══════════════ ERROR ═══════════════ -->
      <div v-else-if="loadError" class="absolute inset-0 z-50 nc-center" style="background: #0A0A0C">
        <div class="text-center">
          <div class="w-16 h-16 rounded-full bg-nc-error/10 nc-center mx-auto mb-4">
            <span class="i-lucide-alert-circle text-nc-error text-2xl" />
          </div>
          <h2 class="text-xl font-display font-semibold text-nc-ink mb-2">Failed to load map</h2>
          <p class="text-nc-ink-muted mb-6">{{ loadError }}</p>
          <NcButton variant="primary" @click="router.push('/dashboard')">Go to Dashboard</NcButton>
        </div>
      </div>

      <!-- ═══════════════ CANVAS ═══════════════ -->
      <CanvasInfiniteCanvas
        v-else
        ref="canvasRef"
        :camera="camera"
        :tool="activeTool"
        class="absolute inset-0"
        @update:camera="camera = $event"
        @contextmenu="handleCanvasContextMenu"
        @drop-category="handleDropCategory"
        @drop-node="handleDropNode"
      />

    <!-- ═══════════════ TOP BAR ═══════════════ -->
    <header class="absolute top-4 left-4 right-4 z-200 pointer-events-none">
      <div class="nc-between">
        <!-- Left: Back + Title (no container) -->
        <div class="pointer-events-auto flex items-center gap-4">
          <NuxtLink
            to="/dashboard"
            class="w-8 h-8 rounded-md flex items-center justify-center text-[#888890] hover:text-[#FAFAFA] transition-colors"
            aria-label="Back to dashboard"
          >
            <span class="i-lucide-arrow-left text-lg" />
          </NuxtLink>

          <span
            v-if="isEditingTitle"
            ref="titleInput"
            contenteditable="true"
            :style="{
              display: 'inline-block',
              minWidth: '60px',
              maxWidth: '200px',
              background: '#1A1A1E',
              color: '#FAFAFA',
              fontWeight: '500',
              fontSize: '14px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #00D2BE',
              outline: 'none',
              caretColor: '#00D2BE',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }"
            @keydown.enter.prevent="saveTitle"
            @keydown.escape="cancelEditTitle"
            @blur="saveTitle"
            @input="editedTitle = ($event.target as HTMLElement).textContent || ''"
          >{{ editedTitle }}</span>
          <button
            v-else
            class="text-[#FAFAFA] font-medium text-sm hover:text-[#00D2BE] transition-colors"
            @click="startEditingTitle"
          >
            {{ mapStore.title }}
          </button>

          <!-- Inline save status -->
          <span class="flex items-center gap-1.5 text-[11px] text-[#555558]">
            <template v-if="autoSave.isSaving.value">
              <span class="i-lucide-loader-2 animate-spin text-[#888890]" />
            </template>
            <template v-else-if="!mapStore.isDirty">
              <span class="w-1.5 h-1.5 rounded-full bg-[#00D2BE]" />
              <span>Saved</span>
            </template>
            <template v-else>
              <span class="text-[#888890]">Unsaved</span>
            </template>
          </span>
        </div>

        <!-- Right: AI Status + AI Expand + Overflow Menu -->
        <div class="pointer-events-auto flex items-center gap-3">
          <!-- AI Status Indicator -->
          <CanvasAIStatusIndicator />

          <button
            class="nc-ai-btn"
            :disabled="!selectedNode || isAILoading"
            @click="handleSmartExpand"
          >
            <span class="i-lucide-sparkles" :class="isAILoading ? 'animate-spin' : ''" />
            AI Expand
          </button>

          <!-- Overflow menu trigger -->
          <div class="relative">
            <button
              class="w-8 h-8 rounded-md flex items-center justify-center text-[#888890] hover:text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors"
              @click="showOverflowMenu = !showOverflowMenu"
            >
              <span class="i-lucide-more-horizontal text-lg" />
            </button>

            <!-- Overflow Menu Dropdown -->
            <Transition
              enter-active-class="transition-all duration-150 ease-out"
              leave-active-class="transition-all duration-100 ease-in"
              enter-from-class="opacity-0 scale-95"
              leave-to-class="opacity-0 scale-95"
            >
              <div
                v-if="showOverflowMenu"
                class="absolute right-0 top-full mt-2 w-48 bg-[#111114] border border-[#1E1E22] rounded-xl p-1.5 shadow-lg"
                @click.stop
              >
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors disabled:opacity-40"
                  :disabled="!mapStore.canUndo()"
                  @click="mapStore.undo(); showOverflowMenu = false"
                >
                  <span class="i-lucide-undo text-base" />
                  <span class="flex-1 text-left">Undo</span>
                  <span class="text-[11px] text-[#555558]">⌘Z</span>
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors disabled:opacity-40"
                  :disabled="!mapStore.canRedo()"
                  @click="mapStore.redo(); showOverflowMenu = false"
                >
                  <span class="i-lucide-redo text-base" />
                  <span class="flex-1 text-left">Redo</span>
                  <span class="text-[11px] text-[#555558]">⌘⇧Z</span>
                </button>

                <div class="h-px bg-[#1E1E22] my-1.5" />

                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors disabled:opacity-40"
                  :disabled="!mapStore.isDirty"
                  @click="handleSave(); showOverflowMenu = false"
                >
                  <span class="i-lucide-save text-base" />
                  <span class="flex-1 text-left">Save</span>
                  <span class="text-[11px] text-[#555558]">⌘S</span>
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors"
                  @click="showOverflowMenu = false"
                >
                  <span class="i-lucide-share text-base" />
                  <span class="flex-1 text-left">Share</span>
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors"
                  @click="showOverflowMenu = false"
                >
                  <span class="i-lucide-download text-base" />
                  <span class="flex-1 text-left">Export</span>
                </button>

                <div class="h-px bg-[#1E1E22] my-1.5" />

                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors"
                  @click="showShortcutsModal = true; showOverflowMenu = false"
                >
                  <span class="i-lucide-help-circle text-base" />
                  <span class="flex-1 text-left">Help</span>
                  <span class="text-[11px] text-[#555558]">?</span>
                </button>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#FAFAFA] hover:bg-[#1A1A1E] transition-colors"
                  @click="showOverflowMenu = false"
                >
                  <span class="i-lucide-settings text-base" />
                  <span class="flex-1 text-left">Settings</span>
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

    </div><!-- End of main canvas area -->

    <!-- ═══════════════ BOTTOM TOOLBAR ═══════════════ -->
    <div class="nc-bottom-toolbar">
      <!-- Left: Tool buttons -->
      <div class="nc-tool-group">
        <button
          :class="['nc-bottom-tool-btn', activeTool === 'select' && 'active']"
          title="Select (V)"
          @click="activeTool = 'select'"
        >
          <span class="i-lucide-mouse-pointer text-base" />
          <span v-if="activeTool === 'select'" class="nc-tool-indicator" />
        </button>
        <button
          :class="['nc-bottom-tool-btn', activeTool === 'pan' && 'active']"
          title="Pan (H)"
          @click="activeTool = 'pan'"
        >
          <span class="i-lucide-hand text-base" />
          <span v-if="activeTool === 'pan'" class="nc-tool-indicator" />
        </button>
        <button
          :class="['nc-bottom-tool-btn', activeTool === 'node' && 'active']"
          title="Add Node (N)"
          @click="activeTool = 'node'"
        >
          <span class="i-lucide-plus text-base" />
          <span v-if="activeTool === 'node'" class="nc-tool-indicator" />
        </button>
        <button
          :class="['nc-bottom-tool-btn', activeTool === 'connect' && 'active']"
          title="Connect (C)"
          @click="activeTool = 'connect'"
        >
          <span class="i-lucide-move-diagonal text-base" />
          <span v-if="activeTool === 'connect'" class="nc-tool-indicator" />
        </button>

        <!-- Divider -->
        <div class="w-px h-5 bg-[#2A2A30] mx-1" />

        <!-- Semantic Field Toggle -->
        <button
          :class="['nc-bottom-tool-btn', semanticFieldEnabled && 'active']"
          title="Toggle Semantic Field (S)"
          @click="semanticStore.toggleField()"
        >
          <span class="i-lucide-network text-base" />
          <span v-if="semanticFieldEnabled" class="nc-tool-indicator" />
        </button>
      </div>

      <!-- Center: Zoom slider -->
      <div class="nc-zoom-control">
        <button
          class="nc-zoom-btn"
          title="Zoom out"
          @click="zoomOut"
        >
          <span class="i-lucide-minus text-sm" />
        </button>

        <div class="nc-zoom-slider-wrapper">
          <input
            type="range"
            min="0.25"
            max="2"
            step="0.05"
            :value="camera.zoom"
            class="nc-zoom-slider"
            @input="handleZoomSlider"
            @dblclick="resetZoom"
          >
        </div>

        <button
          class="nc-zoom-btn"
          title="Zoom in"
          @click="zoomIn"
        >
          <span class="i-lucide-plus text-sm" />
        </button>

        <!-- Zoom percentage button with presets -->
        <div class="relative">
          <button
            class="nc-zoom-percentage"
            @click.stop="showZoomPresets = !showZoomPresets"
          >
            {{ Math.round(camera.zoom * 100) }}%
          </button>

          <!-- Zoom presets popover -->
          <Transition
            enter-active-class="transition-all duration-150 ease-out"
            leave-active-class="transition-all duration-100 ease-in"
            enter-from-class="opacity-0 translate-y-2"
            leave-to-class="opacity-0 translate-y-2"
          >
            <div
              v-if="showZoomPresets"
              class="nc-zoom-presets"
              @click.stop
            >
              <button @click="setZoom(0.25)">25%</button>
              <button @click="setZoom(0.5)">50%</button>
              <button @click="setZoom(0.75)">75%</button>
              <button @click="setZoom(1)">100%</button>
              <button @click="setZoom(1.5)">150%</button>
              <button @click="setZoom(2)">200%</button>
              <div class="nc-zoom-presets-divider" />
              <button @click="fitToContent">Fit to content</button>
            </div>
          </Transition>
        </div>
      </div>

      <!-- Right: Shortcuts hint -->
      <div class="nc-toolbar-right">
        <button
          class="nc-shortcuts-btn"
          @click="showShortcutsModal = true"
        >
          <span class="i-lucide-keyboard text-sm" />
          <span class="hidden sm:inline">Shortcuts</span>
        </button>
      </div>
    </div>

    <!-- Minimap (toggleable with M key) -->
    <div v-if="showMinimap" class="absolute bottom-20 right-4 z-toolbar pointer-events-auto hidden md:block">
      <Minimap :camera="camera" @update:camera="camera = $event" />
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
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300"
        leave-active-class="transition-all duration-200"
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="isMobile && showSidebarSheet"
          class="fixed inset-x-0 bottom-0 z-modal bg-[#0D0D10] rounded-t-2xl border-t border-[#1A1A1E] max-h-[70vh] overflow-y-auto"
        >
          <div class="p-4">
            <div class="w-10 h-1 bg-[#2A2A30] rounded-full mx-auto mb-4" />
            <CanvasSidebar
              :selected-node="selectedNode"
              :is-a-i-loading="isAILoading"
              :ai-suggestions="aiSuggestions"
              class="!w-full !border-none !min-h-0"
              @smart-expand="handleGenerateSuggestions"
              @add-suggestion="handleAddSuggestion"
              @add-node="handleAddNodeFromSidebar"
              @add-categorized-node="handleAddCategorizedNode"
              @duplicate="handleDuplicateFromSidebar"
              @delete-node="() => selectedNode && mapStore.deleteNode(selectedNode.id)"
              @navigate-to-node="handleNavigateToNode"
              @toggle-sidebar="showSidebarSheet = false"
            />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Panels -->
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

    <!-- ═══════════════ CONTEXT MENU ═══════════════ -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-100"
        leave-active-class="transition-opacity duration-75"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="contextMenuVisible"
          class="fixed inset-0 z-dropdown"
          @click="contextMenuVisible = false"
          @contextmenu.prevent="contextMenuVisible = false"
        >
          <div
            class="nc-context-menu"
            :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
            @click.stop
          >
            <template v-for="(item, index) in contextMenuItems" :key="index">
              <div v-if="item.type === 'separator'" class="nc-context-divider" />
              <div v-else-if="item.children" class="relative group">
                <button class="nc-context-item">
                  <span v-if="item.icon" :class="[item.icon, 'text-base']" />
                  <span class="flex-1 text-left">{{ item.label }}</span>
                  <span class="i-lucide-chevron-right text-base opacity-50" />
                </button>
                <div class="nc-context-submenu">
                  <button
                    v-for="(child, childIndex) in item.children"
                    :key="childIndex"
                    class="nc-context-item"
                    @click="child.action?.()"
                  >
                    <span
                      v-if="child.icon"
                      :class="[child.icon, 'text-base']"
                      :style="{
                        color: child.label === 'Teal' ? '#00D2BE' :
                               child.label === 'Purple' ? '#A78BFA' :
                               child.label === 'Pink' ? '#F472B6' :
                               child.label === 'Blue' ? '#60A5FA' :
                               child.label === 'Green' ? '#4ADE80' : undefined
                      }"
                    />
                    <span>{{ child.label }}</span>
                  </button>
                </div>
              </div>
              <button
                v-else
                :disabled="item.disabled"
                :class="[
                  'nc-context-item',
                  item.disabled && 'nc-context-item-disabled',
                  item.danger && 'nc-context-item-danger'
                ]"
                @click="item.action?.()"
              >
                <span v-if="item.icon" :class="[item.icon, 'text-lg']" />
                <span class="flex-1 text-left">{{ item.label }}</span>
                <span v-if="item.shortcut" class="text-xs text-nc-ink-muted">{{ item.shortcut }}</span>
              </button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ═══════════════ SHORTCUTS MODAL ═══════════════ -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showShortcutsModal"
          class="fixed inset-0 z-modal bg-nc-bg/90 backdrop-blur-xl nc-center"
          @click="showShortcutsModal = false"
        >
          <div
            class="nc-glass-elevated rounded-nc-2xl w-[560px] max-h-[80vh] overflow-hidden"
            @click.stop
          >
            <div class="px-6 py-5 border-b border-nc-border nc-between">
              <h2 class="font-display font-bold text-lg text-nc-ink">Keyboard Shortcuts</h2>
              <button
                class="w-8 h-8 rounded-nc-md nc-center text-nc-ink-muted hover:text-nc-ink hover:bg-nc-surface-2 transition-colors"
                @click="showShortcutsModal = false"
              >
                <span class="i-lucide-x text-lg" />
              </button>
            </div>
            <div class="p-6 max-h-[60vh] overflow-y-auto">
              <!-- Navigation -->
              <div class="mb-6">
                <div class="text-xs font-semibold uppercase tracking-wide text-nc-accent mb-3">Navigation</div>
                <div class="flex flex-col gap-2">
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Pan canvas</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">Space</span><span class="nc-shortcut-key">+ Drag</span></div>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Zoom in</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">+</span></div>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Zoom out</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">−</span></div>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Fit to screen</span>
                    <span class="nc-shortcut-key">F</span>
                  </div>
                </div>
              </div>
              <!-- Tools -->
              <div class="mb-6">
                <div class="text-xs font-semibold uppercase tracking-wide text-nc-accent mb-3">Tools</div>
                <div class="flex flex-col gap-2">
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Select tool</span>
                    <span class="nc-shortcut-key">V</span>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Pan tool</span>
                    <span class="nc-shortcut-key">H</span>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Add node tool</span>
                    <span class="nc-shortcut-key">N</span>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Connect tool</span>
                    <span class="nc-shortcut-key">C</span>
                  </div>
                </div>
              </div>
              <!-- Editing -->
              <div class="mb-6">
                <div class="text-xs font-semibold uppercase tracking-wide text-nc-accent mb-3">Editing</div>
                <div class="flex flex-col gap-2">
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Delete selected</span>
                    <span class="nc-shortcut-key">⌫</span>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Edit node text</span>
                    <span class="nc-shortcut-key">Double-click</span>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Duplicate</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">D</span></div>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Select all</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">A</span></div>
                  </div>
                </div>
              </div>
              <!-- Graph & Links -->
              <div class="mb-6">
                <div class="text-xs font-semibold uppercase tracking-wide text-nc-accent mb-3">Graph & Links</div>
                <div class="flex flex-col gap-2">
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Open Graph View</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">G</span></div>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Toggle Backlinks Panel</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">B</span></div>
                  </div>
                </div>
              </div>
              <!-- AI Features -->
              <div>
                <div class="text-xs font-semibold uppercase tracking-wide text-nc-accent mb-3">AI Features</div>
                <div class="flex flex-col gap-2">
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">AI Expand</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">E</span></div>
                  </div>
                  <div class="nc-between py-1">
                    <span class="text-sm text-nc-ink-soft">Accept suggestion</span>
                    <div class="nc-row gap-1"><span class="nc-shortcut-key">⌘</span><span class="nc-shortcut-key">↵</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

