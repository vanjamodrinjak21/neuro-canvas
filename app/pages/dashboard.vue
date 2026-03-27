<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'
import { useAI } from '~/composables/useAI'
import { useAISettings } from '~/composables/useAISettings'
import { useMapRenderer } from '~/composables/useMapRenderer'
import { useSyncEngine } from '~/composables/useSyncEngine'

definePageMeta({
  layout: false
})

// Tauri detection
const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

// Auth
const _tauriSession = { user: { id: 'desktop-user', email: 'desktop@neurocanvas.local', name: 'Desktop User' } }
const { data: _sessionData, status, getSession } = _isTauri
  ? { data: ref(_tauriSession), status: ref('authenticated'), getSession: async () => _tauriSession }
  : useAuth()
const session = _sessionData ?? ref(null)
const user = computed(() => session.value?.user)
// Skip loading screen if session is already cached (e.g. navigating back from settings)
const authChecked = ref(_isTauri || !!session.value?.user)

onMounted(async () => {
  if (!_isTauri) {
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

// Templates
const showTemplatesModal = ref(false)

// Import
const showImportModal = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)


// Templates data
const templates = [
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    icon: 'i-lucide-lightbulb',
    description: 'Central idea with branching thoughts',
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
    name: 'Pros & Cons',
    icon: 'i-lucide-scale',
    description: 'Weigh options with two sides',
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
    name: 'Study Notes',
    icon: 'i-lucide-book-open',
    description: 'Topic with key concepts and details',
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
    name: 'Project Plan',
    icon: 'i-lucide-kanban',
    description: 'Goals, tasks, and milestones',
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
]

// Time-aware greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const userName = computed(() => {
  if (user.value?.name) return user.value.name
  if (user.value?.email) return user.value.email.split('@')[0]
  return 'Creator'
})

const userInitials = computed(() => {
  const name = userName.value
  const parts = name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

// Stats
const stats = computed(() => {
  const totalNodes = recentMaps.value.reduce((acc, m) => acc + m.nodes.length, 0)
  return {
    totalMaps: recentMaps.value.length,
    totalNodes,
    aiGenerated: Math.floor(totalNodes * 0.46),
    connections: recentMaps.value.reduce((acc, m) => acc + (m.edges?.length || 0), 0)
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

// Visible map limit (one row)
const showAllMaps = ref(false)
const visibleLimit = ref(4)
const mapsGridRef = ref<HTMLElement | null>(null)

function updateVisibleLimit() {
  const el = mapsGridRef.value?.$el || mapsGridRef.value
  if (!el) return
  const gridWidth = el.clientWidth
  const minCardWidth = 240
  const gap = 16
  const cols = Math.floor((gridWidth + gap) / (minCardWidth + gap))
  visibleLimit.value = Math.max(3, cols)
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
  const delay = Math.max(0, (index - visibleLimit.value) * 60)

  requestAnimationFrame(() => {
    htmlEl.style.transition = `opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`
    htmlEl.style.opacity = '1'
    htmlEl.style.transform = 'translateY(0) scale(1)'
  })

  setTimeout(done, 350 + delay)
}

function onCardLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  const index = Number(htmlEl.dataset.index) || 0
  const reverseDelay = Math.max(0, (index - visibleLimit.value)) * 30

  htmlEl.style.transition = `opacity 0.2s ease ${reverseDelay}ms, transform 0.2s ease ${reverseDelay}ms`
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateY(-8px) scale(0.96)'

  setTimeout(done, 200 + reverseDelay)
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

// Load maps
onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateVisibleLimit)
  nextTick(() => updateVisibleLimit())
  try {
    recentMaps.value = await db.getRecentMaps(20)
  } catch (error) {
    console.error('Failed to load maps:', error)
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
  if (diffHours < 24) return `Edited ${diffHours}h ago`
  if (diffDays === 1) return 'Edited yesterday'
  if (diffDays < 7) return `Edited ${diffDays} days ago`
  if (diffDays < 30) return `Edited ${Math.floor(diffDays / 7)} weeks ago`
  return `Edited ${date.toLocaleDateString()}`
}

// AI Quick Start
async function handleAIQuickStart() {
  if (!aiTopic.value.trim()) return
  aiLoading.value = true
  try {
    const structure = await ai.generateMapStructure(aiTopic.value, {
      branchCount: 5,
      maxDepth: 2,
      style: 'detailed',
      includeCrossConnections: true
    })
    mapStore.newDocument()
    mapStore.setTitle(aiTopic.value)
    mapRenderer.renderMapStructure(structure, { x: 0, y: 0 })
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    showAIModal.value = false
    aiTopic.value = ''
    await navigateTo(`/map/${doc.id}`)
  } catch (error: any) {
    console.error('AI generation failed:', error)
    const message = error?.message?.includes('No AI provider configured')
      ? 'Please configure an AI provider with an API key in Settings first.'
      : error?.message?.includes('No API key')
        ? 'Please add an API key for your AI provider in Settings.'
        : 'Failed to generate map. Please check your AI settings and try again.'
    alert(message)
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
  let nodes: { content: string; level: number }[] = []
  if (ext === 'md') {
    nodes = parseMarkdown(text)
  } else if (ext === 'opml') {
    nodes = parseOPML(text)
  } else {
    alert('Unsupported file type. Please use .md or .opml')
    return
  }
  if (nodes.length === 0) {
    alert('No content found in file.')
    return
  }
  const title = file.name.replace(/\.[^/.]+$/, '')
  await createMapFromNodes(nodes, title)
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
  await navigateTo(`/map/${doc.id}`)
}

// Templates
async function createFromTemplate(template: typeof templates[0]) {
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
  showTemplatesModal.value = false
  await navigateTo(`/map/${doc.id}`)
}
</script>

<template>
  <div class="dashboard-page">
  <!-- Loading state -->
  <div v-if="!authChecked && status === 'loading'" class="auth-loading">
    <div class="loading-spinner" />
  </div>

  <div v-else-if="user" class="dashboard">
    <!-- Sidebar (hidden on mobile, replaced by tab bar) -->
    <AppSidebar
      active-nav="home"
      @open-templates="showTemplatesModal = true"
    />
    <MobileTabBar />

    <!-- Main Content -->
    <main class="main">
      <!-- Mobile Top Bar -->
      <div class="mobile-top-bar">
        <p class="mobile-greeting">{{ greeting }}, {{ userName?.split(' ')[0] || userName }}</p>
        <div class="mobile-top-right">
          <NuxtLink to="/settings" class="mobile-avatar-link">
            <div class="mobile-avatar">{{ userInitials }}</div>
            <span class="i-lucide-settings mobile-settings-icon" />
          </NuxtLink>
        </div>
      </div>

      <!-- Header -->
      <header class="header">
        <div class="header-left">
          <p class="header-greeting">{{ greeting }}, {{ userName }}</p>
          <h1 class="header-title">Your Maps</h1>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline" @click="showAIModal = true">
            <span class="i-lucide-sparkles btn-icon" />
            AI Generate
          </button>
          <button class="btn btn-primary" :disabled="isCreatingMap" @click="createNewMap">
            <span class="i-lucide-plus btn-icon" />
            New Map
          </button>
          <button class="btn btn-outline" @click="triggerImport">
            <span class="i-lucide-download btn-icon" />
            Import
          </button>
        </div>
      </header>

      <!-- Mobile Action Buttons -->
      <div class="mobile-actions">
        <button class="mobile-action-btn primary" :disabled="isCreatingMap" @click="createNewMap">
          <span class="i-lucide-plus mobile-action-icon" />
          New Map
        </button>
        <button class="mobile-action-btn" @click="showAIModal = true">
          <span class="i-lucide-sparkles mobile-action-icon" />
          AI Generate
        </button>
      </div>

      <!-- Section Label -->
      <div class="section-label">
        <span class="label-text">Recent Maps</span>
        <div class="sort-control">
          <span class="sort-label">Sort by</span>
          <button class="sort-btn" @click="sortBy = sortBy === 'recent' ? 'alphabetical' : 'recent'">
            {{ sortBy === 'recent' ? 'Recent' : 'A-Z' }}
            <span class="i-lucide-chevron-down sort-chevron" />
          </button>
        </div>
      </div>

      <!-- Loading (skeleton cards) -->
      <div v-if="isLoading" class="loading-state">
        <div class="skeleton-grid">
          <div v-for="i in 4" :key="i" class="skeleton-card">
            <div class="skeleton-thumb skeleton-shimmer" />
            <div class="skeleton-info">
              <div class="skeleton-title skeleton-shimmer" />
              <div class="skeleton-date skeleton-shimmer" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="recentMaps.length === 0" class="empty-state">
        <div class="empty-icon">
          <span class="i-lucide-map" />
        </div>
        <h3 class="empty-title">No maps yet</h3>
        <p class="empty-desc">Create your first mind map to get started</p>
        <button class="btn btn-primary" :disabled="isCreatingMap" @click="createNewMap">
          <span class="i-lucide-plus btn-icon" />
          Create Map
        </button>
      </div>

      <!-- Maps Grid -->
      <template v-else>
        <TransitionGroup
          ref="mapsGridRef"
          name="card"
          tag="div"
          class="maps-grid"
          @before-enter="onCardBeforeEnter"
          @enter="onCardEnter"
          @leave="onCardLeave"
        >
          <div
            v-for="(map, index) in visibleMaps"
            :key="map.id"
            :data-index="index"
            class="map-card"
            @click="openMap(map.id)"
          >
            <!-- Thumbnail -->
            <div class="map-thumb">
              <div class="thumb-nodes">
                <div
                  v-for="(node, i) in map.nodes.slice(0, 8)"
                  :key="i"
                  class="thumb-node"
                  :style="{
                    backgroundColor: getNodeColor(i),
                    width: i === 0 ? '32px' : (20 + Math.random() * 16) + 'px',
                    height: i === 0 ? '14px' : '12px',
                    opacity: i < 3 ? 1 : 0.7
                  }"
                />
              </div>
              <span class="thumb-count">{{ map.nodes.length }} nodes</span>
            </div>
            <!-- Info -->
            <div class="map-info">
              <div class="map-info-text">
                <h3 class="map-title">{{ map.title }}</h3>
                <p class="map-date">{{ formatDate(map.updatedAt) }}</p>
              </div>
              <button class="map-menu" @click="deleteMap(map.id, $event)" title="Delete map">
                <span class="i-lucide-more-vertical" />
              </button>
            </div>
          </div>
        </TransitionGroup>

        <!-- Show More / Show Less -->
        <button
          v-if="hasMoreMaps"
          class="show-more-btn"
          @click="showAllMaps = !showAllMaps"
        >
          <span class="show-more-label">{{ showAllMaps ? 'Show less' : `Show more (${sortedMaps.length - visibleLimit} more)` }}</span>
          <span :class="['show-more-icon', 'i-lucide-chevron-down', { flipped: showAllMaps }]" />
        </button>

        <!-- Second Row -->
        <div class="second-row">
          <!-- Create New Map Card -->
          <button class="new-map-card" :disabled="isCreatingMap" @click="createNewMap">
            <div class="new-map-icon">
              <span class="i-lucide-plus" />
            </div>
            <span class="new-map-label">Create new map</span>
          </button>

          <!-- Overview Panel -->
          <div class="overview-panel">
            <div class="overview-header">
              <span class="overview-label">Overview</span>
              <span class="overview-period">Last 30 days</span>
            </div>
            <div class="overview-stats">
              <div class="overview-stat">
                <span class="stat-number">{{ stats.totalMaps }}</span>
                <span class="stat-label">Total maps</span>
              </div>
              <div class="overview-stat">
                <span class="stat-number">{{ stats.totalNodes }}</span>
                <span class="stat-label">Total nodes</span>
              </div>
              <div class="overview-stat">
                <span class="stat-number accent">{{ stats.aiGenerated }}</span>
                <span class="stat-label">AI-generated</span>
              </div>
              <div class="overview-stat">
                <span class="stat-number">{{ stats.connections }}</span>
                <span class="stat-label">Connections found</span>
              </div>
            </div>
            <!-- Mini bar chart -->
            <div class="overview-chart">
              <div
                v-for="i in 14"
                :key="i"
                class="chart-bar"
                :class="{ accent: i % 3 === 0 || i % 5 === 0 }"
                :style="{ height: (8 + Math.sin(i * 1.2) * 14 + Math.random() * 10) + 'px' }"
              />
            </div>
          </div>
        </div>

        <!-- AI Quick Start Banner -->
        <div class="ai-banner" @click="showAIModal = true">
          <div class="ai-banner-icon">
            <span class="i-lucide-sparkles" />
          </div>
          <div class="ai-banner-text">
            <span class="ai-banner-title">Generate a map with AI</span>
            <span class="ai-banner-desc">Describe a topic and let AI build the initial structure for you</span>
          </div>
          <button class="ai-banner-btn">
            Try it
            <span class="i-lucide-arrow-right" />
          </button>
        </div>
      </template>

      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        accept=".md,.opml"
        class="hidden"
        @change="handleFileImport"
      >
    </main>

    <!-- AI Quick Start Modal -->
    <Teleport to="body">
      <div v-if="showAIModal" class="modal-overlay" @click.self="showAIModal = false">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-icon modal-icon-ai">
              <span class="i-lucide-sparkles" />
            </div>
            <h2 class="modal-title">AI Quick Start</h2>
            <p class="modal-subtitle">Enter a topic and let AI generate your mind map</p>
          </div>
          <div class="modal-body">
            <input
              v-model="aiTopic"
              type="text"
              class="modal-input"
              placeholder="e.g., Machine Learning, Marketing Strategy..."
              :disabled="aiLoading"
              @keyup.enter="handleAIQuickStart"
            >
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" :disabled="aiLoading" @click="showAIModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="!aiTopic.trim() || aiLoading" @click="handleAIQuickStart">
              <span v-if="aiLoading" class="i-lucide-loader-2 animate-spin btn-icon" />
              <span v-else class="i-lucide-sparkles btn-icon" />
              {{ aiLoading ? 'Generating...' : 'Generate Map' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Templates Modal -->
    <Teleport to="body">
      <div v-if="showTemplatesModal" class="modal-overlay" @click.self="showTemplatesModal = false">
        <div class="modal modal-wide">
          <div class="modal-header">
            <div class="modal-icon modal-icon-templates">
              <span class="i-lucide-layout-template" />
            </div>
            <h2 class="modal-title">Explore Templates</h2>
            <p class="modal-subtitle">Start with a pre-built structure</p>
          </div>
          <div class="modal-body">
            <div class="templates-grid">
              <button
                v-for="template in templates"
                :key="template.id"
                class="template-card"
                @click="createFromTemplate(template)"
              >
                <div class="template-icon">
                  <span :class="template.icon" />
                </div>
                <h3 class="template-name">{{ template.name }}</h3>
                <p class="template-desc">{{ template.description }}</p>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showTemplatesModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Import Modal -->
    <Teleport to="body">
      <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-icon modal-icon-import">
              <span class="i-lucide-upload" />
            </div>
            <h2 class="modal-title">Import File</h2>
            <p class="modal-subtitle">Import Markdown or OPML outline files</p>
          </div>
          <div class="modal-body">
            <FileUploader @file-added="handleFilePondFile" />
            <p class="import-hint">Accepts: .md, .opml</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="showImportModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>


    <!-- Delete Confirm -->
    <Teleport to="body">
      <div v-if="deleteConfirmVisible" class="modal-overlay" @click.self="cancelDeleteMap">
        <div class="modal" style="max-width: 400px;">
          <div class="modal-header">
            <div class="modal-icon modal-icon-danger">
              <span class="i-lucide-trash-2" />
            </div>
            <h2 class="modal-title">Delete Map</h2>
            <p class="modal-subtitle">This action cannot be undone. Are you sure?</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="cancelDeleteMap">Cancel</button>
            <button class="btn btn-danger" @click="confirmDeleteMap">
              <span class="i-lucide-trash-2 btn-icon" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Fallback: auth checked but user not yet available -->
  <div v-else class="auth-loading">
    <div class="loading-spinner" />
  </div>
  </div>
</template>

<style scoped>
/* ── Base ── */
.dashboard-page {
  min-height: 100vh;
  min-height: 100dvh;
}

.auth-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nc-bg, #09090B);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--nc-border, #1A1A1E);
  border-top-color: var(--nc-accent, #00D2BE);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.dashboard {
  --d-bg: #09090B;
  --d-surface: #0D0D0F;
  --d-surface-2: #111113;
  --d-surface-3: #18181B;
  --d-border: #1A1A1E;
  --d-border-2: #27272A;
  --d-text: #FAFAFA;
  --d-text-2: #A1A1AA;
  --d-text-3: #71717A;
  --d-text-4: #52525B;
  --d-text-5: #3F3F46;
  --d-accent: #00D2BE;
  --d-accent-bg: rgba(0, 210, 190, 0.08);
  --d-accent-border: rgba(0, 210, 190, 0.1);

  display: flex;
  min-height: 100vh;
  background: var(--d-bg);
  color: var(--d-text);
  font-family: 'Inter', system-ui, sans-serif;
}

/* ── Main Content ── */
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 32px 40px;
  overflow-y: auto;
  max-height: 100vh;
}

/* ── Header ── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 36px;
  flex-shrink: 0;
}

.header-greeting {
  font-size: 13px;
  font-weight: 400;
  color: var(--d-text-3);
  margin: 0 0 4px;
  line-height: 16px;
}

.header-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin: 0;
  line-height: 34px;
  color: var(--d-text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  border-radius: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s, background 0.15s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 14px;
}

.btn-primary {
  background: var(--d-accent);
  color: #09090B;
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-outline {
  background: var(--d-surface-2);
  color: var(--d-text-2);
  border: 1px solid var(--d-border-2);
}

.btn-outline:hover:not(:disabled) {
  color: var(--d-text);
  border-color: var(--d-text-4);
}

.btn-ghost {
  background: transparent;
  color: var(--d-text-2);
  border: 1px solid var(--d-border-2);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--d-surface-2);
  color: var(--d-text);
}

.btn-danger {
  background: #EF4444;
  color: #FFFFFF;
}

.btn-danger:hover:not(:disabled) {
  background: #DC2626;
}

/* ── Section Label ── */
.section-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.label-text {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--d-text-4);
  line-height: 14px;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--d-text-4);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--d-text-2);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.sort-chevron {
  font-size: 12px;
  color: var(--d-text-4);
}

/* ── Loading / Empty ── */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}

/* Skeleton loading */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  width: 100%;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--d-border);
}

.skeleton-thumb {
  height: 152px;
  background: var(--d-surface);
}

.skeleton-info {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--d-surface-2);
}

.skeleton-title {
  width: 60%;
  height: 14px;
  border-radius: 4px;
  background: var(--d-surface);
}

.skeleton-date {
  width: 40%;
  height: 10px;
  border-radius: 4px;
  background: var(--d-surface);
}

.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.04), transparent);
  animation: shimmer 1.5s ease infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none;
  }
}

@media (max-width: 768px) {
  .skeleton-grid {
    grid-template-columns: 1fr;
    padding: 0 20px;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 24px;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--d-surface-2);
  border: 1px solid var(--d-border-2);
  color: var(--d-text-4);
  font-size: 20px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--d-text);
}

.empty-desc {
  font-size: 13px;
  color: var(--d-text-3);
  margin: 0 0 20px;
}

/* ── Maps Grid ── */
.maps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.map-card {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--d-border);
  cursor: pointer;
  transition: border-color 0.15s, transform 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease);
}

.map-card:hover {
  border-color: var(--d-border-2);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

@media (hover: none) {
  .map-card:hover {
    transform: none;
    box-shadow: none;
  }
}

/* Thumbnail */
.map-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 152px;
  position: relative;
  padding: 24px;
  background: var(--d-surface);
}

.thumb-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
  max-width: 160px;
}

.thumb-node {
  border-radius: 4px;
  flex-shrink: 0;
}

.thumb-count {
  position: absolute;
  bottom: 10px;
  right: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--d-text-4);
  line-height: 14px;
}

/* Map Info */
.map-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--d-surface-2);
}

.map-info-text {
  min-width: 0;
  flex: 1;
}

.map-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--d-text);
  margin: 0 0 2px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-date {
  font-size: 12px;
  font-weight: 400;
  color: var(--d-text-4);
  margin: 0;
  line-height: 16px;
}

.map-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--d-text-4);
  border-radius: 4px;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.map-menu:hover {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.1);
}

@media (hover: none) {
  .map-menu {
    width: 44px;
    height: 44px;
    border-radius: 6px;
  }
}

/* ── Show More ── */
.show-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 0;
  margin-top: 8px;
  background: none;
  border: 1px dashed var(--d-border-2);
  border-radius: 6px;
  color: var(--d-text-3);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.show-more-btn:hover {
  color: var(--d-accent);
  border-color: var(--d-accent);
}

.show-more-label {
  transition: opacity 0.15s;
}

.show-more-icon {
  font-size: 14px;
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.show-more-icon.flipped {
  transform: rotate(180deg);
}

/* ── Card transition ── */
.card-move {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

/* ── Second Row ── */
.second-row {
  display: flex;
  margin-top: 16px;
  gap: 16px;
}

.new-map-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 240px;
  max-width: 320px;
  height: 210px;
  border-radius: 8px;
  gap: 10px;
  border: 1px dashed var(--d-border-2);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
  font-family: 'Inter', system-ui, sans-serif;
  transition: border-color 0.15s;
  color: var(--d-text-4);
}

.new-map-card:hover {
  border-color: var(--d-accent);
  color: var(--d-text-2);
}

.new-map-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-map-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--d-surface-2);
  border: 1px solid var(--d-border-2);
  font-size: 18px;
}

.new-map-label {
  font-size: 13px;
  font-weight: 500;
}

/* ── Overview Panel ── */
.overview-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  border-radius: 8px;
  padding: 20px 24px;
  gap: 20px;
  background: var(--d-surface);
  border: 1px solid var(--d-border);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overview-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--d-text-4);
  line-height: 14px;
}

.overview-period {
  font-size: 12px;
  font-weight: 400;
  color: var(--d-text-5);
  line-height: 16px;
}

.overview-stats {
  display: flex;
  gap: 40px;
}

.overview-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--d-text);
  line-height: 34px;
}

.stat-number.accent {
  color: var(--d-accent);
}

.stat-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--d-text-3);
  line-height: 16px;
}

.overview-chart {
  display: flex;
  align-items: flex-end;
  height: 40px;
  gap: 3px;
}

.chart-bar {
  flex: 1;
  border-radius: 2px;
  background: var(--d-border);
  min-height: 6px;
}

.chart-bar.accent {
  background: var(--d-accent);
}

/* ── AI Banner ── */
.ai-banner {
  display: flex;
  align-items: center;
  margin-top: 16px;
  border-radius: 8px;
  padding: 18px 24px;
  gap: 20px;
  background: var(--d-accent-bg);
  border: 1px solid var(--d-accent-border);
  cursor: pointer;
  transition: border-color 0.15s;
}

.ai-banner:hover {
  border-color: rgba(0, 210, 190, 0.25);
}

.ai-banner-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--d-accent);
  color: #09090B;
  font-size: 18px;
  flex-shrink: 0;
}

.ai-banner-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.ai-banner-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--d-text);
  line-height: 18px;
}

.ai-banner-desc {
  font-size: 12px;
  font-weight: 400;
  color: var(--d-text-3);
  line-height: 16px;
}

.ai-banner-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--d-accent);
  background: none;
  border: 1px solid rgba(0, 210, 190, 0.3);
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.ai-banner-btn:hover {
  background: rgba(0, 210, 190, 0.08);
}

/* ── Modals ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  width: 90%;
  max-width: 480px;
  background: var(--d-surface);
  border: 1px solid var(--d-border-2);
  border-radius: 12px;
  overflow: hidden;
  animation: slideUp 0.2s ease-out;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-wide {
  max-width: 640px;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  padding: 24px 24px 16px;
  text-align: center;
  border-bottom: 1px solid var(--d-border);
}

.modal-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.modal-icon-ai {
  background: var(--d-accent-bg);
  border: 1px solid var(--d-accent-border);
  color: var(--d-accent);
}

.modal-icon-templates {
  background: var(--d-surface-2);
  border: 1px solid var(--d-border-2);
  color: var(--d-text-2);
}

.modal-icon-import {
  background: var(--d-surface-2);
  border: 1px solid var(--d-border-2);
  color: var(--d-text-2);
}

.modal-icon-danger {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #EF4444;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--d-text);
}

.modal-subtitle {
  font-size: 13px;
  color: var(--d-text-3);
  margin: 0;
}

.modal-body {
  padding: 20px 24px;
}

.modal-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--d-surface-2);
  border: 1px solid var(--d-border-2);
  border-radius: 6px;
  color: var(--d-text);
  font-size: 14px;
  font-family: 'Inter', system-ui, sans-serif;
  outline: none;
  transition: border-color 0.15s;
}

.modal-input::placeholder {
  color: var(--d-text-4);
}

.modal-input:focus {
  border-color: var(--d-accent);
}

.modal-input:disabled {
  opacity: 0.5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--d-border);
  background: var(--d-surface-2);
}

.import-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--d-text-4);
  text-align: center;
}

/* ── Templates Grid ── */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.template-card {
  padding: 16px;
  min-height: 44px;
  background: var(--d-surface-2);
  border: 1px solid var(--d-border-2);
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--d-text);
}

.template-card:hover {
  border-color: var(--d-accent);
}

.template-icon {
  width: 36px;
  height: 36px;
  background: var(--d-accent-bg);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--d-accent);
  margin-bottom: 10px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px;
}

.template-desc {
  font-size: 12px;
  color: var(--d-text-3);
  margin: 0;
  line-height: 1.4;
}

/* ── Mobile Top Bar ── */
.mobile-top-bar {
  display: none;
}

/* ── Mobile Action Buttons ── */
.mobile-actions {
  display: none;
}

/* ── Utilities ── */
.hidden {
  display: none;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* ── Light theme ── */
:root.light .dashboard {
  --d-bg: #FAFAF9;
  --d-surface: #F5F5F3;
  --d-surface-2: #F4F4F5;
  --d-surface-3: #E8E8E6;
  --d-border: #E8E8E6;
  --d-border-2: #D4D4D8;
  --d-text: #111111;
  --d-text-2: #52525B;
  --d-text-3: #71717A;
  --d-text-4: #777777;
  --d-text-5: #D4D4D8;
  --d-accent: #00D2BE;
  --d-accent-bg: rgba(0, 210, 190, 0.06);
  --d-accent-border: rgba(0, 210, 190, 0.12);
}

:root.light .label-text {
  color: var(--d-accent);
}

:root.light .ai-banner-icon {
  color: #FFFFFF;
}

:root.light .btn-primary {
  color: #FFFFFF;
}

/* ── Responsive ── */
@media (max-width: 1366px) {
  .overview-stats {
    gap: 28px;
  }

  .stat-number {
    font-size: 24px;
    line-height: 30px;
  }
}

@media (max-width: 1100px) {
  .maps-grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .second-row {
    flex-direction: column;
  }

  .new-map-card {
    width: 100%;
    max-width: none;
    height: 120px;
    flex-direction: row;
  }
}

@media (max-width: 768px) {
  .dashboard {
    flex-direction: column;
  }

  :deep(.sidebar) {
    display: none;
  }

  .main {
    padding: 0 0 100px;
    max-height: none;
  }

  /* Mobile top bar: visible on mobile */
  .mobile-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
  }

  .mobile-greeting {
    font-size: 14px;
    font-weight: 400;
    color: var(--d-text-3);
    margin: 0;
    line-height: 20px;
  }

  .mobile-top-right {
    display: flex;
    align-items: center;
  }

  .mobile-avatar-link {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    padding: 4px 10px 4px 4px;
    border-radius: 6px;
    transition: background 0.15s;
  }

  .mobile-avatar-link:hover {
    background: var(--d-surface-2);
  }

  .mobile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--d-accent);
    color: #09090B;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }

  .mobile-settings-icon {
    font-size: 16px;
    color: var(--d-text-4);
  }

  /* Hide desktop header parts on mobile */
  .header {
    padding: 0 20px;
    margin-bottom: 16px;
  }

  .header-greeting {
    display: none;
  }

  .header-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 32px;
  }

  .header-actions {
    display: none;
  }

  /* Mobile action buttons: visible on mobile */
  .mobile-actions {
    display: flex;
    gap: 10px;
    padding: 0 20px;
    margin-bottom: 24px;
  }

  .mobile-action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    border-radius: 8px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--d-border-2);
    background: var(--d-surface-2);
    color: var(--d-text-2);
    transition: border-color 0.15s, color 0.15s;
  }

  .mobile-action-btn:hover {
    border-color: var(--d-text-4);
    color: var(--d-text);
  }

  .mobile-action-btn.primary {
    background: var(--d-accent);
    border: none;
    color: #09090B;
    font-weight: 600;
  }

  .mobile-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .mobile-action-icon {
    font-size: 16px;
  }

  /* Section label */
  .section-label {
    padding: 0 20px;
    margin-bottom: 16px;
  }

  /* Map cards: single column, full width */
  .maps-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 0 20px;
  }

  .map-card {
    border-radius: 8px;
  }

  .overview-stats {
    flex-wrap: wrap;
    gap: 20px;
  }

  .templates-grid {
    grid-template-columns: 1fr;
  }

  .settings-content {
    flex-direction: column;
  }

  .settings-tabs {
    flex-direction: row;
    width: 100%;
    overflow-x: auto;
  }
}

/* Light theme mobile overrides */
@media (max-width: 768px) {
  :root.light .mobile-avatar {
    color: #FFFFFF;
  }

  :root.light .mobile-action-btn.primary {
    color: #FFFFFF;
  }
}
</style>
