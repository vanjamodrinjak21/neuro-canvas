<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { resolveAvatarInitials } from '~/utils/userDisplay'
import { useMapStore } from '~/stores/mapStore'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import { useSyncEngine } from '~/composables/useSyncEngine'
import NcCardSchematic from '~/components/ui/NcCardSchematic.vue'

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
useBodyScrollLock()

// State
const allMaps = ref<DBMapDocument[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const sortBy = ref<'recent' | 'alphabetical' | 'nodes'>('recent')

// Selection state
const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

// Sort dropdown
const sortMenuOpen = ref(false)
const sortOptions = computed(() => [
  { value: 'recent' as const, label: t('maps.sort.recent') },
  { value: 'alphabetical' as const, label: t('maps.sort.alphabetical') },
  { value: 'nodes' as const, label: t('maps.sort.nodes') },
])
const currentSortLabel = computed(() => sortOptions.value.find(o => o.value === sortBy.value)?.label ?? '')

function toggleSortMenu() { sortMenuOpen.value = !sortMenuOpen.value }
function pickSort(v: 'recent' | 'alphabetical' | 'nodes') {
  sortBy.value = v
  sortMenuOpen.value = false
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      if (target && !target.closest('.sort-wrap')) sortMenuOpen.value = false
    })
  }
})

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

// Push a map delete to the server through the platform-appropriate AUTHENTICATED
// transport. On Capacitor the JWT is attached as an explicit Cookie via
// remoteFetch — a plain $fetch is unauthenticated, so the server delete silently
// fails (caught) and the map resyncs back on the next pull, making delete look
// broken on mobile. Tauri has the same requirement via desktopAuth.
async function pushDelete(mapId: string) {
  if (!syncEngine.isSyncEnabled.value) return
  const payload = { mapId, data: {}, title: '', checksum: '', action: 'delete', deviceId: '' }
  if (_isTauri && _desktopAuth?.isSignedIn.value) {
    await _desktopAuth.remoteFetch('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
  } else if (_isCapacitor && _mobileAuth?.isSignedIn.value) {
    await _mobileAuth.remoteFetch('/api/sync/push', { method: 'POST', data: payload }).catch(() => {})
  } else if (!_isNative) {
    await $fetch('/api/sync/push', { method: 'POST', body: payload }).catch(() => {})
  }
}

async function deleteSelected() {
  if (selectedIds.value.size === 0) return

  const count = selectedIds.value.size
  const confirmed = await confirm({
    title: count === 1 ? t('maps.delete_confirm.title_one') : t('maps.delete_confirm.title_other', { n: count }),
    description: count === 1 ? t('maps.delete_confirm.description_one') : t('maps.delete_confirm.description_other', { n: count }),
    confirmText: t('common.buttons.delete'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-trash-2'
  })

  if (!confirmed) return

  try {
    for (const id of selectedIds.value) {
      await pushDelete(id)
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

// Resolve the user the SAME way as dashboard/settings so the avatar (image +
// initials) is identical on every screen. On native the web session is empty;
// the real user lives on mobileAuth/desktopAuth.
const _authUser = computed(() => {
  if (_isTauri && _desktopAuth?.isSignedIn.value && _desktopAuth.user.value) return _desktopAuth.user.value
  if (_isCapacitor && _mobileAuth?.isSignedIn.value && _mobileAuth.user.value) return _mobileAuth.user.value
  return (_session as { data?: { value?: { user?: unknown } } })?.data?.value?.user
})
const userInitials = computed(() => resolveAvatarInitials(_authUser.value as Parameters<typeof resolveAvatarInitials>[0]))
const userImage = computed(() => (_authUser.value as { image?: string | null } | undefined)?.image || null)

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

async function deleteMap(mapId: string, event?: Event) {
  event?.stopPropagation()

  const confirmed = await confirm({
    title: t('maps.delete_single_confirm.title'),
    description: t('maps.delete_single_confirm.description'),
    confirmText: t('common.buttons.delete'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-trash-2'
  })

  if (!confirmed) return

  try {
    await pushDelete(mapId)
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

  if (diffDays === 0) return t('common.time.today')
  if (diffDays === 1) return t('common.time.yesterday')
  if (diffDays < 7) return t('common.time.days_ago', { n: diffDays })
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
          @delete-map="deleteMap"
          @change-sort="sortBy = sortBy === 'recent' ? 'alphabetical' : sortBy === 'alphabetical' ? 'nodes' : 'recent'"
        />
      </ClientOnly>

      <!-- Desktop top bar (legacy; hidden on mobile) -->
      <div v-if="!isMobile" class="m-top">
        <NuxtLink to="/dashboard" class="m-brand">
          <NcLogo :size="14" :container-size="24" :radius="6" />
          <span>NeuroCanvas</span>
        </NuxtLink>
        <NuxtLink to="/settings" class="m-avatar-link" aria-label="Settings">
          <div class="m-avatar">
            <img v-if="userImage" :src="userImage" :alt="userInitials" class="m-avatar-img">
            <template v-else>{{ userInitials }}</template>
          </div>
        </NuxtLink>
      </div>
      <h1 v-if="!isMobile" class="m-page-title">{{ $t('common.nav.maps') }}</h1>
      <p v-if="!isMobile" class="m-count">{{ filteredMaps.length === 1 ? $t('maps.count_label_one', { n: filteredMaps.length }) : $t('maps.count_label_other', { n: filteredMaps.length }) }}</p>

      <template v-if="!isMobile">
      <!-- Header -->
      <div class="maps-header">
        <div class="header-left">
          <span class="header-eyebrow">{{ $t('maps.header.eyebrow') }}</span>
          <h1 class="header-title">
            {{ $t('maps.header.title_a') }} <span class="header-title-italic">{{ $t('maps.header.title_b') }}</span>
          </h1>
          <span class="header-count">{{ filteredMaps.length === 1 ? $t('maps.count_label_one', { n: filteredMaps.length }) : $t('maps.count_label_other', { n: filteredMaps.length }) }}</span>
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
            {{ selectMode ? $t('common.buttons.cancel') : $t('maps.select.button') }}
          </button>
          <div class="sort-wrap">
            <button class="btn-sort" @click="toggleSortMenu">
              <span class="i-lucide-arrow-up-down" />
              {{ $t('maps.sort.label') }} <span class="btn-sort-current">· {{ currentSortLabel }}</span>
            </button>
            <div v-if="sortMenuOpen" class="sort-menu">
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                :class="['sort-item', { active: sortBy === opt.value }]"
                @click="pickSort(opt.value)"
              >
                <span class="i-lucide-check sort-item-check" />
                {{ opt.label }}
              </button>
            </div>
          </div>
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
          {{ allSelected ? $t('maps.select.deselect_all') : $t('maps.select.select_all') }}
        </button>
        <span class="select-count">{{ $t('maps.select.selected_count', { n: selectedCount }) }}</span>
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

          <!-- Preview — shared schematic device (NcCardSchematic, AER-76) -->
          <div class="card-preview">
            <img v-if="map.preview" :src="map.preview" :alt="map.title" class="preview-img">
            <NcCardSchematic v-else :count="map.nodes.length" />
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
              <span>{{ $t('maps.nodes_count', { n: map.nodes.length }) }}</span>
              <span class="meta-dot">&middot;</span>
              <span>{{ $t('maps.edited_prefix') }} {{ formatDate(map.updatedAt) }}</span>
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
/* Restyled per design/REDESIGN.md — flat planes, hairlines, tokens only. */
.maps-layout {
  display: flex;
  min-height: 100vh;
  background: var(--nc-bg);
  font-family: var(--nc-font-body);
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

/* Section eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.header-eyebrow {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
}

/* Page title — display 700, tight tracking, static size */
.header-title {
  font-family: var(--nc-font-display);
  font-size: calc(30px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

/* Serif italic accent — max once per page title (REDESIGN.md §4) */
.header-title-italic {
  font-family: var(--nc-font-serif);
  font-style: italic;
  font-weight: 400;
  color: var(--nc-accent);
}

/* Numeric readout — mono micro-label */
.header-count {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  line-height: 14px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-box--mobile {
  display: none;
}

/* Search — chip fill + hairline; focus = border-color only (REDESIGN.md §5) */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: var(--nc-radius-md);
  min-width: 180px;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.search-box:focus-within {
  border-color: var(--nc-accent);
}

.search-icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  min-width: 0;
}

.search-input::placeholder {
  color: var(--nc-text-dim);
}

/* Filter/sort controls — mono uppercase micro-labels on chip fill */
.btn-filter,
.btn-sort {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-secondary);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-filter:active,
.btn-sort:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-filter:hover,
  .btn-sort:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

/* Select-mode toggle active — accent + check icon, never color alone */
.btn-filter.active {
  background: rgba(var(--nc-accent-rgb), 0.08);
  border-color: rgba(var(--nc-accent-rgb), 0.4);
  color: var(--nc-accent);
}

.btn-sort-current { color: var(--nc-text-muted); font-weight: 400; margin-left: 4px; }

.sort-wrap { position: relative; }

/* Dropdown — flat surface-2 + hairline, scale(0.97)+opacity entrance (REDESIGN.md §5) */
.sort-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 10;
  min-width: 180px;
  padding: 4px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  box-shadow: var(--nc-shadow-md);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transform-origin: top right;
  animation: sort-menu-in var(--nc-duration-fast) var(--nc-ease);
}

@keyframes sort-menu-in {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.sort-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: var(--nc-radius-sm);
  text-align: left;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sort-item:hover { background: var(--nc-surface-3); color: var(--nc-text); }
}

.sort-item.active { color: var(--nc-accent); }
.sort-item-check { width: 14px; height: 14px; flex-shrink: 0; visibility: hidden; }
.sort-item.active .sort-item-check { visibility: visible; }

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
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-secondary);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-select-all:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-select-all:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

/* Selected count — mono numeric readout */
.select-count {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

/* Destructive — calm coral, never solid red (REDESIGN.md §1) */
.btn-delete {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.45);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: var(--nc-font-body);
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-delete:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-delete:hover {
    border-color: var(--nc-coral);
    background: rgba(var(--nc-coral-rgb), 0.08);
  }
}

/* Maps grid */
.maps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* Map card — flat surface-2 + hairline; hover = border shift ONLY */
.map-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  border-radius: var(--nc-radius-md);
  overflow: hidden;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.map-card:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .map-card:hover {
    border-color: var(--nc-border-active);
  }
}

/* Selected — accent border + check icon (non-color cue) */
.map-card.selected {
  border-color: var(--nc-accent);
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
  background: rgba(var(--nc-bg-rgb), 0.8);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-muted);
  cursor: pointer;
  font-size: calc(16px * var(--nc-text-scale, 1));
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease);
}

.map-card.selected .card-checkbox {
  color: var(--nc-accent);
  border-color: var(--nc-accent);
}

/* Card preview */
.card-preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  padding: 20px;
  background: var(--nc-surface);
  flex-shrink: 0;
  overflow: hidden;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.preview-placeholder {
  font-size: calc(32px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
}

/* Schematic preview device lives in NcCardSchematic.vue (shared, AER-76) */

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

/* Card title is USER CONTENT — body face, never forced uppercase mono */
.card-title {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text);
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Icon button — transparent, hover brightens on surface-3 */
.card-menu {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  /* Interactive rest ≥ the 0.62 tier (WCAG 1.4.11 — AER-76 icon visibility) */
  color: var(--nc-text-secondary);
  cursor: pointer;
  border-radius: 0.35rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .map-card:hover .card-menu {
    opacity: 1;
  }

  .card-menu:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

/* Touch devices: always show action buttons */
@media (hover: none) {
  .card-menu {
    opacity: 1;
    width: 44px;
    height: 44px;
    border-radius: var(--nc-radius-sm);
  }
}

/* Metadata (node counts, dates) — mono uppercase micro-labels */
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  line-height: 16px;
}

.meta-dot {
  color: var(--nc-text-dim);
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
  border: 2px solid var(--nc-border);
  border-top-color: var(--nc-accent);
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

  .sort-menu {
    animation: none;
  }
}

/* Empty state — survey frame: dashed hairline + coral '+' corner marks
   (REDESIGN.md §5, reserved for empty states) */
.empty-state {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 24px;
  text-align: center;
  border: 1px dashed var(--nc-border);
}

.empty-state::before,
.empty-state::after {
  content: '+';
  position: absolute;
  font-family: var(--nc-font-mono);
  font-size: calc(14px * var(--nc-text-scale, 1));
  line-height: 1;
  color: var(--nc-coral);
}

.empty-state::before {
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
}

.empty-state::after {
  bottom: 0;
  right: 0;
  transform: translate(50%, 50%);
}

.empty-icon {
  font-size: calc(32px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
  margin-bottom: 16px;
}

.empty-title {
  font-family: var(--nc-font-display);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0 0 6px;
}

.empty-desc {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 0 0 24px;
}

/* Primary — ink pill (REDESIGN.md §5) */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  background: var(--nc-text);
  color: var(--nc-bg);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  font-family: var(--nc-font-display);
  border: none;
  border-radius: 2.4rem;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-primary:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

/* Ghost — mono uppercase text link with underline-grow (REDESIGN.md §5) */
.btn-ghost {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: none;
  color: var(--nc-text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  font-family: var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-ghost::after {
  content: '';
  position: absolute;
  left: 0.9em;
  right: 0.9em;
  bottom: 0.3em;
  height: 1px;
  background: currentColor;
  transform: scaleX(0.35);
  transform-origin: left;
  transition: transform 0.45s var(--nc-ease);
}

.btn-ghost:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .btn-ghost:hover {
    color: var(--nc-accent);
  }

  .btn-ghost:hover::after {
    transform: scaleX(1);
  }
}

/* Focus-visible — 2px accent outline, 3px offset (REDESIGN.md §1) */
.btn-filter:focus-visible,
.btn-sort:focus-visible,
.btn-select-all:focus-visible,
.btn-delete:focus-visible,
.btn-primary:focus-visible,
.btn-ghost:focus-visible,
.sort-item:focus-visible,
.card-checkbox:focus-visible,
.card-menu:focus-visible,
.map-card:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.card-menu:focus-visible {
  opacity: 1;
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */

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
    display: inline-flex; align-items: center; gap: 8px;
    font-family: var(--nc-font-display);
    font-size: calc(17px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 22px;
    letter-spacing: -0.02em; color: var(--nc-text); margin: 0;
    text-decoration: none;
  }
  .m-avatar-link { display: flex; align-items: center; text-decoration: none; }
  .m-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: var(--nc-surface-3); border: 1px solid var(--nc-border);
    color: var(--nc-accent);
    font-family: var(--nc-font-body);
    font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 16px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .m-avatar-img { width: 100%; height: 100%; object-fit: cover; }

  /* Page title — display 700, tight tracking */
  .m-page-title {
    display: block;
    font-family: var(--nc-font-display);
    font-size: calc(28px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 1.05;
    letter-spacing: -0.02em; color: var(--nc-text);
    margin: 12px 0 16px;
  }

  /* Hide desktop header on mobile */
  .maps-header { display: none; }

  /* Search box — chip fill + hairline */
  .search-box--mobile {
    display: flex; align-items: center; gap: 10px;
    margin: 0 0 8px;
    padding: 10px 12px;
    border-radius: var(--nc-radius-md);
    background: var(--nc-chip-bg); border: 1px solid var(--nc-border-input);
  }
  .search-box--mobile .search-icon { color: var(--nc-text-muted); flex-shrink: 0; width: 16px; height: 16px; }
  .search-box--mobile .search-input {
    flex: 1; background: none; border: none; outline: none;
    font-family: var(--nc-font-body);
    font-size: calc(15px * var(--nc-text-scale, 1)); line-height: 18px;
    color: var(--nc-text); padding: 0;
  }
  .search-box--mobile .search-input::placeholder { color: var(--nc-text-dim); }

  /* Count label — mono micro-label */
  .m-count {
    display: block;
    font-family: var(--nc-font-mono);
    font-size: calc(11px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 16px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--nc-text-secondary);
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
    background: var(--nc-surface-2); border: 1px solid var(--nc-border); border-radius: var(--nc-radius-md);
    box-shadow: none;
  }
  .map-card .card-preview {
    flex-shrink: 0; width: 44px; height: 44px;
    background: var(--nc-surface-3); border-radius: var(--nc-radius-md);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .map-card .preview-img { width: 100%; height: 100%; object-fit: cover; }
  /* Schematic shrinks to a glyph inside the 44px row preview */
  .map-card .card-preview :deep(.nc-schematic) { padding: 0; }
  .map-card .card-preview :deep(.nc-schematic-rows) { transform: scale(0.3); }
  .map-card .card-preview :deep(.nc-schematic-count) { display: none; }
  .map-card .preview-placeholder {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%;
  }
  /* Accent-tinted glyph via mask so the color rides var(--nc-accent) */
  .map-card .preview-placeholder::before {
    content: '';
    width: 20px; height: 20px;
    background-color: var(--nc-accent);
    -webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='2'/><circle cx='18' cy='6' r='2'/><circle cx='6' cy='18' r='2'/><circle cx='18' cy='18' r='2'/><path d='M8 6h8M6 8v8M18 8v8M8 18h8'/></svg>");
    mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='2'/><circle cx='18' cy='6' r='2'/><circle cx='6' cy='18' r='2'/><circle cx='18' cy='18' r='2'/><path d='M8 6h8M6 8v8M18 8v8M8 18h8'/></svg>");
    -webkit-mask-size: contain; mask-size: contain;
    -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  }
  .map-card .preview-placeholder > span { display: none; }
  .map-card .card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .map-card .card-top { display: flex; align-items: center; gap: 8px; }
  .map-card .card-title {
    flex: 1; min-width: 0;
    font-family: var(--nc-font-body);
    font-size: calc(15px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 18px;
    color: var(--nc-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .map-card .card-meta {
    font-family: var(--nc-font-mono);
    font-size: calc(11px * var(--nc-text-scale, 1)); font-weight: 400; line-height: 16px;
    color: var(--nc-text-secondary);
    display: flex; gap: 4px;
  }
  .map-card .card-menu {
    flex-shrink: 0; width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; padding: 0;
    color: var(--nc-text-secondary); cursor: pointer; opacity: 1;
    border-radius: var(--nc-radius-sm);
  }

  /* iOS */
  :root.platform-ios .search-box--mobile,
  :root.platform-ios .map-card { border-radius: var(--nc-radius-md); }
  :root.platform-ios .maps-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }

  /* Android (MD3 pill search) */
  :root.platform-android .search-box--mobile { border-radius: 2.4rem; padding: 12px 16px; }
  :root.platform-android .map-card { border-radius: var(--nc-radius-md); }
  :root.platform-android .map-card .card-preview { border-radius: var(--nc-radius-md); }
  :root.platform-android .maps-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  }
}
</style>
