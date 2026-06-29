<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'
import { useAISettings } from '~/composables/useAISettings'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { useGenerationQueue } from '~/composables/useGenerationQueue'
import { useMapImport } from '~/composables/useMapImport'
import { mapServerToDoc } from '~/utils/mapServer'
import { safeImageUrl } from '~/utils/safeUrl'
import type { GenerationTone } from '~/types'

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
const avatarSrc = computed(() => safeImageUrl((user.value as { image?: string | null } | undefined)?.image))
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
const syncEngine = useSyncEngine()
const aiSettings = useAISettings()
const genQueue = useGenerationQueue()
const toast = useToast()
const { handleSignOut, isLoading: signOutLoading } = useAuthStore()

// State
const recentMaps = ref<DBMapDocument[]>([])
const isLoading = ref(true)
const isCreatingMap = ref(false)

// Delete confirmation
const deleteConfirmVisible = ref(false)
const deleteTargetId = ref<string | null>(null)

// Bounds for AI node count + the dashboard's visible-map window. Named so the
// clamps below read as intent rather than bare magic numbers.
const MIN_NODE_COUNT = 4
const MAX_NODE_COUNT = 10000
const DEFAULT_NODE_COUNT = 24
const VISIBLE_MAP_LIMIT = 4

// AI Quick Start — generation runs in the BACKGROUND via the generation queue
// (see GenerationProgressDock) so the user can leave this page while a map
// builds, watch progress in the corner dock, and get a notification when done.
const showAIModal = ref(false)
const aiTopic = ref('')
const aiError = ref<string | null>(null)
const aiTone = ref<GenerationTone>('neutral')
const aiNodeCount = ref(DEFAULT_NODE_COUNT)

const aiToneOptions = computed(() => [
  { value: 'neutral', label: t('canvas.gen_options.tone_neutral') },
  { value: 'academic', label: t('canvas.gen_options.tone_academic') },
  { value: 'professional', label: t('canvas.gen_options.tone_professional') },
  { value: 'casual', label: t('canvas.gen_options.tone_casual') },
  { value: 'creative', label: t('canvas.gen_options.tone_creative') },
])

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

// Visible map limit — show 4 most-recent by default; "Show more" reveals the rest
const showAllMaps = ref(false)
const visibleLimit = ref(VISIBLE_MAP_LIMIT)
const mapsGridRef = ref<HTMLElement | null>(null)

function updateVisibleLimit() {
  visibleLimit.value = VISIBLE_MAP_LIMIT
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
        const remoteMaps = response.maps.map(mapServerToDoc)

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
      recentMaps.value = response.maps.map(mapServerToDoc)
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

// AI Quick Start — enqueue a background generation and close the modal so the
// user is free immediately. Progress + the "open map" handoff live in the
// global GenerationProgressDock; we don't block or navigate here.
function handleAIQuickStart() {
  const topic = aiTopic.value.trim()
  if (!topic) return
  aiError.value = null

  genQueue.enqueueMapGeneration(topic, {
    branchCount: 5,
    maxDepth: 2,
    nodeCount: aiNodeCount.value,
    style: 'detailed',
    tone: aiTone.value,
    includeCrossConnections: true,
    locale: currentLocale.value,
  })

  toast.success(t('generation.toast_started', { topic }))
  aiTopic.value = ''
  showAIModal.value = false
}

function setAiNodeCount(value: number) {
  aiNodeCount.value = Math.min(MAX_NODE_COUNT, Math.max(MIN_NODE_COUNT, Math.round(value) || MIN_NODE_COUNT))
}

// Import — file parsing + persistence lives in useMapImport() so this page
// stays focused on presentation. Modal state stays here.
const mapImport = useMapImport()

function triggerImport() {
  showImportModal.value = true
}

async function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  await mapImport.processImportedFile(file)
  if (fileInput.value) fileInput.value.value = ''
}

async function handleFilePondFile(file: File) {
  showImportModal.value = false
  await mapImport.processImportedFile(file)
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
                <img v-if="avatarSrc" :src="avatarSrc" :alt="userName" class="m-avatar-img" referrerpolicy="no-referrer">
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
            <p class="dheader-eyebrow">{{ $t('dashboard.header.eyebrow') }}</p>
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
          <span class="dsection-text">{{ $t('dashboard.sections.recent_count', { current: Math.min(visibleMaps.length, sortedMaps.length), total: sortedMaps.length }) }}</span>
          <button type="button" class="dsort" @click="sortBy = sortBy === 'recent' ? 'alphabetical' : 'recent'">
            <span class="dsort-prefix">{{ $t('dashboard.sections.sort_by') }}</span>
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
                    <span class="dcard-blob teal" />
                    <span class="dcard-blob gray" />
                  </div>
                  <div class="dcard-thumb-row dcard-thumb-row--mid">
                    <span class="dcard-blob gray dim" />
                    <span class="dcard-blob teal solid" />
                    <span class="dcard-blob gray dim" />
                  </div>
                  <div class="dcard-thumb-row">
                    <span class="dcard-blob teal" />
                    <span class="dcard-blob gray dim" />
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
                <span class="doverview-eyebrow">{{ $t('dashboard.overview.eyebrow') }}</span>
                <span class="doverview-period">{{ $t('dashboard.overview.period') }}</span>
              </div>
              <div class="doverview-stats">
                <div class="dov-stat">
                  <span class="dov-num">{{ stats.totalMaps }}</span>
                  <span class="dov-label">{{ $t('dashboard.overview.total_maps') }}</span>
                </div>
                <div class="dov-stat">
                  <span class="dov-num">{{ stats.totalNodes }}</span>
                  <span class="dov-label">{{ $t('dashboard.overview.total_nodes') }}</span>
                </div>
                <div class="dov-stat">
                  <span class="dov-num accent">{{ stats.aiGenerated }}</span>
                  <span class="dov-label">{{ $t('dashboard.overview.ai_generated') }}</span>
                </div>
                <div class="dov-stat">
                  <span class="dov-num">{{ stats.connections }}</span>
                  <span class="dov-label">{{ $t('dashboard.overview.connections') }}</span>
                </div>
              </div>
              <!-- Decorative activity sparkline; bar heights live in CSS
                   (.doverview-chart .dov-bar:nth-child(n)) per the no-inline-style rule. -->
              <div class="doverview-chart">
                <div class="dov-bar" />
                <div class="dov-bar" />
                <div class="dov-bar" />
                <div class="dov-bar dov-bar--t1" />
                <div class="dov-bar dov-bar--t2" />
                <div class="dov-bar" />
                <div class="dov-bar dov-bar--t3" />
                <div class="dov-bar dov-bar--t1" />
                <div class="dov-bar" />
                <div class="dov-bar" />
                <div class="dov-bar dov-bar--t4" />
                <div class="dov-bar dov-bar--peak" />
                <div class="dov-bar dov-bar--t1" />
                <div class="dov-bar" />
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
              <span class="dai-banner-title">{{ $t('dashboard.ai_banner.title') }}</span>
              <span class="dai-banner-quote">“{{ $t('common.guest.template_picker_ai_placeholder') }}”</span>
            </div>
            <span class="dai-banner-cta">
              <span>{{ $t('dashboard.ai_banner.try_it') }}</span>
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

      <!-- AI Modal — both phases (input + generating) run fullscreen so
           the user knows they're committing to an AI workflow, not
           dismissing a tiny dialog. Treats AI generation as a primary
           destination rather than an afterthought modal. -->
      <Teleport to="body">
        <div
          v-if="showAIModal"
          class="modal-overlay modal-overlay--fullscreen"
          @click.self="showAIModal = false"
        >
          <div class="ai-modal ai-modal--fullscreen">
            <button
              class="ai-fullscreen-close"
              :aria-label="$t('dashboard.ai_modal.cancel')"
              @click="showAIModal = false"
            >
              <span class="i-lucide-x" />
            </button>
            <div class="ai-modal-content ai-modal-content--fullscreen">
              <div class="ai-fullscreen-stack">
                <div class="ai-fullscreen-eyebrow">{{ $t('dashboard.ai_modal.title') }}</div>
                <h2 class="ai-fullscreen-title">{{ $t('dashboard.ai_modal.description') }}</h2>
                <p class="ai-fullscreen-subtitle">{{ $t('dashboard.ai_modal.subtitle') }}</p>
                <div class="ai-fullscreen-input-row">
                  <input
                    v-model="aiTopic"
                    type="text"
                    class="ai-fullscreen-input"
                    :placeholder="$t('dashboard.ai_modal.placeholder')"
                    autofocus
                    @keyup.enter="handleAIQuickStart"
                  >
                  <button
                    class="ai-fullscreen-generate"
                    :disabled="!aiTopic.trim()"
                    @click="handleAIQuickStart"
                  >
                    <span>{{ $t('dashboard.ai_modal.generate') }}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </button>
                </div>

                <!-- Generation options: broj nodova + ton -->
                <div class="ai-fullscreen-options">
                  <div class="ai-opt-count-field">
                    <label class="ai-opt-label">{{ $t('canvas.generate_map.count_label') }}</label>
                    <div class="ai-opt-count">
                      <input
                        :value="aiNodeCount"
                        type="number"
                        :min="MIN_NODE_COUNT"
                        :max="MAX_NODE_COUNT"
                        class="ai-opt-count-input"
                        @input="setAiNodeCount(Number(($event.target as HTMLInputElement).value))"
                      >
                      <span class="ai-opt-count-suffix">{{ $t('canvas.generate_map.count_suffix') }}</span>
                    </div>
                  </div>
                  <CanvasGenOptionPills
                    :label="$t('canvas.gen_options.tone_label')"
                    :options="aiToneOptions"
                    :model-value="aiTone"
                    @update:model-value="aiTone = ($event as GenerationTone)"
                  />
                </div>

                <div v-if="aiError" class="ai-error-banner">
                  <span class="i-lucide-alert-triangle ai-error-icon" />
                  <span class="ai-error-text">{{ aiError }}</span>
                  <button class="ai-error-dismiss" @click="aiError = null"><span class="i-lucide-x" /></button>
                </div>
              </div>
            </div>
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
          <div class="modal modal--narrow">
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
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: var(--d-text-4);
  margin: 0;
  line-height: 14px;
}

.dheader-title {
  font-family: 'Inter', sans-serif;
  font-size: calc(28px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(11px * var(--nc-text-scale, 1));
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

.dsort-prefix { font-size: calc(12px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 16px; color: var(--d-text-4); }
.dsort-value { font-size: calc(12px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 16px; color: var(--d-text-2); }
.dsort svg { color: var(--d-text-2); }

/* Maps grid */
.dmaps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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

/* Per-blob widths for the decorative thumbnail (was inline; moved here per the
   no-inline-style rule). Positional so the placeholder pattern stays identical. */
.dcard-thumb-row:nth-child(1) .dcard-blob:nth-child(1) { width: 48px; }
.dcard-thumb-row:nth-child(1) .dcard-blob:nth-child(2) { width: 56px; }
.dcard-thumb-row--mid .dcard-blob:nth-child(1) { width: 40px; }
.dcard-thumb-row--mid .dcard-blob:nth-child(2) { width: 52px; height: 22px; }
.dcard-thumb-row--mid .dcard-blob:nth-child(3) { width: 44px; }
.dcard-thumb-row:nth-child(3) .dcard-blob:nth-child(1) { width: 44px; }
.dcard-thumb-row:nth-child(3) .dcard-blob:nth-child(2) { width: 50px; }

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
  font-size: calc(11px * var(--nc-text-scale, 1));
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
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(11px * var(--nc-text-scale, 1));
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
  font-size: calc(40px * var(--nc-text-scale, 1));
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--d-text);
}

.dov-num.accent { color: var(--d-accent); }

.dov-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
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

/* Decorative bar heights (was inline; moved here per the no-inline-style rule). */
.doverview-chart .dov-bar:nth-child(1)  { height: 8px; }
.doverview-chart .dov-bar:nth-child(2)  { height: 14px; }
.doverview-chart .dov-bar:nth-child(3)  { height: 6px; }
.doverview-chart .dov-bar:nth-child(4)  { height: 22px; }
.doverview-chart .dov-bar:nth-child(5)  { height: 18px; }
.doverview-chart .dov-bar:nth-child(6)  { height: 10px; }
.doverview-chart .dov-bar:nth-child(7)  { height: 30px; }
.doverview-chart .dov-bar:nth-child(8)  { height: 24px; }
.doverview-chart .dov-bar:nth-child(9)  { height: 12px; }
.doverview-chart .dov-bar:nth-child(10) { height: 16px; }
.doverview-chart .dov-bar:nth-child(11) { height: 28px; }
.doverview-chart .dov-bar:nth-child(12) { height: 36px; }
.doverview-chart .dov-bar:nth-child(13) { height: 20px; }
.doverview-chart .dov-bar:nth-child(14) { height: 8px; }

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
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--d-text);
}

.dai-banner-quote {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-size: calc(16px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
.dempty-icon { font-size: calc(32px * var(--nc-text-scale, 1)); color: var(--d-text-4); margin-bottom: 16px; }
.dempty-title { font-size: calc(18px * var(--nc-text-scale, 1)); font-weight: 600; color: var(--d-text); margin: 0 0 8px; }
.dempty-desc { font-size: calc(13px * var(--nc-text-scale, 1)); color: var(--d-text-3); margin: 0 0 24px; }

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

/* Fullscreen takeover for the AI generation phase. Drops the padding +
   any backdrop blur so the inner modal can fill the viewport, and
   uses a heavier scrim so the cancelled canvas behind isn't a visual
   distraction during the ~20-30s generation. */
.modal-overlay--fullscreen {
  padding: 0;
  background: rgba(7, 7, 9, 0.96);
  backdrop-filter: blur(10px);
}
:root.light .modal-overlay--fullscreen {
  background: rgba(250, 250, 249, 0.97);
}

.modal, .ai-modal {
  background: var(--d-surface);
  border: 1px solid var(--d-border-2);
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  overflow: hidden;
  color: var(--d-text);
}

.ai-modal--fullscreen {
  /* Take the whole viewport — let the surrounding overlay scrim do the
     "this is a modal" affordance, no border/radius needed. */
  max-width: 100vw;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-wide { max-width: 720px; }
.modal--narrow { max-width: 400px; }
.modal-header { padding: 24px 24px 16px; border-bottom: 1px solid var(--d-border); }
.modal-icon {
  width: 40px; height: 40px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--d-accent-soft); color: var(--d-accent);
  font-size: calc(20px * var(--nc-text-scale, 1)); margin-bottom: 16px;
}
.modal-icon-danger { background: rgba(220, 38, 38, 0.1); color: #DC2626; }
.modal-title { font-size: calc(18px * var(--nc-text-scale, 1)); font-weight: 600; color: var(--d-text); margin: 0 0 6px; }
.modal-subtitle { font-size: calc(13px * var(--nc-text-scale, 1)); color: var(--d-text-3); margin: 0; line-height: 1.5; }
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
  font-size: calc(16px * var(--nc-text-scale, 1));
}
.template-name { font-size: calc(14px * var(--nc-text-scale, 1)); font-weight: 600; color: var(--d-text); margin: 0; }
.template-desc { font-size: calc(12px * var(--nc-text-scale, 1)); color: var(--d-text-3); margin: 0; line-height: 1.5; }

.import-hint { font-size: calc(11px * var(--nc-text-scale, 1)); color: var(--d-text-4); text-align: center; margin: 12px 0 0; }

.ai-modal-content { padding: 28px; }
.ai-modal-title { font-size: calc(20px * var(--nc-text-scale, 1)); font-weight: 600; color: var(--d-text); margin: 0 0 6px; line-height: 1.3; }
.ai-modal-subtitle { font-size: calc(13px * var(--nc-text-scale, 1)); color: var(--d-text-3); margin: 0 0 20px; line-height: 1.5; }
.ai-modal-input-wrap { margin-bottom: 16px; }
.ai-modal-input {
  width: 100%; padding: 12px 14px;
  background: var(--d-surface-2); border: 1px solid var(--d-border-2);
  border-radius: 8px; color: var(--d-text);
  font-family: 'Inter', sans-serif; font-size: calc(14px * var(--nc-text-scale, 1));
  outline: none; transition: border-color 120ms ease;
}
.ai-modal-input:focus { border-color: var(--d-accent); }
.ai-error-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 6px; margin-bottom: 16px;
  color: #FCA5A5; font-size: calc(13px * var(--nc-text-scale, 1));
}
.ai-error-icon { color: #EF4444; flex-shrink: 0; }
.ai-error-text { flex: 1; }
.ai-error-dismiss { background: transparent; border: none; color: #FCA5A5; cursor: pointer; }
.ai-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.ai-modal-cancel {
  padding: 8px 14px; background: transparent;
  border: 1px solid var(--d-border-2); border-radius: 6px;
  color: var(--d-text-2); font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 500; cursor: pointer;
}
.ai-modal-generate {
  padding: 8px 16px; background: var(--d-accent);
  border: none; border-radius: 6px;
  color: #09090B; font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 600; cursor: pointer;
}
.ai-modal-generate:disabled { opacity: 0.5; cursor: not-allowed; }
.ai-progress-bar {
  position: relative;
  height: 4px;
  background: var(--d-surface-3);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 20px;
}
.ai-progress-fill {
  position: relative;
  height: 100%;
  background: var(--d-accent);
  transition: width 600ms cubic-bezier(0.23, 1, 0.32, 1);
  /* Indeterminate shimmer that travels through the filled portion
     while we wait between discrete step updates — keeps the bar feeling
     alive even when the % isn't changing. */
  overflow: hidden;
}
.ai-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.45) 50%,
    transparent 100%
  );
  animation: ai-progress-shimmer 1.6s linear infinite;
}
@keyframes ai-progress-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.ai-steps { display: flex; flex-direction: column; gap: 10px; }
.ai-step {
  display: flex; align-items: center; gap: 10px;
  font-size: calc(13px * var(--nc-text-scale, 1)); color: var(--d-text-4);
  /* Fade-in when a step appears or its status changes. */
  transition: color 300ms ease;
}
.ai-step--active { color: var(--d-text); }
.ai-step--done { color: var(--d-text-2); }
.ai-step-indicator {
  position: relative;
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--d-border-2); flex-shrink: 0;
  transition: border-color 200ms ease, background 200ms ease;
}
.ai-step--active .ai-step-indicator,
.ai-step--done .ai-step-indicator {
  border-color: var(--d-accent); color: var(--d-accent);
  background: var(--d-accent-soft);
}
/* Halo ring around the ACTIVE step's indicator — breathes outward to
   draw the eye to where work is happening right now. */
.ai-step--active .ai-step-indicator::before {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  border: 1.5px solid var(--d-accent);
  opacity: 0.55;
  animation: ai-step-halo 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes ai-step-halo {
  0%, 100% { transform: scale(1);    opacity: 0.55; }
  50%      { transform: scale(1.4);  opacity: 0;    }
}
.ai-step-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--d-accent); animation: pulse 1s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .ai-progress-fill::after,
  .ai-step--active .ai-step-indicator::before,
  .ai-step-dot { animation: none !important; }
}

/* Fullscreen generation hero layout. Centered column, larger
   typography, progress bar feels load-bearing rather than incidental. */
.ai-modal-content--fullscreen {
  padding: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-fullscreen-stack {
  width: 100%;
  max-width: 640px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Top-right dismiss — only visible in input phase, suppressed during
   generation so the user doesn't accidentally cancel a long task. */
.ai-fullscreen-close {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--d-text-3);
  font-size: calc(16px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}
.ai-fullscreen-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--d-text);
}
:root.light .ai-fullscreen-close {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
  color: #52525B;
}
:root.light .ai-fullscreen-close:hover {
  background: rgba(0, 0, 0, 0.07);
  color: #18181B;
}

/* Hero input — wide, single-line, with an inline send button. */
.ai-fullscreen-input-row {
  display: flex;
  gap: 10px;
  align-items: stretch;
}
.ai-fullscreen-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 18px;
  text-align: left;
}
.ai-opt-count-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-opt-label {
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--d-text-3);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.ai-opt-count {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ai-opt-count-input {
  width: 110px;
  padding: 4px 8px;
  background: var(--d-surface);
  border: 1px solid var(--d-border-2);
  border-radius: 8px;
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: calc(22px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--d-text);
  -moz-appearance: textfield;
}
.ai-opt-count-input:focus {
  outline: none;
  border-color: var(--d-accent);
}
.ai-opt-count-input::-webkit-outer-spin-button,
.ai-opt-count-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.ai-opt-count-suffix {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--d-text-3);
}
.ai-fullscreen-input {
  flex: 1;
  height: 52px;
  padding: 0 18px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(16px * var(--nc-text-scale, 1));
  color: var(--d-text);
  background: var(--d-surface);
  border: 1px solid var(--d-border-2);
  border-radius: 10px;
  outline: none;
  transition: border-color 150ms ease;
}
.ai-fullscreen-input::placeholder {
  color: var(--d-text-4);
}
.ai-fullscreen-input:focus {
  border-color: var(--d-accent);
}
.ai-fullscreen-generate {
  height: 52px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: #0A0A0C;
  background: #00D2BE;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition: background 150ms ease, transform 120ms ease;
}
.ai-fullscreen-generate:hover {
  background: #1AE0CD;
}
.ai-fullscreen-generate:active {
  transform: scale(0.98);
}
.ai-fullscreen-generate:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: #00D2BE;
}
:root.light .ai-fullscreen-generate {
  background: #00A89A;
  color: #FFFFFF;
  box-shadow: none;
}
:root.light .ai-fullscreen-generate:hover {
  background: #00BFAF;
}
.ai-fullscreen-eyebrow {
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--d-text-4);
  margin: 0;
}
.ai-fullscreen-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--d-text);
  margin: 0;
  /* Long topic names + quoted strings get a soft wrap rather than overflow. */
  word-break: break-word;
}
/* Live eyebrow variant — spinner + bouncing dots so the user knows
   work is happening even while the progress % between step boundaries.
   Composes with the base eyebrow style. */
.ai-fullscreen-eyebrow--live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--d-accent);
}
.ai-eyebrow-spinner {
  display: inline-block;
  font-size: calc(12px * var(--nc-text-scale, 1));
  animation: ai-eyebrow-spin 1s linear infinite;
}
@keyframes ai-eyebrow-spin { to { transform: rotate(360deg); } }
.ai-eyebrow-dots {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  margin-left: 2px;
  height: 12px;
}
.ai-eyebrow-dot {
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: currentColor;
  animation: ai-eyebrow-bounce 1.4s ease-in-out infinite both;
}
.ai-eyebrow-dot:nth-child(2) { animation-delay: 0.15s; }
.ai-eyebrow-dot:nth-child(3) { animation-delay: 0.30s; }
@keyframes ai-eyebrow-bounce {
  0%, 80%, 100% { transform: translateY(0);   opacity: 0.35; }
  40%           { transform: translateY(-3px); opacity: 1;    }
}
@media (prefers-reduced-motion: reduce) {
  .ai-eyebrow-spinner,
  .ai-eyebrow-dot { animation: none; }
}

/* Supporting line under the H2 — sits ~6px below, lighter weight, capped
   at 65ch for readable line length per Pro Max typography rule. */
.ai-fullscreen-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 1.55;
  color: var(--d-text-3);
  margin: -14px 0 0;
  max-width: 65ch;
}
.ai-fullscreen-progress {
  display: flex;
  align-items: center;
  gap: 14px;
}
.ai-fullscreen-progress .ai-progress-bar {
  flex: 1;
  height: 6px;
  margin-bottom: 0;
}
.ai-fullscreen-pct {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--d-text-3);
  min-width: 38px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ai-steps--fullscreen {
  gap: 14px;
}
.ai-steps--fullscreen .ai-step {
  font-size: calc(14px * var(--nc-text-scale, 1));
}
.ai-steps--fullscreen .ai-step-indicator {
  width: 20px;
  height: 20px;
}
@media (max-width: 640px) {
  .ai-fullscreen-stack {
    padding: 24px;
    gap: 22px;
  }
}
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.8); } }
.ai-step-label { flex: 1; }
.ai-step-elapsed { font-family: 'JetBrains Mono', monospace; font-size: calc(11px * var(--nc-text-scale, 1)); color: var(--d-text-4); }

.hidden { display: none; }

/* ═══════════════════════ RESPONSIVE ═══════════════════════ */
@media (max-width: 1280px) {
  .dmain { padding: 24px 32px 40px; }
  .dheader-title { font-size: calc(24px * var(--nc-text-scale, 1)); line-height: 30px; }
  .doverview-stats { gap: 28px; }
  .dov-num { font-size: calc(34px * var(--nc-text-scale, 1)); }
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
    font-size: calc(17px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 22px;
    letter-spacing: -0.01em; color: var(--d-text); margin: 0;
  }
  .m-avatar-link { display: flex; align-items: center; text-decoration: none; }
  .m-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: #1A1A1E; border: 1px solid #1E1E22;
    color: #00D2BE;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 16px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  :root.light .m-avatar {
    background: #F5F5F4;
    border-color: #E8E8E6;
    color: #00A89A;
    /* Extra inset ring so dark profile photos don't fight the warm-paper sidebar. */
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  }
  .m-avatar-img { width: 100%; height: 100%; object-fit: cover; }

  /* Page title */
  .m-page-title {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(28px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 34px;
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
    font-size: calc(14px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 18px;
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
    font-size: calc(15px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 18px;
    letter-spacing: 0; text-transform: none;
    color: inherit;
  }
  .dsort {
    background: none; border: none; padding: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(14px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 18px;
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
  .dsort-value::before { font-size: calc(14px * var(--nc-text-scale, 1)); }

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
    font-size: calc(15px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 18px;
    color: var(--d-text); margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dcard-date {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 16px;
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
    font-size: calc(10px * var(--nc-text-scale, 1)); font-weight: 500;
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
    font-size: calc(36px * var(--nc-text-scale, 1)); font-weight: 400; line-height: 1;
    letter-spacing: -0.01em;
    color: #FAFAFA;
  }
  :root.light .dov-num { color: #18181B; }
  .dov-num.accent { color: #00D2BE; }
  :root.light .dov-num.accent { color: #00A89A; }
  .doverview-stats > div > span:last-child {
    font-family: 'JetBrains Mono', monospace;
    font-size: calc(10px * var(--nc-text-scale, 1)); font-weight: 500;
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
