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
const { t } = useI18n()
const { isMobile } = usePlatform()

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
const _isCapacitor = typeof window !== 'undefined' && 'Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.()
const _isNative = _isTauri || _isCapacitor
const _session = _isNative ? { data: ref({ user: { id: 'native-user' } }) } : useAuth()
const _mobileAuth = _isCapacitor ? useMobileAuth() : null
const _desktopAuth = _isTauri ? useDesktopAuth() : null

const userInitials = computed(() => {
  const u = (_session as { data?: { value?: { user?: { name?: string | null; email?: string | null } } } })?.data?.value?.user
  const name = u?.name || u?.email || ''
  if (!name) return 'V'
  const parts = name.split(/[\s@]+/).filter(Boolean)
  if (parts.length === 0) return 'V'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase()
})
const userImage = computed(() => {
  const u = (_session as { data?: { value?: { user?: { image?: string | null } } } })?.data?.value?.user
  return u?.image || null
})

function mapResponse(m: any): DBMapDocument {
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
    checksum: m.checksum
  } as DBMapDocument
}

// Load all maps from server (PostgreSQL → Redis → client), fallback to IndexedDB
onMounted(async () => {
  try {
    const nativeSignedIn = (_isTauri && _desktopAuth?.isSignedIn.value)
      || (_isCapacitor && _mobileAuth?.isSignedIn.value)

    if (_isNative && nativeSignedIn) {
      // Native + signed in: fetch via native HTTP
      const fetcher = _isTauri
        ? _desktopAuth!.remoteFetch<{ maps: any[] }>('/api/sync/pull')
        : _mobileAuth!.remoteFetch<{ maps: any[] }>('/api/sync/pull')
      const response = await fetcher
      allMaps.value = response.maps.map(mapResponse)
    } else if (!_isNative && _session.data?.value?.user) {
      // Web: fetch from server
      const response: { maps: any[] } = await ($fetch as any)('/api/sync/pull')
      allMaps.value = response.maps.map(mapResponse)
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
      <!-- Mobile All Maps (Paper G46-0 / GMP-0) — only the list scrolls, dock fixed -->
      <ClientOnly>
        <MobileMapsDark
          v-if="isMobile"
          :user="{ name: userInitials, image: userImage }"
          :user-initials="userInitials"
          :maps="filteredMaps"
          :total-count="allMaps.length"
          :pinned-count="0"
          :search-query="searchQuery"
          :sort-label="sortBy"
          @update:search-query="searchQuery = $event"
          @open-map="openMap"
          @change-sort="sortBy = sortBy === 'recent' ? 'alphabetical' : sortBy === 'alphabetical' ? 'nodes' : 'recent'"
        />
      </ClientOnly>

      <!-- Desktop top bar (legacy; hidden on mobile) -->
      <div v-if="!isMobile" class="m-top">
        <h2 class="m-brand">NeuroCanvas</h2>
        <NuxtLink to="/settings" class="m-avatar-link" aria-label="Settings">
          <div class="m-avatar">
            <img v-if="userImage" :src="userImage" :alt="userInitials" class="m-avatar-img">
            <template v-else>{{ userInitials }}</template>
          </div>
        </NuxtLink>
      </div>
      <h1 v-if="!isMobile" class="m-page-title">{{ $t('common.nav.maps') }}</h1>
      <p v-if="!isMobile" class="m-count">{{ filteredMaps.length }} {{ filteredMaps.length === 1 ? 'map' : 'maps' }}</p>

      <template v-if="!isMobile">
      <!-- Header -->
      <div class="maps-header">
        <div class="header-left">
          <span class="header-eyebrow">02 — all maps</span>
          <h1 class="header-title">
            Everything <span class="header-title-italic">you've thought about.</span>
          </h1>
          <span class="header-count">{{ filteredMaps.length }} maps</span>
        </div>

        <div class="header-actions">
          <div class="search-box search-box--desktop">
            <span class="i-lucide-search search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              :placeholder="$t('common.search.placeholder')"
            >
          </div>
          <button
            :class="['btn-filter', selectMode && 'active']"
            @click="toggleSelectMode"
          >
            <span class="i-lucide-check-square" />
            {{ selectMode ? $t('common.buttons.cancel') : 'Select' }}
          </button>
          <button class="btn-sort">
            <span class="i-lucide-arrow-up-down" />
            Sort
          </button>
        </div>
      </div>

      <!-- Mobile search (outside header-actions so it stays visible) -->
      <div class="search-box search-box--mobile">
        <svg class="search-icon search-icon--svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="$t('common.search.placeholder')"
        >
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
          {{ $t('common.buttons.delete') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner" />
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredMaps.length === 0 && !searchQuery" class="empty-state">
        <span class="i-lucide-map empty-icon" />
        <h3 class="empty-title">{{ $t('common.errors.not_found') }}</h3>
        <p class="empty-desc">{{ $t('common.onboarding.step_create_desc') }}</p>
        <button class="btn-primary" @click="createNewMap">
          <span class="i-lucide-plus" />
          {{ $t('common.buttons.create') }}
        </button>
      </div>

      <!-- No results -->
      <div v-else-if="filteredMaps.length === 0 && searchQuery" class="empty-state">
        <span class="i-lucide-search-x empty-icon" />
        <h3 class="empty-title">{{ $t('common.errors.not_found') }}</h3>
        <p class="empty-desc">{{ $t('common.errors.generic') }}</p>
        <button class="btn-ghost" @click="searchQuery = ''">
          {{ $t('common.buttons.cancel') }}
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
      </template> <!-- /v-if="!isMobile" -->
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
  gap: 8px;
}

.header-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: #52525B;
}

.header-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 30px;
  font-weight: 600;
  color: #FAFAFA;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1;
}

.header-title-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-weight: 400;
  color: #A1A1AA;
}

.header-count {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  color: #52525B;
  line-height: 14px;
}

:root.light .header-eyebrow,
:root.light .header-count {
  color: #8A8780;
}

:root.light .header-title-italic {
  color: #5A5A5A;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box--mobile {
  display: none;
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

/* Mobile brand bar + title (shown only on mobile) */
.m-top, .m-page-title, .m-count { display: none; }

@media (max-width: 768px) {
  .maps-layout { flex-direction: column; }
  :deep(.sidebar) { display: none; }

  .maps-main {
    padding: 8px 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
    max-height: none;
  }

  /* App bar */
  .m-top {
    display: flex; align-items: center; justify-content: space-between;
    height: 44px;
  }
  .m-brand {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 17px; font-weight: 600; line-height: 22px;
    letter-spacing: -0.01em; color: #FAFAFA; margin: 0;
  }
  :root.light .m-brand { color: #18181B; }
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
    letter-spacing: -0.02em; color: #FAFAFA;
    margin: 12px 0 16px;
  }
  :root.light .m-page-title { color: #18181B; }

  /* Hide desktop header on mobile */
  .maps-header { display: none; }

  /* Search box */
  .search-box--mobile {
    display: flex; align-items: center; gap: 10px;
    margin: 0 0 8px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #111114; border: 1px solid #1E1E22;
  }
  :root.light .search-box--mobile { background: #FFFFFF; border-color: #E8E8E6; }
  .search-box--mobile .search-icon { color: #888890; flex-shrink: 0; width: 16px; height: 16px; }
  .search-box--mobile .search-input {
    flex: 1; background: none; border: none; outline: none;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px; line-height: 18px;
    color: #FAFAFA; padding: 0;
  }
  :root.light .search-box--mobile .search-input { color: #18181B; }
  .search-box--mobile .search-input::placeholder { color: #555558; }

  /* Count label */
  .m-count {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; font-weight: 500; line-height: 16px;
    color: #888890;
    padding: 8px 0 12px;
    margin: 0;
  }

  /* Map list rows */
  .maps-grid {
    display: flex; flex-direction: column; gap: 8px;
    padding: 0;
  }
  .map-card {
    display: flex; align-items: center; gap: 12px;
    width: 100%; min-width: 0;
    padding: 12px;
    background: #111114; border: 1px solid #1E1E22; border-radius: 10px;
    box-shadow: none;
  }
  :root.light .map-card { background: #FFFFFF; border-color: #E8E8E6; }
  .map-card .card-preview {
    flex-shrink: 0; width: 44px; height: 44px;
    background: #1A1A1E; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  :root.light .map-card .card-preview { background: #F5F5F4; }
  .map-card .preview-img { width: 100%; height: 100%; object-fit: cover; }
  .map-card .preview-placeholder {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%;
  }
  .map-card .preview-placeholder::before {
    content: '';
    width: 20px; height: 20px;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300D2BE' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='2'/><circle cx='18' cy='6' r='2'/><circle cx='6' cy='18' r='2'/><circle cx='18' cy='18' r='2'/><path d='M8 6h8M6 8v8M18 8v8M8 18h8'/></svg>");
    background-size: contain; background-repeat: no-repeat;
  }
  .map-card .preview-placeholder > span { display: none; }
  .map-card .card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .map-card .card-top { display: flex; align-items: center; gap: 8px; }
  .map-card .card-title {
    flex: 1; min-width: 0;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 15px; font-weight: 600; line-height: 18px;
    color: #FAFAFA;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  :root.light .map-card .card-title { color: #18181B; }
  .map-card .card-meta {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; font-weight: 400; line-height: 16px;
    color: #888890;
    display: flex; gap: 4px;
  }
  :root.light .map-card .card-meta { color: #6B6E74; }
  :root.light .m-count { color: #6B6E74; }
  :root.light .search-box--mobile .search-icon { color: #9CA0A6; }
  .map-card .card-menu {
    flex-shrink: 0; width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; padding: 0;
    color: #555558; cursor: pointer; opacity: 1;
    border-radius: 6px;
  }

  /* iOS */
  :root.platform-ios .search-box--mobile,
  :root.platform-ios .map-card { border-radius: 10px; }
  :root.platform-ios .maps-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }

  /* Android (MD3) */
  :root.platform-android .search-box--mobile { border-radius: 28px; padding: 12px 16px; }
  :root.platform-android .map-card { border-radius: 16px; }
  :root.platform-android .map-card .card-preview { border-radius: 12px; }
  :root.platform-android .maps-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  }
}
</style>
