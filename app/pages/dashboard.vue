<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'
import { useAI } from '~/composables/useAI'

// Dashboard / Home page - Elevated Command Center
definePageMeta({
  layout: false
})

// Auth - handle client-side since ssr: false
const { data: session, status, getSession } = useAuth()
const user = computed(() => session.value?.user)
const authChecked = ref(false)

// Check auth on mount (SPA mode)
onMounted(async () => {
  console.log('Dashboard mounted, checking session...')
  console.log('Initial session:', session.value)
  console.log('Initial status:', status.value)

  try {
    const freshSession = await getSession({ force: true })
    console.log('Fresh session:', freshSession)
    console.log('Session after refresh:', session.value)
    console.log('Status after refresh:', status.value)
  } catch (e) {
    console.error('Session check failed:', e)
  }

  authChecked.value = true

  // Redirect if not authenticated after check
  if (!session.value?.user) {
    console.log('No user found, redirecting to signin')
    navigateTo('/auth/signin')
  } else {
    console.log('User authenticated:', session.value.user)
  }
})

const db = useDatabase()
const mapStore = useMapStore()
const router = useRouter()
const ai = useAI()

// State
const recentMaps = ref<DBMapDocument[]>([])
const isLoading = ref(true)
const isCreatingMap = ref(false)

// AI Quick Start state
const showAIModal = ref(false)
const aiTopic = ref('')
const aiLoading = ref(false)

// Templates state
const showTemplatesModal = ref(false)

// File input ref
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

// Cursor glow state
const cursorGlow = ref<HTMLElement | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)
const glowX = ref(0)
const glowY = ref(0)

// Time-aware greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' }
  return { text: 'Good evening', emoji: '🌙' }
})

// Get user name from session
const userName = computed(() => {
  if (user.value?.name) return user.value.name
  if (user.value?.email) return user.value.email.split('@')[0]
  return 'Creator'
})

// Stats derived from recentMaps
const stats = computed(() => ({
  totalMaps: recentMaps.value.length,
  ideas: recentMaps.value.reduce((acc, m) => acc + m.nodes.length, 0),
  streak: 0
}))

// Cursor glow animation
let animationId: number | null = null

function animateCursor() {
  const speed = 0.08
  glowX.value += (mouseX.value - glowX.value) * speed
  glowY.value += (mouseY.value - glowY.value) * speed

  if (cursorGlow.value) {
    cursorGlow.value.style.left = glowX.value + 'px'
    cursorGlow.value.style.top = glowY.value + 'px'
  }

  animationId = requestAnimationFrame(animateCursor)
}

function handleMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

// 3D tilt effect for cards
function handleCardMouseMove(e: MouseEvent, card: HTMLElement) {
  const rect = card.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width - 0.5
  const y = (e.clientY - rect.top) / rect.height - 0.5

  card.style.transform = `
    translateY(-8px)
    scale(1.01)
    perspective(1000px)
    rotateY(${x * 5}deg)
    rotateX(${-y * 5}deg)
  `
}

function handleCardMouseLeave(card: HTMLElement) {
  card.style.transform = ''
}

// Magnetic button effect
function handleBtnMouseMove(e: MouseEvent, btn: HTMLElement) {
  const rect = btn.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  btn.style.transform = `translateY(-3px) translate(${x * 0.15}px, ${y * 0.15}px)`
}

function handleBtnMouseLeave(btn: HTMLElement) {
  btn.style.transform = ''
}

// Close modals on escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showAIModal.value = false
    showTemplatesModal.value = false
  }
}

// Load maps on mount
onMounted(async () => {
  // Start cursor animation
  animateCursor()

  // Add keyboard listener for modals
  window.addEventListener('keydown', handleKeydown)

  try {
    recentMaps.value = await db.getRecentMaps(20)
  } catch (error) {
    console.error('Failed to load maps:', error)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('keydown', handleKeydown)
})

// Create new map
async function createNewMap() {
  console.log('createNewMap called')
  if (isCreatingMap.value) {
    console.log('Already creating, returning')
    return
  }

  isCreatingMap.value = true
  try {
    console.log('Creating new document...')
    mapStore.newDocument()
    const doc = mapStore.toSerializable()
    console.log('Saving map with id:', doc.id)
    await db.saveMap(doc)
    console.log('Navigating to:', `/map/${doc.id}`)
    await navigateTo(`/map/${doc.id}`)
    console.log('Navigation complete')
  } catch (error) {
    console.error('Failed to create map:', error)
    alert(`Failed to create map: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isCreatingMap.value = false
  }
}

// Open existing map
function openMap(mapId: string) {
  router.push(`/map/${mapId}`)
}

// Delete map
async function deleteMap(mapId: string, event: Event) {
  event.stopPropagation()
  if (!confirm('Are you sure you want to delete this map?')) return

  try {
    await db.deleteMap(mapId)
    recentMaps.value = recentMaps.value.filter(m => m.id !== mapId)
  } catch (error) {
    console.error('Failed to delete map:', error)
  }
}

// Format date
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

// AI Quick Start handler
async function handleAIQuickStart() {
  if (!aiTopic.value.trim()) return
  aiLoading.value = true

  try {
    const suggestions = await ai.smartExpand(aiTopic.value, [], 5)

    // Create new map with root + children
    mapStore.newDocument()
    mapStore.setTitle(aiTopic.value)

    // Add root node
    const rootNode = mapStore.addNode({
      content: aiTopic.value,
      position: { x: 400, y: 300 }
    })

    // Add child nodes in radial pattern
    suggestions.forEach((text, i) => {
      const angle = (i / suggestions.length) * 2 * Math.PI - Math.PI / 2
      const childNode = mapStore.addNode({
        content: text,
        position: {
          x: 400 + Math.cos(angle) * 200,
          y: 300 + Math.sin(angle) * 200
        }
      })
      mapStore.addEdge(rootNode.id, childNode.id)
    })

    // Save and navigate
    const doc = mapStore.toSerializable()
    await db.saveMap(doc)
    showAIModal.value = false
    aiTopic.value = ''
    await navigateTo(`/map/${doc.id}`)
  } catch (error) {
    console.error('AI generation failed:', error)
    alert('Failed to generate map. Please try again.')
  } finally {
    aiLoading.value = false
  }
}

// Import handlers
function triggerImport() {
  fileInput.value?.click()
}

async function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

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

  // Create map from parsed structure
  const title = file.name.replace(/\.[^/.]+$/, '')
  await createMapFromNodes(nodes, title)

  // Reset file input
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function parseMarkdown(text: string): { content: string; level: number }[] {
  const lines = text.split('\n')
  const nodes: { content: string; level: number }[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      nodes.push({
        content: headerMatch[2],
        level: headerMatch[1].length
      })
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

  // Build hierarchical structure
  const nodeStack: { id: string; level: number }[] = []
  const ySpacing = 100
  const xSpacing = 200
  let currentY = 100

  // Group nodes by level for positioning
  const levelCounts: Record<number, number> = {}
  nodes.forEach(n => {
    levelCounts[n.level] = (levelCounts[n.level] || 0) + 1
  })

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

    // Find parent - walk back through stack to find node with lower level
    while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].level >= level) {
      nodeStack.pop()
    }

    // Connect to parent if exists
    if (nodeStack.length > 0) {
      const parent = nodeStack[nodeStack.length - 1]
      mapStore.addEdge(parent.id, newNode.id)
    }

    nodeStack.push({ id: newNode.id, level })
    levelIndices[level]++
    currentY += ySpacing
  }

  // Save and navigate
  const doc = mapStore.toSerializable()
  await db.saveMap(doc)
  await navigateTo(`/map/${doc.id}`)
}

// View All handler
function viewAllMaps() {
  router.push('/maps')
}

// Templates handlers
function openTemplatesModal() {
  showTemplatesModal.value = true
}

async function createFromTemplate(template: typeof templates[0]) {
  mapStore.newDocument()
  mapStore.setTitle(template.name)

  // Create nodes
  const nodeIds: string[] = []
  for (const nodeData of template.nodes) {
    const node = mapStore.addNode({
      content: nodeData.content,
      position: { x: nodeData.x, y: nodeData.y }
    })
    nodeIds.push(node.id)
  }

  // Create edges based on template structure
  // Root connects to level 1, level 1 connects to level 2, etc.
  if (template.id === 'brainstorm') {
    // Root (0) connects to all branches (1-4)
    for (let i = 1; i < nodeIds.length; i++) {
      mapStore.addEdge(nodeIds[0], nodeIds[i])
    }
  } else if (template.id === 'pros-cons') {
    // Decision (0) -> Pros (1), Cons (2)
    // Pros (1) -> Pro 1 (3), Pro 2 (4)
    // Cons (2) -> Con 1 (5), Con 2 (6)
    mapStore.addEdge(nodeIds[0], nodeIds[1])
    mapStore.addEdge(nodeIds[0], nodeIds[2])
    mapStore.addEdge(nodeIds[1], nodeIds[3])
    mapStore.addEdge(nodeIds[1], nodeIds[4])
    mapStore.addEdge(nodeIds[2], nodeIds[5])
    mapStore.addEdge(nodeIds[2], nodeIds[6])
  } else if (template.id === 'study-notes') {
    // Topic (0) -> Concepts (1-3)
    // Each concept -> Detail
    mapStore.addEdge(nodeIds[0], nodeIds[1])
    mapStore.addEdge(nodeIds[0], nodeIds[2])
    mapStore.addEdge(nodeIds[0], nodeIds[3])
    mapStore.addEdge(nodeIds[1], nodeIds[4])
    mapStore.addEdge(nodeIds[2], nodeIds[5])
    mapStore.addEdge(nodeIds[3], nodeIds[6])
  } else if (template.id === 'project-plan') {
    // Goal (0) -> Phases (1-3)
    // Phase 1 (1) -> Tasks (4-7)
    mapStore.addEdge(nodeIds[0], nodeIds[1])
    mapStore.addEdge(nodeIds[0], nodeIds[2])
    mapStore.addEdge(nodeIds[0], nodeIds[3])
    mapStore.addEdge(nodeIds[1], nodeIds[4])
    mapStore.addEdge(nodeIds[1], nodeIds[5])
    mapStore.addEdge(nodeIds[2], nodeIds[6])
    mapStore.addEdge(nodeIds[2], nodeIds[7])
  }

  // Save and navigate
  const doc = mapStore.toSerializable()
  await db.saveMap(doc)
  showTemplatesModal.value = false
  await navigateTo(`/map/${doc.id}`)
}

</script>

<template>
  <!-- Loading state while checking auth -->
  <div v-if="!authChecked || status === 'loading'" class="auth-loading">
    <div class="loading-spinner" />
  </div>

  <div v-else-if="user" class="dashboard" @mousemove="handleMouseMove">
    <!-- Cursor glow -->
    <div ref="cursorGlow" class="cursor-glow" />

    <!-- Background effects -->
    <div class="bg-grid" />
    <div class="bg-noise" />
    <div class="glow-orb glow-orb-1" />
    <div class="glow-orb glow-orb-2" />
    <div class="glow-orb glow-orb-3" />

    <!-- Header -->
    <header class="header">
      <NuxtLink to="/dashboard" class="header-brand">
        <div class="logo-mark">
          <div class="logo-inner" />
          <span class="i-lucide-feather logo-icon" />
        </div>
        <div class="header-text">
          <h1 class="header-title">NeuroCanvas</h1>
          <p class="header-subtitle">Where ideas take shape</p>
        </div>
      </NuxtLink>

      <div class="header-actions">
        <div class="status-indicator">
          <span class="status-dot" />
          <span class="status-text">All synced</span>
        </div>
        <UserMenu />
      </div>
    </header>

    <!-- Main content -->
    <main class="main-content">
      <!-- Welcome section -->
      <section class="welcome reveal-up">
        <span class="greeting-emoji">{{ greeting.emoji }}</span>
        <h2 class="welcome-title">
          {{ greeting.text }}, <span class="welcome-name">{{ userName }}</span>
        </h2>
        <p class="welcome-subtitle">
          What will you <em class="serif-accent">create</em> today?
        </p>
      </section>

      <!-- Stats bar -->
      <section class="stats-bar reveal-up delay-1">
        <div
          class="stat-card"
          @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
          @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
        >
          <div class="stat-icon-wrap">
            <span class="i-lucide-map-pin stat-icon" />
          </div>
          <span class="stat-value">{{ stats.totalMaps }}</span>
          <span class="stat-label">Total Maps</span>
        </div>

        <div
          class="stat-card"
          @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
          @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
        >
          <div class="stat-icon-wrap">
            <span class="i-lucide-lightbulb stat-icon" />
          </div>
          <span class="stat-value">{{ stats.ideas }}</span>
          <span class="stat-label">Ideas Captured</span>
        </div>

        <div
          class="stat-card"
          @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
          @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
        >
          <div class="stat-icon-wrap">
            <span class="i-lucide-flame stat-icon" />
          </div>
          <span class="stat-value">{{ stats.streak }}</span>
          <span class="stat-label">Day Streak</span>
        </div>
      </section>

      <!-- Create section -->
      <section class="create-section reveal-up delay-2">
        <h2 class="section-title">
          <span class="section-bar" />
          Create New
        </h2>

        <div class="bento-grid">
          <!-- Primary: Blank Canvas -->
          <button
            class="create-card create-card-primary"
            :disabled="isCreatingMap"
            @click="createNewMap"
            @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
          >
            <div class="card-shine" />
            <div class="card-icon card-icon-primary">
              <span v-if="isCreatingMap" class="i-lucide-loader-2 animate-spin" />
              <span v-else class="i-lucide-plus" />
            </div>
            <h3 class="card-title">Blank Canvas</h3>
            <p class="card-desc">Start fresh with an empty mind map</p>
            <span class="card-arrow i-lucide-arrow-right" />
          </button>

          <!-- Secondary: AI Quick Start -->
          <button
            class="create-card create-card-secondary"
            @click="showAIModal = true"
            @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
          >
            <div class="card-shine" />
            <span class="ai-badge">
              <span class="ai-badge-dot" />
              AI POWERED
            </span>
            <div class="card-icon card-icon-secondary">
              <span class="i-lucide-sparkles" />
            </div>
            <h3 class="card-title">AI Quick Start</h3>
            <p class="card-desc">Enter a topic and let AI generate your map</p>
            <span class="card-arrow i-lucide-arrow-right" />
          </button>

          <!-- Tertiary: Import -->
          <button
            class="create-card create-card-tertiary"
            @click="triggerImport"
            @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
          >
            <div class="card-shine" />
            <div class="card-icon card-icon-tertiary">
              <span class="i-lucide-upload" />
            </div>
            <h3 class="card-title">Import</h3>
            <p class="card-desc">Bring in existing Markdown or OPML files</p>
            <span class="card-arrow i-lucide-arrow-right" />
          </button>

          <!-- Hidden file input for import -->
          <input
            ref="fileInput"
            type="file"
            accept=".md,.opml"
            class="hidden"
            @change="handleFileImport"
          >
        </div>
      </section>

      <!-- Recent maps section -->
      <section class="recent-section reveal-up delay-3">
        <div class="section-header">
          <h2 class="section-title">
            <span class="section-bar" />
            Recent Maps
          </h2>
          <button v-if="recentMaps.length > 0" class="view-all-btn" @click="viewAllMaps">
            View All
            <span class="i-lucide-arrow-right" />
          </button>
        </div>

        <!-- Loading state -->
        <div v-if="isLoading" class="loading-state">
          <div class="loading-orbit">
            <div class="loading-dot" />
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="recentMaps.length === 0" class="empty-state">
          <div class="orbit-system">
            <div class="orbit orbit-1">
              <div class="orbit-dot" />
            </div>
            <div class="orbit orbit-2">
              <div class="orbit-dot" />
            </div>
            <div class="orbit orbit-3" />
            <div class="center-core" />
          </div>

          <h3 class="empty-title">No maps yet</h3>
          <p class="empty-desc">Create your first mind map to get started</p>

          <div class="empty-actions">
            <button
              class="btn-primary magnetic-btn"
              :disabled="isCreatingMap"
              @click="createNewMap"
              @mousemove="(e) => handleBtnMouseMove(e, e.currentTarget as HTMLElement)"
              @mouseleave="(e) => handleBtnMouseLeave(e.currentTarget as HTMLElement)"
            >
              <span class="btn-shine" />
              <span v-if="isCreatingMap" class="i-lucide-loader-2 animate-spin" />
              <span v-else class="i-lucide-plus" />
              Create Map
            </button>
            <button
              class="btn-ghost magnetic-btn"
              @click="openTemplatesModal"
              @mousemove="(e) => handleBtnMouseMove(e, e.currentTarget as HTMLElement)"
              @mouseleave="(e) => handleBtnMouseLeave(e.currentTarget as HTMLElement)"
            >
              <span class="i-lucide-file-plus" />
              Explore Templates
            </button>
          </div>
        </div>

        <!-- Maps grid -->
        <div v-else class="maps-grid">
          <div
            v-for="map in recentMaps"
            :key="map.id"
            class="map-card"
            @click="openMap(map.id)"
            @mousemove="(e) => handleCardMouseMove(e, e.currentTarget as HTMLElement)"
            @mouseleave="(e) => handleCardMouseLeave(e.currentTarget as HTMLElement)"
          >
            <button
              class="map-delete"
              title="Delete map"
              @click="deleteMap(map.id, $event)"
            >
              <span class="i-lucide-trash-2" />
            </button>

            <div class="map-preview">
              <img v-if="map.preview" :src="map.preview" :alt="map.title" class="map-img">
              <div v-else class="map-placeholder">
                <span class="i-lucide-map" />
              </div>
            </div>

            <div class="map-info">
              <h3 class="map-title">{{ map.title }}</h3>
              <div class="map-meta">
                <span>{{ map.nodes.length }} nodes</span>
                <span>{{ formatDate(map.updatedAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <p class="footer-brand">NeuroCanvas — AI-powered mind mapping</p>
      <div class="footer-links">
        <a href="#" class="footer-link">Help</a>
        <a href="#" class="footer-link">Feedback</a>
        <a href="#" class="footer-link">Privacy</a>
      </div>
    </footer>

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
              placeholder="e.g., Machine Learning, Marketing Strategy, Trip Planning..."
              :disabled="aiLoading"
              @keyup.enter="handleAIQuickStart"
            >
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" @click="showAIModal = false" :disabled="aiLoading">
              Cancel
            </button>
            <button
              class="btn-primary"
              :disabled="!aiTopic.trim() || aiLoading"
              @click="handleAIQuickStart"
            >
              <span v-if="aiLoading" class="i-lucide-loader-2 animate-spin" />
              <span v-else class="i-lucide-sparkles" />
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
            <p class="modal-subtitle">Start with a pre-built structure for common use cases</p>
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
                <div class="template-preview">
                  <div
                    v-for="(node, index) in template.nodes.slice(0, 5)"
                    :key="index"
                    class="template-preview-node"
                    :style="{
                      left: `${(node.x / 800) * 100}%`,
                      top: `${(node.y / 500) * 100}%`
                    }"
                  />
                </div>
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" @click="showTemplatesModal = false">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   NEUROCANVAS DASHBOARD — ELEVATED COMMAND CENTER
   ═══════════════════════════════════════════════════════════════ */

/* Auth Loading State */
.auth-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #06060A;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 210, 190, 0.2);
  border-top-color: #00D2BE;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* CSS Custom Properties */
.dashboard {
  --bg: #06060A;
  --surface: #0C0C10;
  --surface-2: #121216;
  --surface-3: #18181D;
  --surface-hover: #1E1E24;
  --border: #252529;
  --border-subtle: #1A1A1E;
  --border-glow: rgba(0, 210, 190, 0.3);

  --text: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-muted: #71717A;
  --text-dim: #52525B;

  --accent: #00D2BE;
  --accent-light: #00FFE5;
  --accent-dark: #00A89A;
  --accent-glow: rgba(0, 210, 190, 0.12);
  --accent-glow-strong: rgba(0, 210, 190, 0.25);
  --accent-glow-intense: rgba(0, 210, 190, 0.4);

  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Base */
.dashboard {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Cabinet Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* ═══════════════════════════════════════════════════════════════
   BACKGROUND EFFECTS
   ═══════════════════════════════════════════════════════════════ */

/* Cursor Glow */
.cursor-glow {
  position: fixed;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 1;
  opacity: 0.6;
}

/* Grid Pattern */
.bg-grid {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, black 30%, transparent 100%);
  pointer-events: none;
  z-index: 0;
  animation: gridPulse 10s ease-in-out infinite;
}

@keyframes gridPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Noise Texture */
.bg-noise {
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.018;
  pointer-events: none;
  z-index: 9999;
}

/* Glow Orbs */
.glow-orb {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.glow-orb-1 {
  width: 800px;
  height: 800px;
  top: -400px;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(0, 210, 190, 0.15) 0%, transparent 60%);
  filter: blur(60px);
  animation: glowFloat 20s ease-in-out infinite;
}

.glow-orb-2 {
  width: 600px;
  height: 600px;
  bottom: -300px;
  right: -200px;
  background: radial-gradient(circle, rgba(0, 210, 190, 0.1) 0%, transparent 60%);
  filter: blur(80px);
  animation: glowFloat 25s ease-in-out infinite reverse;
}

.glow-orb-3 {
  width: 400px;
  height: 400px;
  top: 40%;
  left: -100px;
  background: radial-gradient(circle, rgba(0, 210, 190, 0.08) 0%, transparent 60%);
  filter: blur(60px);
  animation: glowFloat 30s ease-in-out infinite 5s;
}

@keyframes glowFloat {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    opacity: 0.8;
  }
  33% {
    transform: translateX(-45%) scale(1.1);
    opacity: 1;
  }
  66% {
    transform: translateX(-55%) scale(0.95);
    opacity: 0.7;
  }
}

/* ═══════════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════════ */

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2.5rem;
  background: rgba(6, 6, 10, 0.7);
  backdrop-filter: blur(24px) saturate(180%);
  border-bottom: 1px solid var(--border-subtle);
  transition: all 0.4s var(--ease);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 1rem;
  text-decoration: none;
  color: inherit;
}

.header-brand:hover .logo-mark {
  transform: scale(1.05);
}

/* Logo Mark */
.logo-mark {
  position: relative;
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 4px 20px var(--accent-glow-strong),
    0 0 40px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: logoGlow 4s ease-in-out infinite;
  transition: transform 0.3s var(--ease);
}

.logo-inner {
  position: absolute;
  width: 18px;
  height: 18px;
  background: var(--bg);
  border-radius: 4px;
  animation: logoRotate 12s linear infinite;
  opacity: 0.3;
}

.logo-icon {
  position: relative;
  z-index: 1;
  color: var(--bg);
  font-size: 1.25rem;
}

@keyframes logoGlow {
  0%, 100% {
    box-shadow: 0 4px 20px var(--accent-glow-strong), 0 0 40px var(--accent-glow);
  }
  50% {
    box-shadow: 0 6px 30px var(--accent-glow-strong), 0 0 60px var(--accent-glow-strong), 0 0 80px var(--accent-glow);
  }
}

@keyframes logoRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.header-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Status Indicator */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 100px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #22C55E;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.9);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.8);
  }
}

.status-text {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Avatar */
.avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--surface-2), var(--surface-3));
  border: 1px solid var(--border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: all 0.3s var(--ease);
}

.avatar:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
  transform: scale(1.05);
}

.avatar-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN CONTENT
   ═══════════════════════════════════════════════════════════════ */

.main-content {
  position: relative;
  z-index: 2;
  max-width: 1100px;
  margin: 0 auto;
  padding: 4rem 2.5rem;
}

/* ═══════════════════════════════════════════════════════════════
   WELCOME SECTION
   ═══════════════════════════════════════════════════════════════ */

.welcome {
  text-align: center;
  margin-bottom: 3rem;
}

.greeting-emoji {
  font-size: 2.5rem;
  display: inline-block;
  animation: wave 2.5s ease-in-out infinite;
  transform-origin: 70% 70%;
}

@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(14deg); }
  20% { transform: rotate(-8deg); }
  30% { transform: rotate(14deg); }
  40% { transform: rotate(-4deg); }
  50%, 100% { transform: rotate(0deg); }
}

.welcome-title {
  font-size: 3.25rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0.5rem 0 0.75rem;
  line-height: 1.1;
}

.welcome-name {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 50%, var(--accent) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 4s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.welcome-subtitle {
  font-size: 1.375rem;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 500;
}

.serif-accent {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  color: var(--accent);
}

/* ═══════════════════════════════════════════════════════════════
   STATS BAR
   ═══════════════════════════════════════════════════════════════ */

.stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-bottom: 3.5rem;
}

.stat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.75rem 1.5rem;
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
  border: 1px solid var(--border-subtle);
  border-radius: 24px;
  cursor: default;
  transition: all 0.5s var(--ease);
  will-change: transform;
}

.stat-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--accent-glow), transparent);
  opacity: 0;
  transition: opacity 0.4s;
}

.stat-card:hover {
  border-color: var(--border-glow);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3), 0 0 30px var(--accent-glow);
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-icon-wrap {
  position: relative;
  z-index: 1;
  width: 48px;
  height: 48px;
  background: var(--accent-glow);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
}

.stat-icon {
  color: var(--accent);
  font-size: 1.375rem;
}

.stat-value {
  position: relative;
  z-index: 1;
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--text), var(--accent-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  position: relative;
  z-index: 1;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION TITLE
   ═══════════════════════════════════════════════════════════════ */

.section-title {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 0 1.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.section-bar {
  width: 4px;
  height: 20px;
  background: linear-gradient(180deg, var(--accent), var(--accent-dark));
  border-radius: 2px;
  box-shadow: 0 0 12px var(--accent-glow-strong);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.75rem;
}

.section-header .section-title {
  margin-bottom: 0;
}

.view-all-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  transition: all 0.2s var(--ease);
  font-family: inherit;
}

.view-all-btn:hover {
  color: var(--accent);
  background: var(--accent-glow);
}

/* ═══════════════════════════════════════════════════════════════
   CREATE SECTION (BENTO GRID)
   ═══════════════════════════════════════════════════════════════ */

.create-section {
  margin-bottom: 3.5rem;
}

.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.create-card {
  position: relative;
  background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
  border: 1px solid var(--border);
  border-radius: 32px;
  padding: 2.25rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.5s var(--ease);
  overflow: hidden;
  will-change: transform;
  color: var(--text);
  font-family: inherit;
}

.create-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--accent-glow), transparent);
  opacity: 0;
  transition: opacity 0.5s;
}

.create-card:hover {
  border-color: var(--accent);
  box-shadow:
    0 25px 70px rgba(0, 0, 0, 0.4),
    0 0 50px var(--accent-glow),
    0 0 100px var(--accent-glow);
}

.create-card:hover::before {
  opacity: 1;
}

.create-card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.create-card:disabled:hover {
  transform: none !important;
  box-shadow: none;
  border-color: var(--border);
}

/* Light Sweep */
.card-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    transparent 40%,
    rgba(255, 255, 255, 0.03) 50%,
    transparent 60%
  );
  transform: translateX(-100%);
  transition: transform 0.8s var(--ease);
}

.create-card:hover .card-shine {
  transform: translateX(100%);
}

/* Card Icons */
.card-icon {
  position: relative;
  z-index: 1;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.625rem;
  margin-bottom: 1.5rem;
  transition: transform 0.4s var(--ease-bounce);
}

.create-card:hover .card-icon {
  transform: scale(1.1) rotate(-5deg);
}

.card-icon-primary {
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: var(--bg);
  box-shadow:
    0 8px 30px var(--accent-glow-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.card-icon-secondary {
  background: linear-gradient(135deg, var(--accent-glow) 0%, rgba(0, 210, 190, 0.05) 100%);
  border: 1px solid rgba(0, 210, 190, 0.25);
  color: var(--accent);
}

.card-icon-tertiary {
  background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.card-title {
  position: relative;
  z-index: 1;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 0.625rem;
  letter-spacing: -0.02em;
  color: var(--text);
}

.card-desc {
  position: relative;
  z-index: 1;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.card-arrow {
  position: absolute;
  bottom: 2.25rem;
  right: 2.25rem;
  font-size: 1.375rem;
  color: var(--accent);
  opacity: 0;
  transform: translate(-12px, 0);
  transition: all 0.4s var(--ease);
}

.create-card:hover .card-arrow {
  opacity: 1;
  transform: translate(0, 0);
}

/* AI Badge */
.ai-badge {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent);
  background: linear-gradient(135deg, var(--accent-glow), rgba(0, 210, 190, 0.05));
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(0, 210, 190, 0.2);
}

.ai-badge-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: statusPulse 2s ease-in-out infinite;
}

/* ═══════════════════════════════════════════════════════════════
   RECENT SECTION
   ═══════════════════════════════════════════════════════════════ */

.recent-section {
  margin-bottom: 3rem;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5rem;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border-subtle);
  border-radius: 32px;
}

.loading-orbit {
  width: 60px;
  height: 60px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  position: relative;
}

.loading-dot {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 12px var(--accent-glow-strong);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5rem 2rem;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border-subtle);
  border-radius: 32px;
  text-align: center;
}

/* Orbital System */
.orbit-system {
  position: relative;
  width: 180px;
  height: 180px;
  margin-bottom: 2.5rem;
}

.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  border: 2px dashed var(--border);
}

.orbit-1 {
  width: 160px;
  height: 160px;
  transform: translate(-50%, -50%);
  animation: orbitSpin 25s linear infinite;
}

.orbit-2 {
  width: 110px;
  height: 110px;
  border-color: var(--accent);
  opacity: 0.4;
  transform: translate(-50%, -50%);
  animation: orbitSpin 18s linear infinite reverse;
}

.orbit-3 {
  width: 60px;
  height: 60px;
  border-style: solid;
  border-color: var(--accent);
  opacity: 0.6;
  transform: translate(-50%, -50%);
  animation: orbitSpin 12s linear infinite;
}

.orbit-dot {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 10px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 15px var(--accent-glow-strong);
  animation: dotPulse 2s ease-in-out infinite;
}

@keyframes orbitSpin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes dotPulse {
  0%, 100% {
    transform: translateX(-50%) scale(1);
    box-shadow: 0 0 15px var(--accent-glow-strong);
  }
  50% {
    transform: translateX(-50%) scale(1.3);
    box-shadow: 0 0 25px var(--accent-glow-intense);
  }
}

.center-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  border-radius: 50%;
  box-shadow:
    0 0 30px var(--accent-glow-strong),
    0 0 60px var(--accent-glow);
  animation: corePulse 3s ease-in-out infinite;
}

@keyframes corePulse {
  0%, 100% {
    box-shadow: 0 0 30px var(--accent-glow-strong), 0 0 60px var(--accent-glow);
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    box-shadow: 0 0 50px var(--accent-glow-strong), 0 0 100px var(--accent-glow-strong);
    transform: translate(-50%, -50%) scale(1.1);
  }
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.625rem;
}

.empty-desc {
  font-size: 1rem;
  color: var(--text-muted);
  margin: 0 0 2.5rem;
}

.empty-actions {
  display: flex;
  gap: 1rem;
}

/* ═══════════════════════════════════════════════════════════════
   BUTTONS
   ═══════════════════════════════════════════════════════════════ */

.btn-primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.75rem;
  background: linear-gradient(135deg, var(--accent), var(--accent-dark));
  color: var(--bg);
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s var(--ease);
  box-shadow:
    0 4px 20px var(--accent-glow),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  font-family: inherit;
}

.btn-primary:hover {
  box-shadow:
    0 8px 40px var(--accent-glow-strong),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    transparent 40%,
    rgba(255, 255, 255, 0.15) 50%,
    transparent 60%
  );
  transform: translateX(-100%);
  transition: transform 0.6s var(--ease);
}

.btn-primary:hover .btn-shine {
  transform: translateX(100%);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1.75rem;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
  border: 1px solid var(--border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s var(--ease);
  font-family: inherit;
}

.btn-ghost:hover {
  border-color: var(--accent);
  background: var(--surface-3);
  color: var(--accent);
}

.magnetic-btn {
  will-change: transform;
  transition: transform 0.2s var(--ease), box-shadow 0.3s var(--ease), background 0.3s var(--ease), border-color 0.3s var(--ease);
}

/* ═══════════════════════════════════════════════════════════════
   MAPS GRID
   ═══════════════════════════════════════════════════════════════ */

.maps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.map-card {
  position: relative;
  background: linear-gradient(135deg, var(--surface), var(--surface-2));
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s var(--ease);
  will-change: transform;
}

.map-card:hover {
  border-color: var(--border-glow);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.3),
    0 0 40px var(--accent-glow);
}

.map-delete {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  z-index: 10;
  width: 36px;
  height: 36px;
  background: rgba(6, 6, 10, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s var(--ease);
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-card:hover .map-delete {
  opacity: 1;
}

.map-delete:hover {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
}

.map-preview {
  aspect-ratio: 16 / 9;
  background: var(--surface-2);
  overflow: hidden;
}

.map-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s var(--ease);
}

.map-card:hover .map-img {
  transform: scale(1.05);
}

.map-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--surface-2), var(--surface));
  font-size: 2.5rem;
  color: var(--text-dim);
}

.map-info {
  padding: 1.25rem;
}

.map-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s var(--ease);
}

.map-card:hover .map-title {
  color: var(--accent);
}

.map-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */

.footer {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 3rem 2rem;
  border-top: 1px solid var(--border-subtle);
  background: rgba(6, 6, 10, 0.5);
  backdrop-filter: blur(12px);
}

.footer-brand {
  font-size: 0.9rem;
  color: var(--text-dim);
  margin: 0;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.footer-link {
  font-size: 0.9rem;
  color: var(--text-muted);
  text-decoration: none;
  position: relative;
  transition: color 0.2s var(--ease);
}

.footer-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--accent);
  transform: scaleX(0);
  transition: transform 0.3s var(--ease);
}

.footer-link:hover {
  color: var(--accent);
}

.footer-link:hover::after {
  transform: scaleX(1);
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS
   ═══════════════════════════════════════════════════════════════ */

@keyframes revealUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal-up {
  animation: revealUp 0.8s var(--ease) forwards;
  opacity: 0;
}

.delay-1 { animation-delay: 0.1s; }
.delay-2 { animation-delay: 0.2s; }
.delay-3 { animation-delay: 0.3s; }

/* ═══════════════════════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════════════════════ */

@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bento-grid .create-card:last-child {
    grid-column: span 2;
  }

  .maps-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .header {
    padding: 1rem 1.5rem;
  }

  .status-indicator {
    display: none;
  }

  .main-content {
    padding: 2.5rem 1.5rem;
  }

  .welcome-title {
    font-size: 2.25rem;
  }

  .welcome-subtitle {
    font-size: 1.125rem;
  }

  .stats-bar {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .bento-grid {
    grid-template-columns: 1fr;
  }

  .bento-grid .create-card:last-child {
    grid-column: span 1;
  }

  .maps-grid {
    grid-template-columns: 1fr;
  }

  .create-card {
    padding: 1.75rem;
  }

  .orbit-system {
    width: 140px;
    height: 140px;
  }

  .orbit-1 { width: 120px; height: 120px; }
  .orbit-2 { width: 80px; height: 80px; }
  .orbit-3 { width: 40px; height: 40px; }

  .empty-actions {
    flex-direction: column;
    width: 100%;
  }

  .empty-actions .btn-primary,
  .empty-actions .btn-ghost {
    width: 100%;
    justify-content: center;
  }

  .footer-links {
    gap: 1.5rem;
  }

  /* Disable cursor glow on touch devices */
  .cursor-glow {
    display: none;
  }
}

@media (max-width: 480px) {
  .welcome-title {
    font-size: 1.875rem;
  }

  .card-icon {
    width: 52px;
    height: 52px;
    font-size: 1.375rem;
  }

  .card-title {
    font-size: 1.2rem;
  }
}

/* ═══════════════════════════════════════════════════════════════
   HIDDEN UTILITY
   ═══════════════════════════════════════════════════════════════ */

.hidden {
  display: none;
}

/* ═══════════════════════════════════════════════════════════════
   MODAL STYLES
   ═══════════════════════════════════════════════════════════════ */

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  position: relative;
  width: 90%;
  max-width: 480px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  overflow: hidden;
  animation: slideUp 0.3s var(--ease);
  box-shadow:
    0 25px 80px rgba(0, 0, 0, 0.5),
    0 0 60px var(--accent-glow);
}

.modal-wide {
  max-width: 700px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 2rem 2rem 1.5rem;
  text-align: center;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
}

.modal-icon-ai {
  background: linear-gradient(135deg, var(--accent-glow) 0%, rgba(0, 210, 190, 0.05) 100%);
  border: 1px solid rgba(0, 210, 190, 0.25);
  color: var(--accent);
}

.modal-icon-templates {
  background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
  color: var(--text);
}

.modal-subtitle {
  font-size: 0.95rem;
  color: var(--text-muted);
  margin: 0;
}

.modal-body {
  padding: 1.5rem 2rem;
}

.modal-input {
  width: 100%;
  padding: 1rem 1.25rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s var(--ease);
}

.modal-input::placeholder {
  color: var(--text-dim);
}

.modal-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.modal-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-2);
}

/* ═══════════════════════════════════════════════════════════════
   TEMPLATES GRID
   ═══════════════════════════════════════════════════════════════ */

.templates-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

@media (max-width: 600px) {
  .templates-grid {
    grid-template-columns: 1fr;
  }
}

.template-card {
  position: relative;
  padding: 1.25rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s var(--ease);
  overflow: hidden;
  font-family: inherit;
  color: var(--text);
}

.template-card:hover {
  border-color: var(--accent);
  background: var(--surface-3);
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px var(--accent-glow);
}

.template-icon {
  width: 44px;
  height: 44px;
  background: var(--accent-glow);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--accent);
  margin-bottom: 0.875rem;
}

.template-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.375rem;
  color: var(--text);
}

.template-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0 0 1rem;
  line-height: 1.4;
}

.template-preview {
  position: relative;
  height: 60px;
  background: var(--surface);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.template-preview-node {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.7;
  box-shadow: 0 0 8px var(--accent-glow-strong);
}

.template-card:hover .template-preview-node {
  opacity: 1;
}
</style>
