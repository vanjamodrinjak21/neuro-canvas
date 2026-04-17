<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { useMapStore } from '~/stores/mapStore'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import { useSyncEngine } from '~/composables/useSyncEngine'

definePageMeta({
  layout: false,
  middleware: 'auth'
})

const db = useDatabase()
const mapStore = useMapStore()
const router = useRouter()
const syncEngine = useSyncEngine()
const { confirm, ConfirmDialog } = useConfirmDialog()

// State
const allMaps = ref<DBMapDocument[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const sortBy = ref<'recent' | 'alphabetical' | 'nodes'>('recent')

// Selection state
const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

const selectedCount = computed(() => selectedIds.value.size)
const allSelected = computed(() =>
  filteredMaps.value.length > 0 && selectedIds.value.size === filteredMaps.value.length
)

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedIds.value = new Set()
}

function toggleSelect(mapId: string, event: Event) {
  event.stopPropagation()
  const next = new Set(selectedIds.value)
  if (next.has(mapId)) next.delete(mapId)
  else next.add(mapId)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredMaps.value.map(m => m.id))
  }
}

async function deleteSelected() {
  if (selectedIds.value.size === 0) return

  const count = selectedIds.value.size
  const confirmed = await confirm({
    title: `Delete ${count} map${count > 1 ? 's' : ''}`,
    description: `This will permanently delete ${count} map${count > 1 ? 's' : ''}. This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    variant: 'danger',
    icon: 'i-lucide-trash-2'
  })

  if (!confirmed) return

  try {
    for (const id of selectedIds.value) {
      // Delete from server
      if (!_isTauri && syncEngine.isSyncEnabled.value) {
        await $fetch('/api/sync/push', {
          method: 'POST',
          body: { mapId: id, data: {}, title: '', checksum: '', action: 'delete', deviceId: '' }
        }).catch(() => {})
      }
      await db.deleteMap(id)
    }
    allMaps.value = allMaps.value.filter(m => !selectedIds.value.has(m.id))
    selectedIds.value = new Set()
    selectMode.value = false
  } catch (error) {
    console.error('Failed to delete maps:', error)
  }
}

// Filtered and sorted maps
const filteredMaps = computed(() => {
  let maps = [...allMaps.value]

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    maps = maps.filter(m => m.title.toLowerCase().includes(query))
  }

  switch (sortBy.value) {
    case 'recent':
      maps.sort((a, b) => b.updatedAt - a.updatedAt)
      break
    case 'alphabetical':
      maps.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'nodes':
      maps.sort((a, b) => b.nodes.length - a.nodes.length)
      break
  }

  return maps
})

const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const _session = _isTauri ? { data: ref({ user: { id: 'desktop-user' } }) } : useAuth()

// Load all maps from server (PostgreSQL → Redis → client), fallback to IndexedDB
onMounted(async () => {
  try {
    if (!_isTauri && _session.data?.value?.user) {
      const response: { maps: any[] } = await ($fetch as any)('/api/sync/pull')
      allMaps.value = response.maps.map((m: any) => ({
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
        checksum: m.checksum
      })) as DBMapDocument[]
    } else {
      allMaps.value = await db.getAllMaps()
    }
  } catch (error) {
    console.error('Failed to load maps from server, falling back to local:', error)
    allMaps.value = await db.getAllMaps()
  } finally {
    isLoading.value = false
  }
})

function openMap(mapId: string) {
  router.push(`/map/${mapId}`)
}

async function deleteMap(mapId: string, event: Event) {
  event.stopPropagation()

  const confirmed = await confirm({
    title: 'Delete Map',
    description: 'This action cannot be undone. Are you sure you want to delete this map?',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    variant: 'danger',
    icon: 'i-lucide-trash-2'
  })

  if (!confirmed) return

  try {
    // Delete from server
    if (!_isTauri && syncEngine.isSyncEnabled.value) {
      await $fetch('/api/sync/push', {
        method: 'POST',
        body: { mapId, data: {}, title: '', checksum: '', action: 'delete', deviceId: '' }
      })
    }
    await db.deleteMap(mapId)
    allMaps.value = allMaps.value.filter(m => m.id !== mapId)
  } catch (error) {
    console.error('Failed to delete map:', error)
  }
}

async function createNewMap() {
  mapStore.newDocument()
  const doc = mapStore.toSerializable()
  await db.saveMap(doc)
  await navigateTo(`/map/${doc.id}`)
}

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
</script>

<template>
  <div class="maps-layout">
    <AppSidebar active-nav="maps" />
    <MobileTabBar />

    <main class="maps-main">
      <!-- Header -->
      <div class="maps-header">
        <div class="header-left">
          <h1 class="header-title">All Maps</h1>
          <span class="header-count">{{ filteredMaps.length }} mind maps</span>
        </div>

        <div class="header-actions">
          <div class="search-box">
            <span class="i-lucide-search search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              placeholder="Search maps..."
            >
          </div>
          <button
            :class="['btn-filter', selectMode && 'active']"
            @click="toggleSelectMode"
          >
            <span class="i-lucide-check-square" />
            {{ selectMode ? 'Cancel' : 'Select' }}
          </button>
          <button class="btn-sort">
            <span class="i-lucide-arrow-up-down" />
            Sort
          </button>
        </div>
      </div>

      <!-- Select toolbar -->
      <div v-if="selectMode" class="select-bar">
        <button class="btn-select-all" @click="toggleSelectAll">
          <span :class="allSelected ? 'i-lucide-check-square' : 'i-lucide-square'" />
          {{ allSelected ? 'Deselect all' : 'Select all' }}
        </button>
        <span class="select-count">{{ selectedCount }} selected</span>
        <button v-if="selectedCount > 0" class="btn-delete" @click="deleteSelected">
          <span class="i-lucide-trash-2" />
          Delete
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner" />
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredMaps.length === 0 && !searchQuery" class="empty-state">
        <span class="i-lucide-map empty-icon" />
        <h3 class="empty-title">No maps yet</h3>
        <p class="empty-desc">Create your first mind map to get started</p>
        <button class="btn-primary" @click="createNewMap">
          <span class="i-lucide-plus" />
          Create Map
        </button>
      </div>

      <!-- No results -->
      <div v-else-if="filteredMaps.length === 0 && searchQuery" class="empty-state">
        <span class="i-lucide-search-x empty-icon" />
        <h3 class="empty-title">No maps found</h3>
        <p class="empty-desc">Try a different search term</p>
        <button class="btn-ghost" @click="searchQuery = ''">
          Clear search
        </button>
      </div>

      <!-- Maps grid -->
      <div v-else class="maps-grid">
        <div
          v-for="map in filteredMaps"
          :key="map.id"
          :class="['map-card', selectMode && selectedIds.has(map.id) && 'selected']"
          @click="selectMode ? toggleSelect(map.id, $event) : openMap(map.id)"
        >
          <!-- Checkbox -->
          <button
            v-if="selectMode"
            class="card-checkbox"
            @click="toggleSelect(map.id, $event)"
          >
            <span :class="selectedIds.has(map.id) ? 'i-lucide-check-square' : 'i-lucide-square'" />
          </button>

          <!-- Preview -->
          <div class="card-preview">
            <img v-if="map.preview" :src="map.preview" :alt="map.title" class="preview-img">
            <div v-else class="preview-placeholder">
              <span class="i-lucide-map" />
            </div>
          </div>

          <!-- Info -->
          <div class="card-info">
            <div class="card-top">
              <span class="card-title">{{ map.title }}</span>
              <button
                v-if="!selectMode"
                class="card-menu"
                @click="deleteMap(map.id, $event)"
              >
                <span class="i-lucide-ellipsis" />
              </button>
            </div>
            <div class="card-meta">
              <span>{{ map.nodes.length }} nodes</span>
              <span class="meta-dot">&middot;</span>
              <span>Edited {{ formatDate(map.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <component :is="ConfirmDialog" />
  </div>
</template>

<style scoped>
.maps-layout {
  display: flex;
  min-height: 100vh;
  background: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Main content */
.maps-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  overflow-y: auto;
  gap: 24px;
}

/* Header */
.maps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 24px;
  font-weight: 600;
  color: #FAFAFA;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 32px;
}

.header-count {
  font-size: 13px;
  color: #71717A;
  line-height: 18px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Search */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #09090B;
  border: 1px solid #27272A;
  border-radius: 6px;
  min-width: 180px;
}

.search-icon {
  font-size: 14px;
  color: #52525B;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: #FAFAFA;
  min-width: 0;
}

.search-input::placeholder {
  color: #52525B;
}

/* Buttons */
.btn-filter,
.btn-sort {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #111113;
  border: 1px solid #27272A;
  border-radius: 6px;
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-filter:hover,
.btn-sort:hover {
  border-color: #3F3F46;
  color: #FAFAFA;
}

.btn-filter.active {
  background: rgba(239, 68, 68, 0.06);
  border-color: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

/* Select bar */
.select-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #111113;
  border: 1px solid #27272A;
  border-radius: 6px;
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
}

.select-count {
  font-size: 13px;
  color: var(--nc-ink-muted);
}

.btn-delete {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #EF4444;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
}

/* Maps grid */
.maps-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.map-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 352px;
  border-radius: 8px;
  overflow: hidden;
  background: #111113;
  border: 1px solid #1A1A1E;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
}

.map-card:hover {
  border-color: #27272A;
}

.map-card.selected {
  border-color: #00D2BE;
}

/* Card checkbox */
.card-checkbox {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 9, 11, 0.8);
  border: 1px solid #27272A;
  border-radius: 6px;
  color: #52525B;
  cursor: pointer;
  font-size: 16px;
}

.map-card.selected .card-checkbox {
  color: #00D2BE;
  border-color: #00D2BE;
}

/* Card preview */
.card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  padding: 20px;
  background: #0D0D0F;
  flex-shrink: 0;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-placeholder {
  font-size: 32px;
  color: #27272A;
}

/* Card info */
.card-info {
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 8px;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  color: #FAFAFA;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-menu {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--nc-ink-faint);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.map-card:hover .card-menu {
  opacity: 1;
}

.card-menu:hover {
  color: #A1A1AA;
}

/* Touch devices: always show action buttons */
@media (hover: none) {
  .card-menu {
    opacity: 1;
    width: 44px;
    height: 44px;
    border-radius: 6px;
  }
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--nc-ink-muted);
  line-height: 16px;
}

.meta-dot {
  color: var(--nc-ink-faint);
}

/* Loading */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid #27272A;
  border-top-color: #00D2BE;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 2s;
  }
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  color: #27272A;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #FAFAFA;
  margin: 0 0 6px;
}

.empty-desc {
  font-size: 14px;
  color: #52525B;
  margin: 0 0 24px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: #00D2BE;
  color: #09090B;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid #27272A;
  border-radius: 6px;
  color: #A1A1AA;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Light theme */
:root.light .maps-layout {
  background: #FAFAF9;
}

:root.light .header-title {
  color: #111111;
}

:root.light .header-count {
  color: #777777;
}

:root.light .search-box {
  background: #F5F5F3;
  border-color: #E8E8E6;
}

:root.light .search-input {
  color: #111111;
}

:root.light .search-input::placeholder {
  color: #777777;
}

:root.light .btn-filter,
:root.light .btn-sort {
  background: #F5F5F3;
  border-color: #E8E8E6;
  color: #52525B;
}

:root.light .btn-filter:hover,
:root.light .btn-sort:hover {
  border-color: #D4D4D8;
  color: #111111;
}

:root.light .map-card {
  background: #F5F5F3;
  border-color: #E8E8E6;
}

:root.light .map-card:hover {
  border-color: #D4D4D8;
}

:root.light .card-preview {
  background: #F4F4F5;
}

:root.light .card-title {
  color: #111111;
}

:root.light .card-meta {
  color: #777777;
}

:root.light .card-menu {
  color: #D4D4D8;
}

:root.light .card-menu:hover {
  color: #52525B;
}

:root.light .preview-placeholder {
  color: #D4D4D8;
}

:root.light .empty-title {
  color: #111111;
}

:root.light .empty-desc {
  color: #777777;
}

:root.light .btn-primary {
  background: #00D2BE;
  color: #FFFFFF;
}

:root.light .btn-ghost {
  border-color: #E8E8E6;
  color: #52525B;
}

/* Laptop breakpoint */
@media (max-width: 1366px) {
  .map-card {
    width: calc((100% - 32px) / 3);
    min-width: 260px;
  }
}

@media (max-width: 1100px) {
  .map-card {
    width: calc((100% - 16px) / 2);
    min-width: 240px;
  }
}

@media (max-width: 768px) {
  .maps-layout {
    flex-direction: column;
  }

  :deep(.sidebar) {
    display: none;
  }

  .maps-main {
    padding: 48px 0 100px;
    max-height: none;
  }

  /* Header: title left, sort right */
  .maps-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0;
    padding: 8px 24px 16px;
    margin-bottom: 0;
  }

  .header-left {
    flex-direction: column;
  }

  .header-title {
    font-size: 24px;
    letter-spacing: -0.02em;
  }

  .header-count {
    display: none;
  }

  /* Hide grid actions on mobile */
  .header-actions {
    display: none;
  }

  /* Search bar: full width, inside padding */
  .search-box {
    margin: 0 24px 20px;
    height: 44px;
    border-radius: 8px;
    background: #111114;
    border: 1px solid #1E1E22;
  }

  :root.light .search-box {
    background: #FFFFFF;
    border-color: #E8E8E6;
  }

  /* Map cards: list rows instead of grid */
  .maps-grid {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
  }

  .map-card {
    width: 100%;
    min-width: 0;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid #1E1E22;
    padding: 14px 24px;
    min-height: 48px;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }

  /* Always show card actions on mobile */
  .map-card .card-menu {
    opacity: 1;
    width: 44px;
    height: 44px;
    border-radius: 6px;
  }

  :root.light .map-card {
    border-bottom-color: #E8E8E6;
  }

  /* Hide card previews on mobile — list view only */
  .map-card .card-preview,
  .map-card .canvas-preview {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 10px;
  }

  .map-card .card-info {
    flex: 1;
    min-width: 0;
  }

  .map-card .card-title {
    font-size: 15px;
    font-weight: 600;
  }

  .map-card .card-meta {
    font-size: 12px;
  }
}
</style>
