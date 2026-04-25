<script setup lang="ts">
import type { Camera, Node, Edge, Point } from '~/types/canvas'
import type { NodeTemplate } from '~/components/canvas/NodeTemplates.vue'
import type { ContextMenuItem } from '~/components/ui/NcContextMenu.vue'
import type { AISuggestion, RichNodeSuggestion, GenerationContext } from '~/types'
import type { SidebarAction } from '~/types/sidebar'
import { useMapStore } from '~/stores/mapStore'
import { useUserStore } from '~/stores/userStore'
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
import { useExport } from '~/composables/useExport'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { useSemanticProcessor } from '~/composables/useSemanticProcessor'
import { useAISettings } from '~/composables/useAISettings'
import { useGuestMode } from '~/composables/useGuestMode'
import { useCollabSession, type RemoteUser } from '~/composables/useCollabSession'
import { cursorColor } from '~/utils/cursorColor'
import { mapDocumentToYDoc } from '~/utils/ydocConverter'
import CollabCursorLayer from '~/components/canvas/CollabCursorLayer.vue'
import CollabParticipants from '~/components/canvas/CollabParticipants.vue'

// i18n
const { locale: currentLocale } = useI18n()

// Route
const route = useRoute()
const router = useRouter()

// Platform
const platform = usePlatform()
const isMobile = platform.isMobile
const mapId = computed(() => route.params.id as string)

// Stores
const mapStore = useMapStore()
const semanticStore = useSemanticStore()
const db = useDatabase()
const autoSave = useAutoSave()
const ai = useAI()
const aiSettings = useAISettings()
const mapRenderer = useMapRenderer()
const guest = useGuestMode()

// Loading
const isLoading = ref(true)
const loadError = ref<string | null>(null)

// Real-time collab session (Plan 2). Inert unless NUXT_PUBLIC_COLLAB_ENABLED.
const collabSession = shallowRef<ReturnType<typeof useCollabSession> | null>(null)
const collabRemotes = ref<RemoteUser[]>([])

async function tryStartCollab() {
  const config = useRuntimeConfig()
  if (!config.public.collabEnabled || !config.public.partykitHost) return
  const shareToken = (route.query.via as string | undefined) ?? null
  try {
    const res = await $fetch<{
      ok: true
      wsUrl: string
      jwt: string
      role: 'viewer' | 'editor'
      sessionId: string
      displayName: string
    }>('/api/collab/token', {
      method: 'POST',
      body: { mapId: mapId.value, shareToken }
    })
    if (!res?.ok || !res.wsUrl) return
    // Seed a fresh Y.Doc from the current mapStore JSON so the room comes online with our state.
    const ydoc = mapDocumentToYDoc({
      id: mapStore.id,
      title: mapStore.title,
      nodes: mapStore.nodes,
      edges: mapStore.edges,
      camera: mapStore.camera,
      rootNodeId: mapStore.rootNodeId,
      createdAt: mapStore.createdAt,
      updatedAt: mapStore.updatedAt,
      settings: mapStore.settings
    })
    const session = useCollabSession({
      ydoc,
      wsUrl: res.wsUrl,
      mapId: mapId.value,
      jwt: res.jwt,
      role: res.role,
      sessionId: res.sessionId,
      displayName: res.displayName,
      color: cursorColor(res.sessionId)
    })
    collabSession.value = session
    watch(session.remotes, (next) => { collabRemotes.value = next })
  } catch (err) {
    console.warn('[collab] token mint or session start failed', err)
  }
}

function broadcastCursor(ev: PointerEvent) {
  if (ev.pointerType !== 'mouse') return
  const session = collabSession.value
  if (!session) return
  const cam = camera.value
  const x = ev.clientX / cam.zoom + cam.x
  const y = ev.clientY / cam.zoom + cam.y
  session.setCursor({ x, y })
}
function clearRemoteCursor() { collabSession.value?.setCursor(null) }

// Guest onboarding overlays
const showOnboarding = ref(false)
const showTemplatePicker = ref(false)
const showSavePrompt = ref(false)
const guestEditCount = ref(0)
const guestSessionStart = ref<number>(Date.now())
const guestSessionMinutes = computed(() => Math.max(1, Math.floor((Date.now() - guestSessionStart.value) / 60000)))
const savePromptDismissedAt = ref<number>(0)

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
const showDetailPanel = ref(false)

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
  showDetailPanel.value = !!node
})

// Multi-select action bar
const multiSelectCount = computed(() => mapStore.selection.nodeIds.size)
const multiSelectPosition = computed(() => {
  if (mapStore.selection.nodeIds.size < 2) return { x: 0, y: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity
  for (const nodeId of mapStore.selection.nodeIds) {
    const node = mapStore.nodes.get(nodeId)
    if (node) {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.size.width)
    }
  }
  const centerX = (minX + maxX) / 2
  // Convert world to screen
  return {
    x: centerX * camera.value.zoom + camera.value.x,
    y: minY * camera.value.zoom + camera.value.y
  }
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
const showSidebarSheet = ref(false)
const showMobileAISheet = ref(false)
const sidebarCollapsed = ref(false)

// Zoom presets (managed by ZoomControls component internally)

// User preferences — sync to canvas
const userStore = useUserStore()

// Grid visibility — sync user preference to map store
watch(() => userStore.preferences.value.showGrid, (show) => {
  mapStore.settings.gridEnabled = show
}, { immediate: true })

// View mode toggle: canvas (default on desktop), editor (default on mobile)
const viewMode = ref<'canvas' | 'graph' | 'editor'>('canvas')

// Minimap visibility — respect user preference from settings (default: true)
const minimapEnabled = computed(() => userStore.preferences.value.showMinimap !== false)
const minimapCollapsed = ref(false)

// Semantic search & settings
const showSemanticSearch = ref(false)
const showSemanticSettings = ref(false)
const semanticSearchRef = ref<{ setResults: (r: import('~/types/semantic').SemanticSearchResult[]) => void; setSearching: (v: boolean) => void } | null>(null)

// Semantic field visibility (toggle with S key)
const semanticFieldEnabled = computed({
  get: () => semanticStore.fieldSettings.enabled,
  set: (val) => semanticStore.toggleField(val)
})

// Watch semantic field toggle to start/stop processor
watch(semanticFieldEnabled, (enabled) => {
  if (enabled) {
    semanticProcessor.startProcessor()
    const allNodeIds = Array.from(mapStore.nodes.keys())
    if (allNodeIds.length > 0) {
      semanticProcessor.enqueueNodes(allNodeIds, 'normal')
    }
  } else {
    semanticProcessor.pauseProcessor()
  }
})

// Export
const exportUtils = useExport()

// Sync engine
const syncEngine = useSyncEngine()

// Semantic processor
const semanticProcessor = useSemanticProcessor()

// Canvas ref for highlighting and wheel listener
const canvasRef = ref<{ containerRef: HTMLDivElement | null; canvasRef: HTMLCanvasElement | null; isDragOver: boolean; highlightedNodeIds: Set<string>; dimmedNodeIds: Set<string> } | null>(null)

// Canvas container dimensions for minimap viewport calculation
const canvasContainerWidth = ref(0)
const canvasContainerHeight = ref(0)

// Guest template handler
function handleGuestTemplateSelect(templateId: string | null) {
  showTemplatePicker.value = false
  if (guest.isGuest.value && !guest.onboardingComplete.value) {
    showOnboarding.value = true
  }
  if (!templateId) return

  const templates: Record<string, { nodes: Array<{ content: string; x: number; y: number }>; edges: number[][] }> = {
    'decision-tree': {
      nodes: [
        { content: 'Decision', x: 400, y: 150 },
        { content: 'Option A', x: 150, y: 320 },
        { content: 'Risks', x: 400, y: 320 },
        { content: 'Option B', x: 650, y: 320 },
        { content: 'Pro', x: 150, y: 480 },
        { content: 'Mixed', x: 400, y: 480 },
        { content: 'Con', x: 650, y: 480 },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]],
    },
    brainstorm: {
      nodes: [
        { content: 'Topic', x: 400, y: 150 },
        { content: 'Idea 1', x: 150, y: 320 },
        { content: 'Idea 2', x: 400, y: 320 },
        { content: 'Idea 3', x: 650, y: 320 },
        { content: 'Sub a', x: 150, y: 480 },
        { content: 'Sub b', x: 400, y: 480 },
        { content: 'Sub c', x: 650, y: 480 },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]],
    },
    'pros-cons': {
      nodes: [
        { content: 'Question', x: 400, y: 150 },
        { content: 'Pro 1', x: 150, y: 320 },
        { content: 'Mixed', x: 400, y: 320 },
        { content: 'Con 1', x: 650, y: 320 },
        { content: 'Pro 2', x: 150, y: 480 },
        { content: 'Tradeoff', x: 400, y: 480 },
        { content: 'Con 2', x: 650, y: 480 },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]],
    },
    'project-plan': {
      nodes: [
        { content: 'Goal', x: 400, y: 150 },
        { content: 'Spec', x: 150, y: 320 },
        { content: 'Build', x: 400, y: 320 },
        { content: 'Ship', x: 650, y: 320 },
        { content: 'Today', x: 150, y: 480 },
        { content: 'Wk 2', x: 400, y: 480 },
        { content: 'Wk 4', x: 650, y: 480 },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]],
    },
    'research-synthesis': {
      nodes: [
        { content: 'Question', x: 400, y: 150 },
        { content: 'Source 1', x: 150, y: 320 },
        { content: 'Source 2', x: 400, y: 320 },
        { content: 'Source 3', x: 650, y: 320 },
        { content: 'Theme', x: 150, y: 480 },
        { content: 'AI synth', x: 400, y: 480 },
        { content: 'Gap', x: 650, y: 480 },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]],
    },
    'mind-map': {
      nodes: [
        { content: 'Center', x: 400, y: 300 },
        { content: 'Branch', x: 150, y: 200 },
        { content: 'Branch', x: 650, y: 200 },
        { content: 'Branch', x: 400, y: 500 },
        { content: 'Sub', x: 50, y: 100 },
        { content: 'Sub', x: 750, y: 100 },
        { content: 'Sub', x: 400, y: 600 },
      ],
      edges: [[0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 6]],
    },
  }

  const tmpl = templates[templateId]
  if (!tmpl) return

  const nodeIds: string[] = []
  for (const n of tmpl.nodes) {
    const node = mapStore.addNode({ position: { x: n.x, y: n.y }, content: n.content })
    nodeIds.push(typeof node === 'string' ? node : (node as { id: string }).id)
  }

  for (const [srcIdx, tgtIdx] of tmpl.edges) {
    const src = srcIdx !== undefined ? nodeIds[srcIdx] : undefined
    const tgt = tgtIdx !== undefined ? nodeIds[tgtIdx] : undefined
    if (src && tgt) {
      mapStore.addEdge(src, tgt)
    }
  }
}

// Guest AI generate handler — guest can't use AI yet, so trigger upgrade modal
function handleGuestGenerate(_prompt: string) {
  showTemplatePicker.value = false
  if (guest.isGuest.value && !guest.onboardingComplete.value) {
    showOnboarding.value = true
  }
  guest.requireFeature('ai')
}

// Track guest edits and trigger save prompt at threshold (10 edits or 5 min after onboarding)
function maybeShowSavePrompt() {
  if (!guest.isGuest.value) return
  if (showSavePrompt.value) return
  // Cooldown: don't re-show within 3 min of dismissal
  if (Date.now() - savePromptDismissedAt.value < 180_000) return
  if (guestEditCount.value >= 10 && guestSessionMinutes.value >= 3) {
    showSavePrompt.value = true
  }
}

if (import.meta.client) {
  watch(
    () => [mapStore.nodes?.size ?? 0, mapStore.edges?.size ?? 0],
    ([n, e], [pn, pe] = [0, 0]) => {
      const delta = (n - (pn ?? 0)) + (e - (pe ?? 0))
      if (delta > 0 && guest.isGuest.value) {
        guestEditCount.value += delta
        maybeShowSavePrompt()
      }
    },
  )

  // Tab-close warning for guests with unsaved work
  window.addEventListener('beforeunload', (ev) => {
    if (guest.isGuest.value && guestEditCount.value > 3) {
      ev.preventDefault()
      ev.returnValue = ''
    }
  })
}

// Load map
onMounted(async () => {
  document.body.classList.add('canvas-page')

  try {
    if (mapId.value === 'new') {
      mapStore.newDocument()
      isLoading.value = false
      autoSave.start()
      syncEngine.initialize()
      // Set up semantic store for new map
      semanticStore.setCurrentMap(mapStore.id)

      // Only initialize AI for authenticated users
      if (!guest.isGuest.value) {
        aiSettings.initialize()
        ai.initialize().catch((e) => {
          console.error('[Map] AI init failed:', e)
        })
      }

      // Track guest map ID and show template picker first, then onboarding after a pick
      if (guest.isGuest.value) {
        guest.setGuestMapId(mapStore.id)
        if (!guest.onboardingComplete.value) {
          showTemplatePicker.value = true
        }
      }

      return
    }

    let map = await db.getMap(mapId.value)

    // If not in IndexedDB, try pulling from server (e.g., template-created maps)
    if (!map && syncEngine.isSyncEnabled.value) {
      await syncEngine.pullMap(mapId.value)
      map = await db.getMap(mapId.value)
    }

    if (map) {
      mapStore.fromSerializable(map)
      springCamera.setCurrent(map.camera)
    } else {
      mapStore.newDocument()
    }
    isLoading.value = false
    autoSave.start()
    syncEngine.initialize()

    // Set up semantic store
    semanticStore.setCurrentMap(mapStore.id)

    // Only initialize AI for authenticated users
    if (!guest.isGuest.value) {
      aiSettings.initialize()
      ai.initialize().then(() => {
        // Wire semantic processor to the AI worker's sendMessage
        semanticProcessor.setSendMessage(ai.sendMessage)

        // Start the processor if semantic field is enabled
        if (semanticStore.fieldSettings.enabled) {
          semanticProcessor.startProcessor()
          // Queue all existing nodes for initial embedding
          const allNodeIds = Array.from(mapStore.nodes.keys())
          if (allNodeIds.length > 0) {
            semanticProcessor.enqueueNodes(allNodeIds, 'normal')
          }
        }
      }).catch((e) => {
        console.error('[Map] AI init failed:', e)
      })
    }

    // Trigger edge entrance animations on map load
    if (mapStore.edges.size > 0) {
      edgeAnim.triggerEntranceAll(mapStore.edges, 30)
    }

    // Compute initial regions
    mapRegions.scheduleRecompute(mapStore.nodes)

    // Mark all existing nodes as dirty for initial embedding
    const nodeIds = Array.from(mapStore.nodes.keys())
    semanticStore.markDirtyBatch(nodeIds)

    // Process embeddings after a short delay (fallback for when processor not ready)
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
  collabSession.value?.dispose()
  collabSession.value = null
})

// Selection broadcast — re-publish whenever local selection changes.
watch(
  () => Array.from(mapStore.selection.nodeIds),
  (ids) => collabSession.value?.setSelection(ids),
  { deep: true }
)

// Kick off the realtime session once the map has finished loading.
watch(isLoading, (loading) => {
  if (!loading) tryStartCollab()
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

// Share & Export
async function handleShare() {
  try {
    await exportUtils.shareAsText(mapStore, platform)
  } catch (e) {
    console.error('Share failed:', e)
  }
}

function handleExportPng() {
  const el = canvasRef.value?.canvasRef
  if (el) exportUtils.exportAsPng(el, mapStore.title as string)
}

function handleExportJson() {
  exportUtils.exportAsJson(mapStore, mapStore.title as string)
}

function handleExportMarkdown() {
  exportUtils.exportAsMarkdown(mapStore, mapStore.title as string)
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

// Set mobile default view on mount
onMounted(() => {
  if (isMobile.value) {
    viewMode.value = 'editor'
  }
})

// Helper to check if user is typing in an input field
function isTyping(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

// Keyboard shortcuts
onKeyStroke('v', () => { if (!isTyping()) activeTool.value = 'select' })
onKeyStroke('h', () => { if (!isTyping()) activeTool.value = 'pan' })
onKeyStroke('n', () => { if (!isTyping()) activeTool.value = 'node' })
onKeyStroke('c', () => { if (!isTyping()) activeTool.value = 'connect' })
onKeyStroke('t', () => { if (!isTyping()) showTemplates.value = !showTemplates.value })
onKeyStroke('Escape', () => {
  activeTool.value = 'select'
  showTemplates.value = false
  contextMenuVisible.value = false
  showShortcutsModal.value = false
  showDetailPanel.value = false
  if (isEditingTitle.value) cancelEditTitle()
})
onKeyStroke('s', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    handleSave()
  }
})
onKeyStroke('?', () => { if (!isTyping()) showShortcutsModal.value = !showShortcutsModal.value })
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
onKeyStroke('m', () => { if (!isTyping()) minimapCollapsed.value = !minimapCollapsed.value })

// Keyboard camera navigation
onKeyStroke('ArrowLeft', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ x: camera.value.x + 200 }, 'snappy')
  }
})
onKeyStroke('ArrowRight', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ x: camera.value.x - 200 }, 'snappy')
  }
})
onKeyStroke('ArrowUp', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ y: camera.value.y + 200 }, 'snappy')
  }
})
onKeyStroke('ArrowDown', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    springCamera.setTarget({ y: camera.value.y - 200 }, 'snappy')
  }
})
onKeyStroke('=', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    zoomIn()
  }
})
onKeyStroke('-', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    zoomOut()
  }
})
onKeyStroke('0', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    fitToContent()
  }
})
onKeyStroke('1', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    resetZoom()
  }
})
onKeyStroke('Tab', (e) => {
  if (isTyping()) return
  e.preventDefault()
  const nodeId = cameraIntel.cycleNode(e.shiftKey ? 'prev' : 'next')
  if (nodeId) mapStore.select([nodeId])
})
onKeyStroke('Home', (e) => {
  if (isTyping()) return
  e.preventDefault()
  const nodeId = cameraIntel.flyToRoot()
  if (nodeId) mapStore.select([nodeId])
})
onKeyStroke('f', (e) => {
  if (!isTyping() && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    cameraIntel.flyToSelection()
  }
})
onKeyStroke('Backspace', (e) => {
  if (isTyping() || isEditingTitle.value) return
  if (mapStore.selection.nodeIds.size > 0 || mapStore.selection.edgeIds.size > 0) {
    e.preventDefault()
    deleteSelectedWithAnimations()
  } else if (!e.ctrlKey && !e.metaKey) {
    cameraIntel.goBack()
  }
})
onKeyStroke('Delete', (e) => {
  if (isTyping() || isEditingTitle.value) return
  if (mapStore.selection.nodeIds.size > 0 || mapStore.selection.edgeIds.size > 0) {
    e.preventDefault()
    deleteSelectedWithAnimations()
  }
})
onKeyStroke('s', (e) => {
  // S without modifier toggles semantic field
  if (!isTyping() && !e.ctrlKey && !e.metaKey && !e.altKey) {
    semanticStore.toggleField()
  }
}, { eventName: 'keyup' })
onKeyStroke('\\', () => { if (!isTyping()) sidebarCollapsed.value = !sidebarCollapsed.value })
onKeyStroke('k', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    showSemanticSearch.value = !showSemanticSearch.value
  }
})

// Delete selected nodes/edges with exit animations
function deleteSelectedWithAnimations() {
  for (const nodeId of mapStore.selection.nodeIds) {
    const node = mapStore.nodes.get(nodeId)
    if (node) {
      nodeAnim.exitNode(node.id, {
        position: { ...node.position },
        size: { ...node.size },
        content: node.content,
        style: { ...node.style }
      })
    }
  }
  mapStore.deleteSelected()
  if (isMobile.value) platform.haptics.impact('heavy')
  // Focus canvas after delete
  canvasRef.value?.containerRef?.focus()
}

// Space hold → temporary pan tool
let toolBeforeSpace: typeof activeTool.value | null = null

onKeyStroke(' ', (e) => {
  if (isEditingTitle.value) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
  e.preventDefault()
  if (!toolBeforeSpace) {
    toolBeforeSpace = activeTool.value
    activeTool.value = 'pan'
  }
}, { eventName: 'keydown' })

onKeyStroke(' ', (e) => {
  if (isEditingTitle.value) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
  e.preventDefault()
  if (toolBeforeSpace) {
    activeTool.value = toolBeforeSpace
    toolBeforeSpace = null
  }
}, { eventName: 'keyup' })

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
  if (isMobile.value) platform.haptics.impact('medium')
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
      style: 'detailed',
      locale: currentLocale.value
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
  springCamera.setCurrent({ ...camera.value, zoom: Number.parseFloat(target.value) })
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
      style: 'detailed',
      locale: currentLocale.value
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
    if (isMobile.value) platform.haptics.notification('error')
  } finally {
    isAILoading.value = false
    // Haptic feedback on AI completion
    if (isMobile.value && (aiSuggestions.value.length > 0 || richSuggestions.value.length > 0)) {
      platform.haptics.notification('success')
    }
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
      style: 'detailed',
      locale: currentLocale.value
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

    const description = await ai.generateNodeDescription(node.content, contextNodes, 'detailed', currentLocale.value)

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
      domain: options.domain,
      locale: currentLocale.value
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
async function handleSemanticSearch(query: string) {
  if (!query.trim()) return
  semanticSearchRef.value?.setSearching(true)
  try {
    const nodesWithEmbeddings = semanticStore.nodesWithEmbeddings
    const nodes = nodesWithEmbeddings.map(n => ({
      id: n.nodeId,
      content: mapStore.nodes.get(n.nodeId)?.content ?? '',
      embedding: n.embedding
    })).filter(n => n.content)

    if (nodes.length === 0) {
      semanticSearchRef.value?.setResults([])
      return
    }

    const result = await ai.sendMessage<{
      results: import('~/types/semantic').SemanticSearchResult[]
    }>('hybrid-search', { query, nodes, topK: 10 })

    semanticSearchRef.value?.setResults(result.results)
  } catch (e) {
    console.error('Semantic search failed:', e)
    semanticSearchRef.value?.setResults([])
  }
}

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

// ═══════════════ MOBILE BACK HANDLER ═══════════════
function handleMobileBack() {
  router.push('/dashboard')
}

const saveStatusText = computed(() => {
  if (!autoSave.lastSavedAt.value) return 'Not saved'
  const diff = Date.now() - autoSave.lastSavedAt.value
  if (diff < 5000) return 'Saved just now'
  if (diff < 60000) return `Saved ${Math.floor(diff / 1000)}s ago`
  return `Saved ${Math.floor(diff / 60000)}m ago`
})

// Page meta
definePageMeta({
  layout: 'canvas',
  middleware: 'auth',
  ssr: false
})

useHead({
  title: () => `${mapStore.title} - NeuroCanvas`
})
</script>

<template>
  <div class="h-screen w-screen overflow-hidden relative flex bg-nc-bg">
    <!-- ═══════════════ LOADING / ERROR (both mobile & desktop) ═══════════════ -->
    <div v-if="isLoading" class="absolute inset-0 z-50 flex items-center justify-center bg-nc-bg">
      <div class="flex flex-col items-center gap-3">
        <span class="i-lucide-loader-circle text-3xl text-nc-accent animate-spin" />
        <span class="text-sm text-nc-text-secondary">Loading map...</span>
      </div>
    </div>
    <div v-else-if="loadError" class="absolute inset-0 z-50 flex items-center justify-center bg-nc-bg">
      <div class="flex flex-col items-center gap-3">
        <span class="i-lucide-alert-circle text-3xl text-red-400" />
        <span class="text-sm text-nc-text-secondary">{{ loadError }}</span>
      </div>
    </div>

    <!-- ═══════════════ MOBILE FAB (Editor view only) ═══════════════ -->
    <template v-if="isMobile && viewMode === 'editor' && !isLoading && !loadError">
      <!-- AI Suggestions FAB -->
      <button
        class="fixed top-16 right-3 z-40 w-10 h-10 rounded-xl flex items-center justify-center bg-nc-surface-3 text-nc-ink border border-nc-surface-3 shadow-lg active:scale-95 transition-all"
        title="AI Suggestions"
        @click="showMobileAISheet = true"
      >
        <span class="i-lucide-sparkles text-lg" />
      </button>
    </template>

    <!-- ═══════════════ LEFT SIDEBAR (Desktop only) ═══════════════ -->
    <template v-if="!isMobile">
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
    </template><!-- end desktop sidebar -->

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

      <!-- Empty canvas guide (desktop only — canvas mode only) -->
      <CanvasEmptyCanvasGuide
        v-if="!isLoading && !loadError && mapStore.nodes.size === 0 && !isMobile && viewMode === 'canvas'"
        @add-node="handleAddNodeFromSidebar"
        @generate-map="showGenerateMapDialog = true"
      />

      <!-- Mobile Segmented Control (Editor | Graph) -->
      <div v-if="isMobile && !isLoading && !loadError" class="nc-mobile-segmented-wrapper">
        <div class="nc-mobile-segmented">
          <button
            :class="['nc-segment', { active: viewMode === 'editor' }]"
            @click="viewMode = 'editor'; platform.haptics.selection()"
          >
            <span class="i-lucide-file-text nc-segment-icon" />
            <span class="nc-segment-label">Editor</span>
          </button>
          <button
            :class="['nc-segment', { active: viewMode === 'graph' }]"
            @click="viewMode = 'graph'; platform.haptics.selection()"
          >
            <span class="i-lucide-git-fork nc-segment-icon" />
            <span class="nc-segment-label">Graph</span>
          </button>
        </div>
      </div>

      <!-- Canvas View (desktop only) -->
      <CanvasInfiniteCanvas
        v-if="!isLoading && !loadError && viewMode === 'canvas' && !isMobile"
        ref="canvasRef"
        :camera="camera"
        :tool="activeTool"
        @update:camera="springCamera.setCurrent($event)"
        @pan-end="(v: { vx: number; vy: number }) => springCamera.addVelocity(v.vx, v.vy)"
        @contextmenu="handleCanvasContextMenu"
        @drop-category="handleDropCategory"
        @drop-node="handleDropNode"
        @pointermove.passive="broadcastCursor"
        @pointerleave="clearRemoteCursor"
      />

      <!-- Real-time collab cursor + selection halo overlay -->
      <CollabCursorLayer
        v-if="collabSession && viewMode === 'canvas' && !isMobile"
        :remotes="collabRemotes"
        :camera="camera"
      />

      <!-- Graph View (Obsidian-style force-directed) -->
      <CanvasForceGraphCanvas
        v-if="!isLoading && !loadError && viewMode === 'graph' && mapStore.nodes.size > 0"
        @select-node="(id: string) => mapStore.selectNode(id)"
        @deselect="mapStore.clearSelection()"
      />

      <!-- Markdown Editor View — always available; typing here creates nodes -->
      <CanvasMarkdownEditorView
        v-if="!isLoading && !loadError && viewMode === 'editor'"
      />


      <!-- Real-time collab participants (desktop, top-right) -->
      <div v-if="collabSession && !isMobile" class="collab-participants-anchor">
        <CollabParticipants :remotes="collabRemotes" />
      </div>

      <!-- Multi-Select Action Bar -->
      <Transition name="nc-fade-up">
        <CanvasMultiSelectBar
          v-if="multiSelectCount > 1"
          :count="multiSelectCount"
          :screen-x="multiSelectPosition.x"
          :screen-y="multiSelectPosition.y"
          @duplicate="mapStore.duplicateSelected()"
          @ai-expand="handleSmartExpand()"
          @delete="deleteSelectedWithAnimations()"
        />
      </Transition>

      <!-- Top Bar -->
      <CanvasTopBar
        ref="topBarRef"
        :is-editing-title="isEditingTitle"
        :edited-title="editedTitle"
        :is-a-i-loading="isAILoading"
        :has-selection="!!selectedNode"
        :breadcrumbs="cameraIntel.breadcrumbs.value"
        :regions="mapRegions.regions.value"
        :view-mode="viewMode"
        @start-editing="startEditingTitle"
        @save-title="saveTitle"
        @cancel-edit="cancelEditTitle"
        @title-input="editedTitle = $event"
        @smart-expand="handleSmartExpand"
        @save="handleSave"
        @share="handleShare"
        @export-png="handleExportPng"
        @export-json="handleExportJson"
        @export-markdown="handleExportMarkdown"
        @open-shortcuts="showShortcutsModal = true"
        @undo="mapStore.undo()"
        @redo="mapStore.redo()"
        @navigate-breadcrumb="(crumb) => springCamera.setTarget(crumb, 'snappy')"
        @set-view="viewMode = $event"
      />
    </div>

    <!-- ═══════════════ BOTTOM TOOLBAR (canvas only, desktop) ═══════════════ -->
    <CanvasBottomToolbar
      v-if="viewMode === 'canvas' && !isMobile"
      :active-tool="activeTool"
      :zoom="camera.zoom"
      :semantic-field-enabled="semanticFieldEnabled"
      :can-undo="mapStore.canUndo()"
      :can-redo="mapStore.canRedo()"
      :processing-queue-size="semanticStore.embeddingQueueSize"
      :processor-state="semanticStore.processorState"
      @update:active-tool="activeTool = $event"
      @toggle-semantic="semanticStore.toggleField()"
      @open-semantic-settings="showSemanticSettings = true"
      @open-shortcuts="showShortcutsModal = true"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @zoom-change="(v: number) => springCamera.setCurrent({ ...camera, zoom: v })"
      @zoom-set="setZoom"
      @reset-zoom="resetZoom"
      @fit-to-content="fitToContent"
      @undo="mapStore.undo()"
      @redo="mapStore.redo()"
    />

    <!-- Minimap (canvas mode only, desktop, when enabled in settings) -->
    <div v-if="minimapEnabled && viewMode === 'canvas' && !isMobile" class="minimap-wrapper">
      <CanvasMinimap
        v-model:collapsed="minimapCollapsed"
        :camera="camera"
        :container-width="canvasContainerWidth"
        :container-height="canvasContainerHeight"
        :regions="mapRegions.regions.value"
        :breadcrumbs="cameraIntel.breadcrumbs.value"
        @update:camera="springCamera.setTarget($event, 'snappy')"
        @fit-all="fitToContent"
      />
    </div>

    <!-- Mobile Sidebar Sheet -->
    <CanvasMobileSidebarSheet
      :visible="isMobile && showSidebarSheet"
      :selected-node="selectedNode"
      :is-a-i-loading="isAILoading"
      :ai-suggestions="aiSuggestions"
      :rich-suggestions="richSuggestions"
      @action="handleSidebarAction"
      @close="showSidebarSheet = false"
    />

    <!-- Mobile Node Properties Sheet -->
    <CanvasMobileNodePropertiesSheet
      :visible="isMobile && !!selectedNode && !showSidebarSheet"
      :selected-node="selectedNode"
      @action="handleSidebarAction"
      @close="mapStore.clearSelection()"
    />

    <!-- Mobile AI Suggestions Sheet -->
    <CanvasMobileAISuggestionsSheet
      :visible="isMobile && showMobileAISheet"
      :selected-node="selectedNode"
      :is-a-i-loading="isAILoading"
      :ai-suggestions="aiSuggestions"
      :rich-suggestions="richSuggestions"
      @action="handleSidebarAction"
      @close="showMobileAISheet = false"
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

    <!-- Node Detail Panel (right side) -->
    <CanvasNodeDetailPanel
      :visible="showDetailPanel && !isMobile"
      :node="selectedNode"
      @close="showDetailPanel = false"
      @navigate="handleNavigateToNode"
      @generate-description="handleGenerateDescription"
    />

    <GraphView
      :visible="mapStore.graphView.isOpen"
      @close="mapStore.closeGraphView()"
      @navigate-to-node="handleNavigateToNode"
    />

    <LazyCanvasGenerateMapDialog
      :visible="showGenerateMapDialog"
      :is-loading="isAILoading"
      @close="showGenerateMapDialog = false"
      @generate="handleGenerateMap"
    />

    <!-- Semantic Search Overlay -->
    <CanvasSemanticSearch
      ref="semanticSearchRef"
      :visible="showSemanticSearch"
      @close="showSemanticSearch = false"
      @navigate-to-node="(nodeId) => { handleNavigateToNode(nodeId); showSemanticSearch = false }"
      @search="handleSemanticSearch"
    />

    <!-- Semantic Settings Panel -->
    <LazyCanvasSemanticSettingsPanel
      :visible="showSemanticSettings"
      @close="showSemanticSettings = false"
    />

    <!-- Context Menu (desktop: positioned, mobile: bottom sheet) -->
    <CanvasCanvasContextMenu
      v-if="!isMobile"
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      :items="contextMenuItems"
      @close="contextMenuVisible = false"
    />
    <CanvasMobileContextMenu
      v-else
      :visible="contextMenuVisible"
      :items="contextMenuItems"
      :node-name="contextMenuTargetNode?.content"
      :node-color="contextMenuTargetNode?.style?.borderColor"
      @close="contextMenuVisible = false"
    />

    <!-- Shortcuts Modal -->
    <CanvasShortcutsModal
      :visible="showShortcutsModal"
      @close="showShortcutsModal = false"
    />

    <!-- Sync conflict resolution dialog -->
    <SyncConflictDialog />

    <!-- Guest Template Picker (shown first) -->
    <GuestTemplatePicker
      v-if="showTemplatePicker"
      @select="handleGuestTemplateSelect"
      @generate="handleGuestGenerate"
    />

    <!-- Guest Onboarding (after template pick) -->
    <GuestOnboardingWalkthrough
      v-if="showOnboarding"
      @complete="showOnboarding = false"
    />

    <!-- Guest Save-Your-Work Prompt -->
    <GuestSaveWorkPrompt
      :visible="showSavePrompt"
      :edit-count="guestEditCount"
      :session-minutes="guestSessionMinutes"
      @dismiss="showSavePrompt = false"
      @remind="showSavePrompt = false; savePromptDismissedAt = Date.now()"
    />

    <!-- Guest Upgrade Modal -->
    <GuestUpgradeModal v-if="guest.isGuest.value" />

  </div>
</template>

<style scoped>
.collab-participants-anchor {
  position: absolute;
  top: 14px;
  right: 240px;
  z-index: 60;
  pointer-events: auto;
}

.minimap-wrapper {
  position: fixed;
  bottom: 96px;
  right: 24px;
  z-index: 200;
  pointer-events: auto;
}


/* ═══ Mobile Segmented Control ═══ */
.nc-mobile-segmented-wrapper {
  position: relative;
  z-index: 30;
  padding: 0 16px 12px;
  flex-shrink: 0;
}

.nc-mobile-segmented {
  display: flex;
  background: var(--nc-surface-2, #111114);
  border-radius: 10px;
  padding: 4px;
  border: 1px solid var(--nc-border, #1E1E22);
  gap: 4px;
}

.nc-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 28px;
  border-radius: 8px;
  gap: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 150ms ease;
}

.nc-segment-icon {
  font-size: 14px;
  color: var(--nc-text-secondary, #888890);
}

.nc-segment-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  color: var(--nc-text-secondary, #888890);
}

.nc-segment.active {
  background: var(--nc-surface-3, #1E1E22);
}

.nc-segment.active .nc-segment-icon {
  color: var(--nc-ink, #FAFAFA);
}

.nc-segment.active .nc-segment-label {
  font-weight: 600;
  color: var(--nc-ink, #FAFAFA);
}
</style>

