<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { parseLosslessMarkdown, parseMapJson, MapImportError } from '~/utils/mapImport'
import { useMapStore } from '~/stores/mapStore'
import { useAI } from '~/composables/useAI'
import { useAISettings } from '~/composables/useAISettings'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useSyncEngine } from '~/composables/useSyncEngine'

const { t, locale: currentLocale } = useI18n()
const { isMobile } = usePlatform()

definePageMeta({
  layout: false,
  middleware: 'auth'
})

// Platform detection — only true on client, never during SSR/generate
const _isTauri = import.meta.client && typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const _isCapacitor = import.meta.client && typeof window !== 'undefined' && 'Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()
const _isNative = _isTauri || _isCapacitor

// Auth
// Minimal local-only user so the page renders — NOT a real session.
// The sidebar checks desktopAuth.isSignedIn for real auth state.
const _nativeSession = { user: { id: 'native-local', name: null, email: null } }
const { data: _sessionData, status, getSession } = _isNative
  ? { data: ref(_nativeSession), status: ref('authenticated'), getSession: async () => _nativeSession }
  : useAuth()
const session = _sessionData ?? ref(null)
const desktopAuth = _isTauri ? useDesktopAuth() : null
const mobileAuth = _isCapacitor ? useMobileAuth() : null
const user = computed(() => {
  // On native: prefer real user from desktop/mobile auth
  if (_isTauri && desktopAuth?.isSignedIn.value && desktopAuth.user.value) return desktopAuth.user.value
  if (_isCapacitor && mobileAuth?.isSignedIn.value && mobileAuth.user.value) return mobileAuth.user.value
  return session.value?.user
})
// Always start false so SSR and client initial render match (loading spinner).
// Set to true in onMounted to avoid hydration mismatch in Tauri.
const authChecked = ref(!!session.value?.user)

onMounted(async () => {
  if (_isNative) {
    // On native apps, session is already set — just mark as checked
    authChecked.value = true
  } else {
    // Only force-fetch when no cached session (e.g. direct navigation).
    // Skip when session is already available (e.g. navigating back from settings)
    // to avoid getSession temporarily clearing data and causing a black flash.
    if (!session.value?.user) {
      try {
        await getSession({ force: true })
      } catch (e) {
        // Session check failed
      }
    }
    authChecked.value = true
    if (!session.value?.user) {
      navigateTo('/auth/signin')
      return
    }
  }
  // Set current user for IndexedDB multi-account isolation
  const userId = (session.value?.user as { id?: string })?.id
  if (userId) {
    await db.setCurrentUserId(userId)
  }
  await aiSettings.initialize()
  await syncEngine.initialize()
})

const db = useDatabase()
const mapStore = useMapStore()
const router = useRouter()
const ai = useAI()
const syncEngine = useSyncEngine()
const aiSettings = useAISettings()
const mapRenderer = useMapRenderer()
const { handleSignOut, isLoading: signOutLoading } = useAuthStore()

// State
const recentMaps = ref<DBMapDocument[]>([])
const isLoading = ref(true)
const isCreatingMap = ref(false)

// Delete confirmation
const deleteConfirmVisible = ref(false)
const deleteTargetId = ref<string | null>(null)

// AI Quick Start
const showAIModal = ref(false)
const aiTopic = ref('')
const aiLoading = ref(false)
const aiError = ref<string | null>(null)

// AI Generation Progress
interface AIStep {
  label: string
  status: 'pending' | 'active' | 'done'
  elapsed?: string
}
const aiSteps = ref<AIStep[]>([])
const aiProgressPct = ref(0)

function resetAIProgress() {
  aiSteps.value = [
    { label: t('dashboard.ai_modal.analyzing_topic'), status: 'pending' },
    { label: t('dashboard.ai_modal.generating_branches'), status: 'pending' },
    { label: t('dashboard.ai_modal.adding_sub_nodes'), status: 'pending' },
    { label: t('dashboard.ai_modal.finding_connections'), status: 'pending' },
  ]
  aiProgressPct.value = 0
}

function advanceStep(index: number, elapsed?: string) {
  if (index > 0 && aiSteps.value[index - 1]) {
    aiSteps.value[index - 1].status = 'done'
    aiSteps.value[index - 1].elapsed = elapsed
  }
  if (aiSteps.value[index]) {
    aiSteps.value[index].status = 'active'
  }
  aiProgressPct.value = Math.round(((index + 0.5) / aiSteps.value.length) * 100)
}

function completeAllSteps() {
  aiSteps.value.forEach((s) => { s.status = 'done' })
  aiProgressPct.value = 100
}

// Templates
const showTemplatesModal = ref(false)

// Import
const showImportModal = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)


// Templates data
const templates = computed(() => [
  {
    id: 'brainstorm',
    name: t('dashboard.quick_templates.brainstorm'),
    icon: 'i-lucide-lightbulb',
    description: t('dashboard.quick_templates.brainstorm_desc'),
    nodes: [
      { content: 'Main Idea', x: 400, y: 300, isRoot: true },
      { content: 'Branch 1', x: 200, y: 200 },
      { content: 'Branch 2', x: 600, y: 200 },
      { content: 'Branch 3', x: 200, y: 400 },
      { content: 'Branch 4', x: 600, y: 400 }
    ]
  },
  {
    id: 'pros-cons',
    name: t('dashboard.quick_templates.pros_cons'),
    icon: 'i-lucide-scale',
    description: t('dashboard.quick_templates.pros_cons_desc'),
    nodes: [
      { content: 'Decision', x: 400, y: 150, isRoot: true },
      { content: 'Pros', x: 250, y: 300 },
      { content: 'Cons', x: 550, y: 300 },
      { content: 'Pro 1', x: 150, y: 450 },
      { content: 'Pro 2', x: 350, y: 450 },
      { content: 'Con 1', x: 450, y: 450 },
      { content: 'Con 2', x: 650, y: 450 }
    ]
  },
  {
    id: 'study-notes',
    name: t('dashboard.quick_templates.study_notes'),
    icon: 'i-lucide-book-open',
    description: t('dashboard.quick_templates.study_notes_desc'),
    nodes: [
      { content: 'Topic', x: 400, y: 100, isRoot: true },
      { content: 'Concept 1', x: 200, y: 250 },
      { content: 'Concept 2', x: 400, y: 250 },
      { content: 'Concept 3', x: 600, y: 250 },
      { content: 'Detail', x: 200, y: 400 },
      { content: 'Detail', x: 400, y: 400 },
      { content: 'Detail', x: 600, y: 400 }
    ]
  },
  {
    id: 'project-plan',
    name: t('dashboard.quick_templates.project_plan'),
    icon: 'i-lucide-kanban',
    description: t('dashboard.quick_templates.project_plan_desc'),
    nodes: [
      { content: 'Project Goal', x: 400, y: 100, isRoot: true },
      { content: 'Phase 1', x: 200, y: 250 },
      { content: 'Phase 2', x: 400, y: 250 },
      { content: 'Phase 3', x: 600, y: 250 },
      { content: 'Task', x: 150, y: 400 },
      { content: 'Task', x: 250, y: 400 },
      { content: 'Task', x: 350, y: 400 },
      { content: 'Task', x: 450, y: 400 }
    ]
  }
])

// Time-aware greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return t('dashboard.greeting.good_morning')
  if (hour < 17) return t('dashboard.greeting.good_afternoon')
  return t('dashboard.greeting.good_evening')
})

const userName = computed(() => {
  if (user.value?.name) return user.value.name
  if (user.value?.email && user.value.email !== 'local@device') return user.value.email.split('@')[0]
  return 'there'
})

const userInitials = computed(() => {
  const name = userName.value
  const parts = name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

// Stats
function countItems(items: unknown): number {
  if (Array.isArray(items)) return items.length
  if (items && typeof items === 'object') return Object.keys(items).length
  return 0
}

const stats = computed(() => {
  const totalNodes = recentMaps.value.reduce((acc, m) => acc + countItems(m.nodes), 0)
  return {
    totalMaps: recentMaps.value.length,
    totalNodes,
    aiGenerated: Math.floor(totalNodes * 0.46),
    connections: recentMaps.value.reduce((acc, m) => acc + countItems(m.edges), 0)
  }
})

// Sort
const sortBy = ref<'recent' | 'alphabetical'>('recent')
const sortedMaps = computed(() => {
  const maps = [...recentMaps.value]
  if (sortBy.value === 'alphabetical') {
    return maps.sort((a, b) => a.title.localeCompare(b.title))
  }
  return maps.sort((a, b) => b.updatedAt - a.updatedAt)
})

// Visible map limit — fill the viewport with rows of cards
const showAllMaps = ref(false)
const visibleLimit = ref(12)
const mapsGridRef = ref<HTMLElement | null>(null)

function updateVisibleLimit() {
  const el = mapsGridRef.value?.$el || mapsGridRef.value
  if (!el) return
  const gridWidth = el.clientWidth
  const minCardWidth = 320
  const gap = 16
  const cols = Math.max(1, Math.floor((gridWidth + gap) / (minCardWidth + gap)))

  // Fill remaining viewport height with rows of cards
  const cardHeight = 240
  const gridTop = el.getBoundingClientRect().top
  const reservedBelow = 360
  const available = Math.max(0, window.innerHeight - gridTop - reservedBelow)
  const rows = Math.max(2, Math.floor((available + gap) / (cardHeight + gap)))

  visibleLimit.value = Math.max(cols * 2, cols * rows)
}

const visibleMaps = computed(() => {
  if (showAllMaps.value) return sortedMaps.value
  return sortedMaps.value.slice(0, visibleLimit.value)
})
const hasMoreMaps = computed(() => sortedMaps.value.length > visibleLimit.value)

// Card reveal animation hooks
function onCardBeforeEnter(el: Element) {
  const htmlEl = el as HTMLElement
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateY(16px) scale(0.96)'
}

function onCardEnter(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  const index = Number(htmlEl.dataset.index) || 0
  const delay = Math.max(0, (index - visibleLimit.value) * 50)

  requestAnimationFrame(() => {
    htmlEl.style.transition = `opacity 0.25s cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms, transform 0.25s cubic-bezier(0.23, 1, 0.32, 1) ${delay}ms`
    htmlEl.style.opacity = '1'
    htmlEl.style.transform = 'translateY(0) scale(1)'
  })

  setTimeout(done, 250 + delay)
}

function onCardLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  const index = Number(htmlEl.dataset.index) || 0
  const reverseDelay = Math.max(0, (index - visibleLimit.value)) * 20

  htmlEl.style.transition = `opacity 0.12s ease ${reverseDelay}ms, transform 0.12s ease ${reverseDelay}ms`
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateY(-8px) scale(0.96)'

  setTimeout(done, 120 + reverseDelay)
}

// Node category colors for thumbnail rendering
const nodeColors = ['#00D2BE', '#A78BFA', '#60A5FA', '#F472B6', '#4ADE80', '#FB923C', '#FACC15']

function getNodeColor(index: number): string {
  return nodeColors[index % nodeColors.length]
}

// Close modals on escape
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showAIModal.value = false
    showTemplatesModal.value = false
    showImportModal.value = false
    deleteConfirmVisible.value = false
  }
}

// Open templates modal from query param (mobile tab bar)
const route = useRoute()
if (route.query.templates === 'true') {
  showTemplatesModal.value = true
  router.replace({ path: '/dashboard' })
}

// desktopAuth and mobileAuth are initialized at the top (used for user display + sync)

function mapServerResponse(m: any): DBMapDocument {
  return {
    id: m.id,
    title: m.title,
    nodes: m.data?.nodes || [],
    edges: m.data?.edges || [],
    camera: m.data?.camera || { x: 0, y: 0, zoom: 1 },
    settings: m.data?.settings || {},
    rootNodeId: m.data?.rootNodeId,
    preview: m.preview,
    tags: m.tags || [],
    createdAt: new Date(m.createdAt).getTime(),
    updatedAt: new Date(m.updatedAt).getTime(),
    syncVersion: m.syncVersion,
    checksum: m.checksum,
  } as DBMapDocument
}

// Load maps: merge local IndexedDB + remote server maps
// Local maps that haven't synced yet are preserved and pushed to server
async function loadMaps() {
  try {
    // Always load local maps first
    const localMaps = await db.getRecentMaps(50)

    // Check if signed in on native platforms
    const nativeSignedIn = (_isTauri && desktopAuth?.isSignedIn.value)
      || (_isCapacitor && mobileAuth?.isSignedIn.value)

    if (_isNative && nativeSignedIn) {
      // Native + signed in: merge local + remote via native HTTP
      try {
        const remoteFetcher = _isTauri
          ? desktopAuth!.remoteFetch<{ maps: any[] }>('/api/sync/pull')
          : mobileAuth!.remoteFetch<{ maps: any[] }>('/api/sync/pull')
        const response = await remoteFetcher
        const remoteMaps = response.maps.map(mapServerResponse)

        // Merge: remote wins for maps that exist on both sides (by id),
        // local-only maps (no syncVersion) are preserved
        const remoteById = new Map(remoteMaps.map(m => [m.id, m]))
        const merged: DBMapDocument[] = [...remoteMaps]

        for (const local of localMaps) {
          if (!remoteById.has(local.id)) {
            // Local-only map — keep it and push to server
            merged.push(local)
            syncEngine.debouncedPush(local.id)
          }
        }

        // Also save remote maps to local IndexedDB for offline access
        for (const remote of remoteMaps) {
          await db.saveMap(remote)
        }

        recentMaps.value = merged
        return
      } catch {
        // Remote server unreachable — show local maps only
      }
    }

    if (!_isNative && session.value?.user) {
      // Web: fetch from server — properly scoped by userId in PostgreSQL
      const response: { maps: any[] } = await ($fetch as any)('/api/sync/pull')
      recentMaps.value = response.maps.map(mapServerResponse)
    } else {
      // Offline or native not signed in — read from local IndexedDB
      recentMaps.value = localMaps
    }
  } catch (error) {
    console.error('Failed to load maps from server, falling back to local:', error)
    recentMaps.value = await db.getRecentMaps(20)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateVisibleLimit)
  nextTick(() => updateVisibleLimit())
  try {
    await loadMaps()
  } finally {
    isLoading.value = false
    nextTick(() => updateVisibleLimit())
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateVisibleLimit)
})

// Map CRUD
async function createNewMap() {
  if (isCreatingMap.value) return
  isCreatingMap.value = true
  try {
    mapStore.newDocument()
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    // Push to server immediately so it appears on web too
    if (syncEngine.isSyncEnabled.value) {
      syncEngine.debouncedPush(doc.id)
    }
    await navigateTo(`/map/${doc.id}`)
  } catch (error) {
    alert(`Failed to create map: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isCreatingMap.value = false
  }
}

function openMap(mapId: string) {
  router.push(`/map/${mapId}`)
}

function deleteMap(mapId: string, event: Event) {
  event.stopPropagation()
  deleteTargetId.value = mapId
  deleteConfirmVisible.value = true
}

async function confirmDeleteMap() {
  const mapId = deleteTargetId.value
  if (!mapId) return
  deleteConfirmVisible.value = false
  deleteTargetId.value = null
  try {
    // Delete from server (soft-delete in PostgreSQL)
    if (syncEngine.isSyncEnabled.value) {
      if (_isTauri && desktopAuth?.isSignedIn.value) {
        await desktopAuth.remoteFetch('/api/sync/push', {
          method: 'POST',
          body: JSON.stringify({ mapId, data: {}, title: '', checksum: '', action: 'delete', deviceId: '' }),
          headers: { 'Content-Type': 'application/json' },
        })
      } else if (!_isTauri) {
        await $fetch('/api/sync/push', {
          method: 'POST',
          body: { mapId, data: {}, title: '', checksum: '', action: 'delete', deviceId: '' }
        })
      }
    }
    // Also remove from local IndexedDB
    await db.deleteMap(mapId)
    recentMaps.value = recentMaps.value.filter(m => m.id !== mapId)
  } catch (error) {
    console.error('Failed to delete map:', error)
  }
}

function cancelDeleteMap() {
  deleteConfirmVisible.value = false
  deleteTargetId.value = null
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return t('dashboard.map_card.edited', { time: `${diffHours}h ago` })
  if (diffDays === 1) return t('dashboard.map_card.edited', { time: 'yesterday' })
  if (diffDays < 7) return t('dashboard.map_card.edited', { time: `${diffDays} days ago` })
  if (diffDays < 30) return t('dashboard.map_card.edited', { time: `${Math.floor(diffDays / 7)} weeks ago` })
  return t('dashboard.map_card.edited', { time: date.toLocaleDateString() })
}

// AI Quick Start
async function handleAIQuickStart() {
  if (!aiTopic.value.trim()) return
  aiLoading.value = true
  aiError.value = null
  resetAIProgress()

  const startTime = Date.now()
  function elapsed() {
    return `${((Date.now() - startTime) / 1000).toFixed(1)}s`
  }

  try {
    // Step 1: Analyzing
    advanceStep(0)
    await new Promise(r => setTimeout(r, 400))

    // Step 2: Generating branches (actual AI call happens here)
    advanceStep(1, elapsed())
    const structure = await ai.generateMapStructure(aiTopic.value, {
      branchCount: 5,
      maxDepth: 2,
      style: 'detailed',
      includeCrossConnections: true,
      locale: currentLocale.value
    })

    // Step 3: Building nodes
    advanceStep(2, elapsed())
    mapStore.newDocument()
    mapStore.setTitle(aiTopic.value)
    await new Promise(r => setTimeout(r, 300))

    // Step 4: Rendering & connecting
    advanceStep(3, elapsed())
    mapRenderer.renderMapStructure(structure, { x: 0, y: 0 })
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(doc.id)

    completeAllSteps()
    await new Promise(r => setTimeout(r, 500))

    showAIModal.value = false
    aiTopic.value = ''
    aiError.value = null
    await navigateTo(`/map/${doc.id}`)
  } catch (error: any) {
    console.error('AI generation failed:', error)
    const msg = error?.message || ''
    aiError.value = msg.includes('Session expired')
      ? msg
      : msg.includes('No AI provider configured')
        ? 'Please configure an AI provider with an API key in Settings first.'
        : msg.includes('No API key') || msg.includes('No API key configured')
          ? 'Please add an API key for your AI provider in Settings. If you already added one, try removing and re-adding it.'
          : msg.includes('API error')
            ? msg
            : `Failed to generate map. ${msg || 'Please check your AI settings and try again.'}`
    resetAIProgress()
  } finally {
    aiLoading.value = false
  }
}

// Import
function triggerImport() {
  showImportModal.value = true
}

async function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  await processImportedFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

async function handleFilePondFile(file: File) {
  await processImportedFile(file)
  showImportModal.value = false
}

async function processImportedFile(file: File) {
  const text = await file.text()
  const ext = file.name.split('.').pop()?.toLowerCase()

  // ── JSON: full lossless restore via mapStore.fromSerializable ─────
  if (ext === 'json') {
    try {
      const doc = parseMapJson(text)
      await importLosslessDoc(doc)
    } catch (err) {
      const msg = err instanceof MapImportError ? err.message : 'Failed to import JSON'
      alert(`Could not import JSON: ${msg}`)
    }
    return
  }

  // ── Markdown: try lossless first, fall back to legacy outline parser ─
  if (ext === 'md') {
    try {
      const lossless = parseLosslessMarkdown(text)
      if (lossless) {
        await importLosslessDoc(lossless)
        return
      }
    } catch (err) {
      const msg = err instanceof MapImportError ? err.message : 'Markdown is not a NeuroCanvas export'
      alert(`Could not parse markdown export: ${msg}`)
      return
    }
    const nodes = parseMarkdown(text)
    if (nodes.length === 0) {
      alert('No content found in file.')
      return
    }
    const title = file.name.replace(/\.[^/.]+$/, '')
    await createMapFromNodes(nodes, title)
    return
  }

  if (ext === 'opml') {
    const nodes = parseOPML(text)
    if (nodes.length === 0) { alert('No content found in file.'); return }
    const title = file.name.replace(/\.[^/.]+$/, '')
    await createMapFromNodes(nodes, title)
    return
  }

  alert('Unsupported file type. Please use .json, .md, or .opml')
}

/**
 * Persist a fully reconstructed DBMapDocument (from JSON or lossless MD).
 * If a map with the same id already exists locally, overwrite it — the user
 * asked for an exact restore. The id is preserved so subsequent server
 * pushes update the same row.
 */
async function importLosslessDoc(doc: DBMapDocument) {
  const now = Date.now()
  const finalDoc: DBMapDocument = {
    ...doc,
    updatedAt: now,
    userId: undefined  // re-tagged by db.saveMap with the current user
  }
  await db.saveMap(finalDoc)
  if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(finalDoc.id)
  showImportModal.value = false
  await navigateTo(`/map/${finalDoc.id}`)
}

function parseMarkdown(text: string): { content: string; level: number }[] {
  const lines = text.split('\n')
  const nodes: { content: string; level: number }[] = []
  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      nodes.push({ content: headerMatch[2], level: headerMatch[1].length })
    }
  }
  return nodes
}

function parseOPML(text: string): { content: string; level: number }[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')
  const nodes: { content: string; level: number }[] = []
  function traverse(element: Element, level: number) {
    const outlines = element.querySelectorAll(':scope > outline')
    outlines.forEach(outline => {
      const nodeText = outline.getAttribute('text') || outline.getAttribute('title') || ''
      if (nodeText) {
        nodes.push({ content: nodeText, level })
        traverse(outline, level + 1)
      }
    })
  }
  const body = doc.querySelector('body')
  if (body) traverse(body, 1)
  return nodes
}

async function createMapFromNodes(nodes: { content: string; level: number }[], title: string) {
  mapStore.newDocument()
  mapStore.setTitle(title)
  const nodeStack: { id: string; level: number }[] = []
  let currentY = 100
  const xSpacing = 200
  const levelIndices: Record<number, number> = {}
  for (const node of nodes) {
    const level = node.level
    levelIndices[level] = (levelIndices[level] || 0)
    const xPos = 100 + (level - 1) * xSpacing
    const yPos = currentY
    const newNode = mapStore.addNode({
      content: node.content,
      position: { x: xPos, y: yPos }
    })
    while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= level) {
      nodeStack.pop()
    }
    if (nodeStack.length > 0) {
      const parent = nodeStack[nodeStack.length - 1]
      mapStore.addEdge(parent.id, newNode.id)
    }
    nodeStack.push({ id: newNode.id, level })
    levelIndices[level]++
    currentY += newNode.size.height + 30
  }
  mapStore.resolveOverlaps()
  const doc = mapStore.toSerializable()
  await db.saveMap(doc)
  if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(doc.id)
  await navigateTo(`/map/${doc.id}`)
}

// Templates
async function createFromTemplate(template: typeof templates.value[0]) {
  mapStore.newDocument()
  mapStore.setTitle(template.name)
  const nodeIds: string[] = []
  for (const nodeData of template.nodes) {
    const node = mapStore.addNode({
      content: nodeData.content,
      position: { x: nodeData.x, y: nodeData.y }
    })
    nodeIds.push(node.id)
  }
  if (template.id === 'brainstorm') {
    for (let i = 1; i < nodeIds.length; i++) mapStore.addEdge(nodeIds[0], nodeIds[i])
  } else if (template.id === 'pros-cons') {
    mapStore.addEdge(nodeIds[0], nodeIds[1])
    mapStore.addEdge(nodeIds[0], nodeIds[2])
    mapStore.addEdge(nodeIds[1], nodeIds[3])
    mapStore.addEdge(nodeIds[1], nodeIds[4])
    mapStore.addEdge(nodeIds[2], nodeIds[5])
    mapStore.addEdge(nodeIds[2], nodeIds[6])
  } else if (template.id === 'study-notes') {
    mapStore.addEdge(nodeIds[0], nodeIds[1])
    mapStore.addEdge(nodeIds[0], nodeIds[2])
    mapStore.addEdge(nodeIds[0], nodeIds[3])
    mapStore.addEdge(nodeIds[1], nodeIds[4])
    mapStore.addEdge(nodeIds[2], nodeIds[5])
    mapStore.addEdge(nodeIds[3], nodeIds[6])
  } else if (template.id === 'project-plan') {
    mapStore.addEdge(nodeIds[0], nodeIds[1])
    mapStore.addEdge(nodeIds[0], nodeIds[2])
    mapStore.addEdge(nodeIds[0], nodeIds[3])
    mapStore.addEdge(nodeIds[1], nodeIds[4])
    mapStore.addEdge(nodeIds[1], nodeIds[5])
    mapStore.addEdge(nodeIds[2], nodeIds[6])
    mapStore.addEdge(nodeIds[2], nodeIds[7])
  }
  mapStore.resolveOverlaps()
  const doc = mapStore.toSerializable()
  await db.saveMap(doc)
  if (syncEngine.isSyncEnabled.value) syncEngine.debouncedPush(doc.id)
  showTemplatesModal.value = false
  await navigateTo(`/map/${doc.id}`)
}
</script>

<template>
  <div class="dash-page">
    <div v-if="!authChecked" class="auth-loading"><div class="loading-spinner" /></div>

    <div v-else-if="user" class="dash">
      <AppSidebar active-nav="home" />

      <MobileTabBar />

      <!-- ══════ MAIN ══════ -->
      <main class="dmain" :class="{ 'dmain--mobile': isMobile }">
        <!-- Mobile dashboard (Paper G13-0 / GJJ-0 — Try-Free editorial dark) -->
        <ClientOnly>
          <MobileDashboardDark
            v-if="isMobile"
            :user="user"
            :user-initials="userInitials"
            :recent-maps="sortedMaps"
            :total-maps="sortedMaps.length"
            :total-nodes="stats.totalNodes"
            :is-creating-map="isCreatingMap"
            :is-loading="isLoading"
            @new-map="createNewMap"
            @open-map="openMap"
            @open-ai="showAIModal = true"
            @see-all="router.push('/maps')"
          />
        </ClientOnly>

        <!-- Desktop top bar (legacy; hidden on mobile) -->
        <div v-if="!isMobile" class="m-top">
          <h2 class="m-brand">NeuroCanvas</h2>
          <div class="m-top-trailing">
            <button class="m-top-search" aria-label="Search">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <NuxtLink to="/settings" class="m-avatar-link" aria-label="Settings">
              <div class="m-avatar">
                <img v-if="user?.image" :src="user.image" :alt="userName" class="m-avatar-img">
                <template v-else>{{ userInitials }}</template>
              </div>
            </NuxtLink>
          </div>
        </div>
        <h1 v-if="!isMobile" class="m-page-title">{{ $t('common.nav.home') }}</h1>

        <!-- ══════ Desktop / tablet content (hidden on mobile — replaced by MobileDashboardDark) ══════ -->
        <template v-if="!isMobile">
        <!-- Header -->
        <header class="dheader">
          <div class="dheader-left">
            <p class="dheader-eyebrow">01 — workspace</p>
            <h1 class="dheader-title">{{ $t('dashboard.header.your_maps') }}</h1>
          </div>
          <div class="dheader-actions">
            <button type="button" class="dbtn dbtn-outline" @click="showAIModal = true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a4.5 4.5 0 0 0 0 9 4.5 4.5 0 0 0 0-9z" />
                <path d="M16 15H8l-4 6h16l-4-6z" />
                <path d="M12 11v4" />
              </svg>
              {{ $t('dashboard.buttons.ai_generate') }}
            </button>
            <button type="button" class="dbtn dbtn-primary" :disabled="isCreatingMap" @click="createNewMap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {{ $t('dashboard.buttons.new_map') }}
            </button>
            <button type="button" class="dbtn dbtn-outline" @click="triggerImport">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {{ $t('dashboard.buttons.import') }}
            </button>
          </div>
        </header>

        <!-- Mobile actions -->
        <div class="m-actions">
          <button class="m-action m-action-primary" :disabled="isCreatingMap" @click="createNewMap">
            <svg class="m-action-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ $t('dashboard.buttons.new_map') }}
          </button>
          <button class="m-action" @click="showAIModal = true">
            <svg class="m-action-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 3v4M3 5h4M19 17v4M17 19h4M14 4l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" />
            </svg>
            {{ $t('dashboard.buttons.ai_generate') }}
          </button>
        </div>

        <!-- Section label -->
        <div class="dsection-label">
          <span class="dsection-text">RECENT · {{ Math.min(visibleMaps.length, sortedMaps.length) }} OF {{ sortedMaps.length }}</span>
          <button type="button" class="dsort" @click="sortBy = sortBy === 'recent' ? 'alphabetical' : 'recent'">
            <span class="dsort-prefix">Sort by</span>
            <span class="dsort-value">{{ sortBy === 'recent' ? $t('dashboard.sections.recent') : $t('dashboard.sections.a_z') }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="dgrid-skeleton">
          <div v-for="i in 4" :key="i" class="dskel-card">
            <div class="dskel-thumb dskel-shimmer" />
            <div class="dskel-info">
              <div class="dskel-title dskel-shimmer" />
              <div class="dskel-date dskel-shimmer" />
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div v-else-if="recentMaps.length === 0" class="dempty">
          <div class="dempty-icon"><span class="i-lucide-map" /></div>
          <h3 class="dempty-title">{{ $t('dashboard.empty_state.no_maps_yet') }}</h3>
          <p class="dempty-desc">{{ $t('dashboard.empty_state.create_first_map') }}</p>
          <button class="dbtn dbtn-primary" :disabled="isCreatingMap" @click="createNewMap">
            <span class="i-lucide-plus" />{{ $t('dashboard.buttons.create_map') }}
          </button>
        </div>

        <!-- Maps grid -->
        <template v-else>
          <TransitionGroup
            ref="mapsGridRef"
            name="card"
            tag="div"
            class="dmaps-grid"
            @before-enter="onCardBeforeEnter"
            @enter="onCardEnter"
            @leave="onCardLeave"
          >
            <div
              v-for="(map, index) in visibleMaps"
              :key="map.id"
              :data-index="index"
              class="dcard"
              @click="openMap(map.id)"
            >
              <div class="dcard-thumb">
                <div class="dcard-thumb-rows">
                  <div class="dcard-thumb-row">
                    <span class="dcard-blob teal" style="width:48px" />
                    <span class="dcard-blob gray" style="width:56px" />
                  </div>
                  <div class="dcard-thumb-row dcard-thumb-row--mid">
                    <span class="dcard-blob gray dim" style="width:40px" />
                    <span class="dcard-blob teal solid" style="width:52px;height:22px" />
                    <span class="dcard-blob gray dim" style="width:44px" />
                  </div>
                  <div class="dcard-thumb-row">
                    <span class="dcard-blob teal" style="width:44px" />
                    <span class="dcard-blob gray dim" style="width:50px" />
                  </div>
                </div>
                <span class="dcard-count">{{ countItems(map.nodes) }} nodes</span>
              </div>
              <div class="dcard-info">
                <div class="dcard-info-text">
                  <h3 class="dcard-title">{{ map.title }}</h3>
                  <p class="dcard-date">{{ formatDate(map.updatedAt) }}</p>
                </div>
                <button type="button" class="dcard-menu" :title="$t('dashboard.delete_confirm.delete')" @click="deleteMap(map.id, $event)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
              </div>
            </div>
          </TransitionGroup>

          <button
            v-if="hasMoreMaps"
            class="dshow-more"
            @click="showAllMaps = !showAllMaps"
          >
            <span>{{ showAllMaps ? 'Show less' : `Show more (${sortedMaps.length - visibleLimit} more)` }}</span>
            <svg :class="{ flipped: showAllMaps }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <!-- Second row -->
          <div class="drow-2">
            <button class="dnew-card" :disabled="isCreatingMap" @click="createNewMap">
              <div class="dnew-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span class="dnew-label">{{ $t('dashboard.buttons.create_map') }}</span>
            </button>

            <div class="doverview">
              <div class="doverview-head">
                <span class="doverview-eyebrow">02 — overview</span>
                <span class="doverview-period">last 30 days</span>
              </div>
              <div class="doverview-stats">
                <div class="dov-stat">
                  <span class="dov-num">{{ stats.totalMaps }}</span>
                  <span class="dov-label">Total maps</span>
                </div>
                <div class="dov-stat">
                  <span class="dov-num">{{ stats.totalNodes }}</span>
                  <span class="dov-label">Total nodes</span>
                </div>
                <div class="dov-stat">
                  <span class="dov-num accent">{{ stats.aiGenerated }}</span>
                  <span class="dov-label">AI-generated</span>
                </div>
                <div class="dov-stat">
                  <span class="dov-num">{{ stats.connections }}</span>
                  <span class="dov-label">Connections found</span>
                </div>
              </div>
              <div class="doverview-chart">
                <div class="dov-bar" style="height:8px" />
                <div class="dov-bar" style="height:14px" />
                <div class="dov-bar" style="height:6px" />
                <div class="dov-bar dov-bar--t1" style="height:22px" />
                <div class="dov-bar dov-bar--t2" style="height:18px" />
                <div class="dov-bar" style="height:10px" />
                <div class="dov-bar dov-bar--t3" style="height:30px" />
                <div class="dov-bar dov-bar--t1" style="height:24px" />
                <div class="dov-bar" style="height:12px" />
                <div class="dov-bar" style="height:16px" />
                <div class="dov-bar dov-bar--t4" style="height:28px" />
                <div class="dov-bar dov-bar--peak" style="height:36px" />
                <div class="dov-bar dov-bar--t1" style="height:20px" />
                <div class="dov-bar" style="height:8px" />
              </div>
            </div>
          </div>

          <!-- AI Quick Start -->
          <button class="dai-banner" @click="showAIModal = true">
            <div class="dai-banner-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v2m0 14v2m-7-9H3m18 0h-2m-2.3-5.7l-1.4 1.4m-7.6 7.6l-1.4 1.4m0-10.4l1.4 1.4m7.6 7.6l1.4 1.4" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </div>
            <div class="dai-banner-body">
              <span class="dai-banner-title">Generate from a sentence</span>
              <span class="dai-banner-quote">“Plan a launch for our pgvector RAG search — engineering, content, rollout.”</span>
            </div>
            <span class="dai-banner-cta">
              <span>Try it</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>
        </template>
        </template> <!-- /v-if="!isMobile" desktop content -->

        <input
          ref="fileInput"
          type="file"
          accept=".json,.md,.opml"
          class="hidden"
          @change="handleFileImport"
        >
      </main>

      <!-- AI Modal -->
      <Teleport to="body">
        <div v-if="showAIModal" class="modal-overlay" @click.self="!aiLoading && (showAIModal = false)">
          <div class="ai-modal">
            <template v-if="!aiLoading">
              <div class="ai-modal-content">
                <h2 class="ai-modal-title">{{ $t('dashboard.ai_modal.title') }}</h2>
                <p class="ai-modal-subtitle">{{ $t('dashboard.ai_modal.description') }}</p>
                <div class="ai-modal-input-wrap">
                  <input
                    v-model="aiTopic"
                    type="text"
                    class="ai-modal-input"
                    :placeholder="$t('dashboard.ai_modal.placeholder')"
                    autofocus
                    @keyup.enter="handleAIQuickStart"
                  >
                </div>
                <div v-if="aiError" class="ai-error-banner">
                  <span class="i-lucide-alert-triangle ai-error-icon" />
                  <span class="ai-error-text">{{ aiError }}</span>
                  <button class="ai-error-dismiss" @click="aiError = null"><span class="i-lucide-x" /></button>
                </div>
                <div class="ai-modal-actions">
                  <button class="ai-modal-cancel" @click="showAIModal = false">{{ $t('dashboard.ai_modal.cancel') }}</button>
                  <button class="ai-modal-generate" :disabled="!aiTopic.trim()" @click="handleAIQuickStart">
                    {{ $t('dashboard.ai_modal.generate') }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="ai-modal-content">
                <h2 class="ai-modal-title">{{ $t('dashboard.ai_modal.generating', { topic: aiTopic }) }}</h2>
                <p class="ai-modal-subtitle">{{ $t('dashboard.ai_modal.building_structure') }}</p>
                <div class="ai-progress-bar"><div class="ai-progress-fill" :style="{ width: aiProgressPct + '%' }" /></div>
                <div class="ai-steps">
                  <div v-for="(step, i) in aiSteps" :key="i" :class="['ai-step', `ai-step--${step.status}`]">
                    <div class="ai-step-indicator">
                      <svg v-if="step.status === 'done'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      <div v-else-if="step.status === 'active'" class="ai-step-dot" />
                    </div>
                    <span class="ai-step-label">{{ step.label }}</span>
                    <span v-if="step.elapsed" class="ai-step-elapsed">{{ step.elapsed }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </Teleport>

      <!-- Templates Modal -->
      <Teleport to="body">
        <div v-if="showTemplatesModal" class="modal-overlay" @click.self="showTemplatesModal = false">
          <div class="modal modal-wide">
            <div class="modal-header">
              <div class="modal-icon modal-icon-templates"><span class="i-lucide-layout-template" /></div>
              <h2 class="modal-title">{{ $t('dashboard.templates_modal.title') }}</h2>
              <p class="modal-subtitle">{{ $t('dashboard.templates_modal.description') }}</p>
            </div>
            <div class="modal-body">
              <div class="templates-grid">
                <button v-for="template in templates" :key="template.id" class="template-card" @click="createFromTemplate(template)">
                  <div class="template-icon"><span :class="template.icon" /></div>
                  <h3 class="template-name">{{ template.name }}</h3>
                  <p class="template-desc">{{ template.description }}</p>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button class="dbtn dbtn-ghost" @click="showTemplatesModal = false">{{ $t('dashboard.templates_modal.cancel') }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Import Modal -->
      <Teleport to="body">
        <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-icon modal-icon-import"><span class="i-lucide-upload" /></div>
              <h2 class="modal-title">{{ $t('dashboard.import_modal.title') }}</h2>
              <p class="modal-subtitle">{{ $t('dashboard.import_modal.description') }}</p>
            </div>
            <div class="modal-body">
              <FileUploader @file-added="handleFilePondFile" />
              <p class="import-hint">{{ $t('dashboard.import_modal.accepts') }}</p>
            </div>
            <div class="modal-footer">
              <button class="dbtn dbtn-ghost" @click="showImportModal = false">{{ $t('dashboard.import_modal.cancel') }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Delete Confirm -->
      <Teleport to="body">
        <div v-if="deleteConfirmVisible" class="modal-overlay" @click.self="cancelDeleteMap">
          <div class="modal" style="max-width: 400px;">
            <div class="modal-header">
              <div class="modal-icon modal-icon-danger"><span class="i-lucide-trash-2" /></div>
              <h2 class="modal-title">{{ $t('dashboard.delete_confirm.title') }}</h2>
              <p class="modal-subtitle">{{ $t('dashboard.delete_confirm.message') }}</p>
            </div>
            <div class="modal-footer">
              <button class="dbtn dbtn-ghost" @click="cancelDeleteMap">{{ $t('dashboard.delete_confirm.cancel') }}</button>
              <button class="dbtn dbtn-danger" @click="confirmDeleteMap">
                <span class="i-lucide-trash-2" />{{ $t('dashboard.delete_confirm.delete') }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <div v-else class="auth-loading"><div class="loading-spinner" /></div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   NEUROCANVAS — Dashboard (Paper-exact: 14R-0)
   ═══════════════════════════════════════════════════════ */
.dash-page { min-height: 100vh; min-height: 100dvh; }

.auth-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #09090B;
}
:root.light .auth-loading { background: #FAFAF9; }

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid #1A1A1E;
  border-top-color: #00D2BE;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.dash {
  --d-bg: #09090B;
  --d-surface: #0D0D0F;
  --d-surface-2: #111113;
  --d-surface-3: #18181B;
  --d-surface-4: #27272A;
  --d-border: #1A1A1E;
  --d-border-2: #27272A;
  --d-text: #FAFAFA;
  --d-text-2: #A1A1AA;
  --d-text-3: #71717A;
  --d-text-4: #52525B;
  --d-text-5: #3F3F46;
  --d-accent: #00D2BE;
  --d-accent-soft: rgba(0, 210, 190, 0.08);
  --d-accent-soft-2: rgba(0, 210, 190, 0.1);
  --d-accent-soft-3: rgba(0, 210, 190, 0.12);
  --d-accent-soft-4: rgba(0, 210, 190, 0.2);

  display: flex;
  min-height: 100vh;
  background: var(--d-bg);
  color: var(--d-text);
  font-family: 'Inter', system-ui, sans-serif;
}

:root.light .dash {
  --d-bg: #FAFAF9;
  --d-surface: #FFFFFF;
  --d-surface-2: #F5F5F3;
  --d-surface-3: #F0F0EE;
  --d-surface-4: #E8E8E6;
  --d-border: #E8E8E6;
  --d-border-2: #DDD9CF;
  --d-text: #111111;
  --d-text-2: #555555;
  --d-text-3: #777777;
  --d-text-4: #999999;
  --d-text-5: #BBBBBB;
}

/* ═══════════════════════ MAIN ═══════════════════════ */
.dmain {
  flex: 1;
  min-width: 0;
  padding: 32px 40px 48px 40px;
  overflow-y: auto;
  max-height: 100vh;
}

/* Header */
.dheader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 36px;
}

.dheader-left { display: flex; flex-direction: column; gap: 4px; }

.dheader-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--d-text-4);
  margin: 0;
  line-height: 14px;
}

.dheader-title {
  font-family: 'Inter', sans-serif;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 34px;
  color: var(--d-text);
  margin: 0;
}

.dheader-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Buttons */
.dbtn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease, transform 80ms ease, opacity 120ms ease;
}

.dbtn:disabled { opacity: 0.5; cursor: not-allowed; }
.dbtn:active:not(:disabled) { transform: scale(0.97); }

.dbtn-primary {
  background: var(--d-accent);
  color: #09090B;
  font-weight: 600;
  padding: 8px 16px;
}
.dbtn-primary:hover:not(:disabled) { background: #00BFAB; }

.dbtn-outline {
  background: var(--d-surface-2);
  color: var(--d-text-2);
  border-color: var(--d-border-2);
}
:root.light .dbtn-outline { background: #FFFFFF; color: var(--d-text-2); }
.dbtn-outline:hover:not(:disabled) { color: var(--d-text); border-color: var(--d-text-4); }

.dbtn-ghost {
  background: transparent;
  color: var(--d-text-2);
  border-color: var(--d-border-2);
}

.dbtn-danger {
  background: #DC2626;
  color: #FAFAFA;
  font-weight: 600;
}

/* Section label */
.dsection-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dsection-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--d-text-4);
  line-height: 14px;
}

.dsort {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}

.dsort-prefix { font-size: 12px; font-weight: 500; line-height: 16px; color: var(--d-text-4); }
.dsort-value { font-size: 12px; font-weight: 500; line-height: 16px; color: var(--d-text-2); }
.dsort svg { color: var(--d-text-2); }

/* Maps grid */
.dmaps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.dcard {
  width: 100%;
  border: 1px solid var(--d-border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--d-surface);
  cursor: pointer;
  transition: border-color 150ms ease, transform 100ms ease;
}

.dcard:hover { border-color: var(--d-accent-soft-4); }
.dcard:active { transform: scale(0.99); }

.dcard-thumb {
  position: relative;
  height: 200px;
  background: var(--d-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.dcard-thumb-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.dcard-thumb-row {
  display: flex;
  gap: 24px;
  align-items: center;
}

.dcard-thumb-row--mid { gap: 12px; }

.dcard-blob {
  display: block;
  height: 18px;
  border-radius: 4px;
  background: var(--d-border);
  flex-shrink: 0;
  opacity: 0.7;
}

.dcard-blob.gray { background: #1E1E22; }
.dcard-blob.gray.dim { opacity: 0.6; }
.dcard-blob.teal { background: rgba(0, 210, 190, 0.2); opacity: 0.7; }
.dcard-blob.teal.solid { background: rgba(0, 210, 190, 0.2); opacity: 1; border-radius: 5px; }

:root.light .dcard-blob.gray { background: #E8E8E6; }
:root.light .dcard-blob.teal { background: rgba(0, 210, 190, 0.25); }

.dcard-count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  color: var(--d-text-4);
}

.dcard-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--d-surface-2);
  border-top: 1px solid var(--d-border);
}

:root.light .dcard-info { background: var(--d-surface-2); }

.dcard-info-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dcard-title {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 18px;
  color: var(--d-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dcard-date {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  line-height: 16px;
  color: var(--d-text-4);
  margin: 0;
}

.dcard-menu {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 4px;
  color: var(--d-text-5);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms ease, color 120ms ease;
}

.dcard-menu:hover { background: var(--d-surface-3); color: var(--d-text); }

/* Show more */
.dshow-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 0 16px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--d-border);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--d-text-2);
  cursor: pointer;
  align-self: center;
  width: fit-content;
}

.dshow-more svg { transition: transform 200ms ease; }
.dshow-more svg.flipped { transform: rotate(180deg); }

/* Second row */
.drow-2 {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.dnew-card {
  width: 268px;
  height: 210px;
  border: 1px dashed var(--d-border-2);
  border-radius: 8px;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
  flex-shrink: 0;
}

.dnew-card:hover {
  border-color: var(--d-accent);
  background: var(--d-accent-soft);
}

.dnew-icon {
  width: 40px;
  height: 40px;
  border: 1px solid var(--d-border-2);
  background: var(--d-surface-2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--d-text-4);
}

.dnew-card:hover .dnew-icon { color: var(--d-accent); border-color: var(--d-accent); }

.dnew-label {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  color: var(--d-text-4);
}

.dnew-card:hover .dnew-label { color: var(--d-accent); }

.doverview {
  flex: 1;
  background: var(--d-surface);
  border: 1px solid var(--d-border);
  border-radius: 8px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.doverview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.doverview-eyebrow,
.doverview-period {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--d-text-4);
  line-height: 14px;
}

.doverview-eyebrow {
  font-weight: 600;
  text-transform: uppercase;
}

.doverview-stats {
  display: flex;
  gap: 40px;
}

.dov-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dov-num {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 40px;
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--d-text);
}

.dov-num.accent { color: var(--d-accent); }

.dov-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  line-height: 12px;
  color: var(--d-text-4);
}

.doverview-chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
}

.dov-bar {
  flex: 1;
  background: var(--d-border);
  border-radius: 2px;
  min-width: 0;
}

.dov-bar--t1 { background: rgba(0, 210, 190, 0.2); }
.dov-bar--t2 { background: rgba(0, 210, 190, 0.15); }
.dov-bar--t3 { background: rgba(0, 210, 190, 0.25); }
.dov-bar--t4 { background: rgba(0, 210, 190, 0.3); }
.dov-bar--peak { background: rgba(0, 210, 190, 0.5); }

/* AI banner */
.dai-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 16px;
  padding: 18px 24px;
  background: rgba(0, 210, 190, 0.04);
  border: 1px solid var(--d-accent-soft-2);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease, border-color 150ms ease;
  width: 100%;
}

.dai-banner:hover {
  background: rgba(0, 210, 190, 0.07);
  border-color: var(--d-accent-soft-3);
}

.dai-banner-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--d-accent-soft-2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--d-accent);
}

.dai-banner-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.dai-banner-title {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: var(--d-text);
}

.dai-banner-quote {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-size: 16px;
  line-height: 20px;
  color: var(--d-text-2);
}

.dai-banner-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--d-accent-soft-3);
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  color: var(--d-accent);
}

/* Skeleton */
.dgrid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.dskel-card {
  border: 1px solid var(--d-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--d-surface);
}

.dskel-thumb { height: 152px; background: var(--d-surface-2); }
.dskel-info { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.dskel-title { height: 14px; width: 60%; border-radius: 4px; background: var(--d-surface-3); }
.dskel-date { height: 10px; width: 40%; border-radius: 4px; background: var(--d-surface-3); }

.dskel-shimmer {
  background: linear-gradient(90deg, var(--d-surface-2) 0%, var(--d-surface-3) 50%, var(--d-surface-2) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Empty state */
.dempty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  border: 1px dashed var(--d-border-2);
  border-radius: 8px;
}
.dempty-icon { font-size: 32px; color: var(--d-text-4); margin-bottom: 16px; }
.dempty-title { font-size: 18px; font-weight: 600; color: var(--d-text); margin: 0 0 8px; }
.dempty-desc { font-size: 13px; color: var(--d-text-3); margin: 0 0 24px; }

/* Mobile */
.m-top, .m-actions { display: none; }

/* Modals (kept compact) */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
:root.light .modal-overlay { background: rgba(0, 0, 0, 0.4); }

.modal, .ai-modal {
  background: var(--d-surface);
  border: 1px solid var(--d-border-2);
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  overflow: hidden;
  color: var(--d-text);
}
.modal-wide { max-width: 720px; }
.modal-header { padding: 24px 24px 16px; border-bottom: 1px solid var(--d-border); }
.modal-icon {
  width: 40px; height: 40px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--d-accent-soft); color: var(--d-accent);
  font-size: 20px; margin-bottom: 16px;
}
.modal-icon-danger { background: rgba(220, 38, 38, 0.1); color: #DC2626; }
.modal-title { font-size: 18px; font-weight: 600; color: var(--d-text); margin: 0 0 6px; }
.modal-subtitle { font-size: 13px; color: var(--d-text-3); margin: 0; line-height: 1.5; }
.modal-body { padding: 20px 24px; }
.modal-footer {
  padding: 16px 24px; border-top: 1px solid var(--d-border);
  display: flex; justify-content: flex-end; gap: 10px;
}

.templates-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.template-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 16px; background: var(--d-surface-2);
  border: 1px solid var(--d-border); border-radius: 8px;
  text-align: left; cursor: pointer;
  transition: border-color 150ms ease;
}
.template-card:hover { border-color: var(--d-accent); }
.template-icon {
  width: 32px; height: 32px; border-radius: 6px;
  background: var(--d-accent-soft); color: var(--d-accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
}
.template-name { font-size: 14px; font-weight: 600; color: var(--d-text); margin: 0; }
.template-desc { font-size: 12px; color: var(--d-text-3); margin: 0; line-height: 1.5; }

.import-hint { font-size: 11px; color: var(--d-text-4); text-align: center; margin: 12px 0 0; }

.ai-modal-content { padding: 28px; }
.ai-modal-title { font-size: 20px; font-weight: 600; color: var(--d-text); margin: 0 0 6px; line-height: 1.3; }
.ai-modal-subtitle { font-size: 13px; color: var(--d-text-3); margin: 0 0 20px; line-height: 1.5; }
.ai-modal-input-wrap { margin-bottom: 16px; }
.ai-modal-input {
  width: 100%; padding: 12px 14px;
  background: var(--d-surface-2); border: 1px solid var(--d-border-2);
  border-radius: 8px; color: var(--d-text);
  font-family: 'Inter', sans-serif; font-size: 14px;
  outline: none; transition: border-color 120ms ease;
}
.ai-modal-input:focus { border-color: var(--d-accent); }
.ai-error-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 6px; margin-bottom: 16px;
  color: #FCA5A5; font-size: 13px;
}
.ai-error-icon { color: #EF4444; flex-shrink: 0; }
.ai-error-text { flex: 1; }
.ai-error-dismiss { background: transparent; border: none; color: #FCA5A5; cursor: pointer; }
.ai-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.ai-modal-cancel {
  padding: 8px 14px; background: transparent;
  border: 1px solid var(--d-border-2); border-radius: 6px;
  color: var(--d-text-2); font-size: 13px; font-weight: 500; cursor: pointer;
}
.ai-modal-generate {
  padding: 8px 16px; background: var(--d-accent);
  border: none; border-radius: 6px;
  color: #09090B; font-size: 13px; font-weight: 600; cursor: pointer;
}
.ai-modal-generate:disabled { opacity: 0.5; cursor: not-allowed; }
.ai-progress-bar {
  height: 4px; background: var(--d-surface-3);
  border-radius: 2px; overflow: hidden; margin-bottom: 20px;
}
.ai-progress-fill {
  height: 100%; background: var(--d-accent);
  transition: width 300ms ease;
}
.ai-steps { display: flex; flex-direction: column; gap: 10px; }
.ai-step {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--d-text-4);
}
.ai-step--active { color: var(--d-text); }
.ai-step--done { color: var(--d-text-2); }
.ai-step-indicator {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--d-border-2); flex-shrink: 0;
}
.ai-step--active .ai-step-indicator,
.ai-step--done .ai-step-indicator {
  border-color: var(--d-accent); color: var(--d-accent);
  background: var(--d-accent-soft);
}
.ai-step-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--d-accent); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.8); } }
.ai-step-label { flex: 1; }
.ai-step-elapsed { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--d-text-4); }

.hidden { display: none; }

/* ═══════════════════════ RESPONSIVE ═══════════════════════ */
@media (max-width: 1280px) {
  .dmain { padding: 24px 32px 40px; }
  .dheader-title { font-size: 24px; line-height: 30px; }
  .doverview-stats { gap: 28px; }
  .dov-num { font-size: 34px; }
}

@media (max-width: 1024px) {
  .drow-2 { flex-direction: column; }
  .dnew-card { width: 100%; height: 140px; }
}

@media (max-width: 768px) {
  .sidebar { display: none; }
  .dmain { padding: 8px 20px calc(env(safe-area-inset-bottom, 0px) + 96px); max-height: none; }

  /* App bar: NeuroCanvas brand + (search icon Android) + avatar */
  .m-top {
    display: flex; align-items: center; justify-content: space-between;
    height: 44px; margin-bottom: 0;
  }
  .m-top-trailing { display: flex; align-items: center; gap: 8px; }
  .m-top-search {
    display: none;
    align-items: center; justify-content: center;
    width: 40px; height: 40px;
    background: none; border: none; padding: 0;
    color: #FAFAFA; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  :root.light .m-top-search { color: #18181B; }
  /* Show search ONLY on Android (Paper differentiates here) */
  :root.platform-android .m-top-search { display: flex; }
  :root.platform-android .m-top { height: 56px; }
  .m-brand {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 17px; font-weight: 600; line-height: 22px;
    letter-spacing: -0.01em; color: var(--d-text); margin: 0;
  }
  .m-avatar-link { display: flex; align-items: center; text-decoration: none; }
  .m-avatar {
    width: 32px; height: 32px; border-radius: 16px;
    background: #1A1A1E; border: 1px solid #1E1E22;
    color: #00D2BE;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; font-weight: 600; line-height: 16px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  :root.light .m-avatar { background: #F5F5F4; border-color: #E8E8E6; color: #00A89A; }
  .m-avatar-img { width: 100%; height: 100%; object-fit: cover; }

  /* Page title */
  .m-page-title {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; line-height: 34px;
    letter-spacing: -0.02em; color: var(--d-text);
    margin: 12px 0 16px;
  }

  /* Hide desktop header on mobile (mobile uses m-top + m-page-title) */
  .dheader { display: none; }

  /* Quick actions row */
  .m-actions { display: flex; gap: 10px; margin: 0 0 20px; }
  .m-action {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px; border-radius: 10px;
    background: #111114; border: 1px solid #1E1E22;
    color: var(--d-text);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px; font-weight: 500; line-height: 18px;
    cursor: pointer;
  }
  :root.light .m-action { background: #FFFFFF; border-color: #E8E8E6; color: #18181B; }
  .m-action-primary { background: #00D2BE; color: #0A0A0C; border-color: transparent; font-weight: 600; }
  :root.light .m-action-primary { background: #00D2BE; color: #0A0A0C; }

  /* Section label: "Recent maps" / "See all" — matches Paper Android Dashboard */
  .dsection-label {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 0 12px; margin: 0; border: none;
  }
  .dsection-text {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 0; /* hide original "RECENT · X OF Y" */
    color: #FAFAFA;
  }
  :root.light .dsection-text { color: #18181B; }
  .dsection-text::after {
    content: 'Recent maps';
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px; font-weight: 600; line-height: 18px;
    letter-spacing: 0; text-transform: none;
    color: inherit;
  }
  .dsort {
    background: none; border: none; padding: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px; font-weight: 500; line-height: 18px;
    color: #00D2BE; cursor: pointer;
  }
  :root.light .dsection-text { color: #6B6E74; }
  :root.light .dcard-date { color: #6B6E74; }
  :root.light .dcard-menu {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA0A6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M9 18l6-6-6-6'/></svg>");
  }
  .dsort svg, .dsort-prefix { display: none; }
  .dsort-value { color: #00D2BE; }
  .dsort-value::before { content: 'See all'; }
  .dsort-value { font-size: 0; }
  .dsort-value::before { font-size: 14px; }

  /* Map list rows */
  .dmaps-grid {
    display: flex; flex-direction: column; gap: 8px;
    grid-template-columns: none;
  }
  .dcard {
    display: flex; align-items: center; gap: 12px;
    padding: 12px;
    background: #111114; border: 1px solid #1E1E22; border-radius: 10px;
    box-shadow: none;
  }
  :root.light .dcard { background: #FFFFFF; border-color: #E8E8E6; }
  .dcard-thumb {
    flex-shrink: 0; width: 44px; height: 44px;
    background: #1A1A1E; border-radius: 8px; padding: 0;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  :root.light .dcard-thumb { background: #F5F5F4; }
  .dcard-thumb-rows { display: none; }
  .dcard-thumb::before {
    content: '';
    width: 32px; height: 32px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><rect x='4' y='3' width='8' height='3' rx='1' fill='%2300D2BE' fill-opacity='0.7'/><rect x='14' y='3' width='6' height='3' rx='1' fill='%233F3F45'/><rect x='3' y='10' width='5' height='4' rx='1' fill='%233F3F45'/><rect x='9' y='10' width='7' height='4' rx='1' fill='%2300D2BE'/><rect x='17' y='10' width='4' height='4' rx='1' fill='%233F3F45'/><rect x='4' y='18' width='6' height='3' rx='1' fill='%2300D2BE' fill-opacity='0.7'/><rect x='11' y='18' width='7' height='3' rx='1' fill='%233F3F45'/></svg>");
    background-size: contain; background-repeat: no-repeat;
  }
  :root.light .dcard-thumb::before {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'><rect x='4' y='3' width='8' height='3' rx='1' fill='%2300A89A' fill-opacity='0.7'/><rect x='14' y='3' width='6' height='3' rx='1' fill='%23D4D4D2'/><rect x='3' y='10' width='5' height='4' rx='1' fill='%23D4D4D2'/><rect x='9' y='10' width='7' height='4' rx='1' fill='%2300A89A'/><rect x='17' y='10' width='4' height='4' rx='1' fill='%23D4D4D2'/><rect x='4' y='18' width='6' height='3' rx='1' fill='%2300A89A' fill-opacity='0.7'/><rect x='11' y='18' width='7' height='3' rx='1' fill='%23D4D4D2'/></svg>");
  }
  .dcard-count { display: none; }
  .dcard-info {
    flex: 1; min-width: 0;
    display: flex; align-items: center; gap: 8px;
    padding: 0;
    background: transparent; border: none;
  }
  .dcard-info-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .dcard-title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px; font-weight: 600; line-height: 18px;
    color: var(--d-text); margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dcard-date {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; line-height: 16px;
    color: #888890; margin: 0;
  }
  .dcard-menu {
    flex-shrink: 0; width: 16px; height: 16px;
    background: none; border: none; padding: 0;
    color: #555558; cursor: pointer;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23555558' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M9 18l6-6-6-6'/></svg>");
    background-size: contain; background-repeat: no-repeat;
  }
  .dcard-menu svg { display: none; }

  /* Hide AI banner / drow-2 on mobile, KEEP overview */
  .dai-banner, .drow-2 { display: none; }

  /* === Mobile Overview card (Paper "02 — OVERVIEW") === */
  .doverview {
    display: flex; flex-direction: column;
    margin: 16px 0 0;
    padding: 20px 16px 16px;
    background: #111114; border: 1px solid #1E1E22;
    border-radius: 10px;
    gap: 16px;
  }
  :root.light .doverview { background: #FFFFFF; border-color: #E8E8E6; }
  .doverview-head {
    display: flex; align-items: center; justify-content: space-between;
    margin: 0;
  }
  .doverview-eyebrow,
  .doverview-period {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.06em; line-height: 12px;
    text-transform: uppercase;
    color: #888890;
  }
  .doverview-stats {
    display: flex; align-items: flex-end;
    gap: 24px; margin: 0;
  }
  .doverview-stats > div {
    display: flex; flex-direction: column; gap: 4px;
    flex: 1; min-width: 0;
  }
  .dov-num {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 36px; font-weight: 400; line-height: 1;
    letter-spacing: -0.01em;
    color: #FAFAFA;
  }
  :root.light .dov-num { color: #18181B; }
  .dov-num.accent { color: #00D2BE; }
  :root.light .dov-num.accent { color: #00A89A; }
  .doverview-stats > div > span:last-child {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 500;
    letter-spacing: 0.04em; line-height: 12px;
    color: #888890;
  }
  .doverview-chart {
    display: flex; align-items: flex-end; gap: 4px;
    height: 28px; margin: 0;
  }
  .doverview-chart > * { flex: 1; min-width: 0; border-radius: 2px; }

  /* Platform corner radius split applies to overview too */
  :root.platform-android .doverview { border-radius: 16px; }

  /* === iOS-specific === */
  :root.platform-ios .m-action,
  :root.platform-ios .dcard { border-radius: 10px; }
  :root.platform-ios .dmain {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }

  /* === Android (Material 3) === */
  :root.platform-android .m-action,
  :root.platform-android .dcard { border-radius: 16px; }
  :root.platform-android .dcard-thumb { border-radius: 12px; }
  :root.platform-android .m-action-primary {
    box-shadow: 0 1px 2px rgba(0,0,0,0.30), 0 1px 3px 1px rgba(0,0,0,0.15);
  }
  :root.platform-android .dmain {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  }
}
</style>
