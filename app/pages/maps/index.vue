<script setup lang="ts">
import { useDatabase, type DBMapDocument } from '~/composables/useDatabase'
import { resolveAvatarInitials, formatRelativeDay } from '~/utils/userDisplay'
import { useMapStore } from '~/stores/mapStore'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import { useSyncEngine } from '~/composables/useSyncEngine'
import { mapServerToDoc } from '~/utils/mapServer'

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
      allMaps.value = response.maps.map(mapServerToDoc)
    } else if (!_isNative && _session.data?.value?.user) {
      // Web: fetch from server
      const response: { maps: any[] } = await ($fetch as any)('/api/sync/pull')
      allMaps.value = response.maps.map(mapServerToDoc)
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
  return formatRelativeDay(timestamp, t)
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
                <span class="i-lucide-check sort-item-check" :style="{ visibility: sortBy === opt.value ? 'visible' : 'hidden' }" />
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

          <!-- Preview -->
          <div class="card-preview">
            <img v-if="map.preview" :src="map.preview" :alt="map.title" class="preview-img">
            <div v-else class="preview-mock" aria-hidden="true">
              <div class="mock-row">
                <span class="mock-blob teal" style="width:48px" />
                <span class="mock-blob gray" style="width:56px" />
              </div>
              <div class="mock-row mock-row--mid">
                <span class="mock-blob gray dim" style="width:40px" />
                <span class="mock-blob teal solid" style="width:52px;height:22px" />
                <span class="mock-blob gray dim" style="width:44px" />
              </div>
              <div class="mock-row">
                <span class="mock-blob teal" style="width:44px" />
                <span class="mock-blob gray dim" style="width:50px" />
              </div>
              <span class="mock-count">{{ map.nodes.length }} nodes</span>
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
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: #52525B;
}

.header-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(30px * var(--nc-text-scale, 1));
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
  font-size: calc(11px * var(--nc-text-scale, 1));
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
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: #52525B;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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

.btn-sort-current { color: #52525B; font-weight: 400; margin-left: 4px; }
:root.light .btn-sort-current { color: #8A8780; }

.sort-wrap { position: relative; }

.sort-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 10;
  min-width: 180px;
  padding: 4px;
  background: #111113;
  border: 1px solid #27272A;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.32);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:root.light .sort-menu {
  background: #FFFFFF;
  border-color: #E8E8E6;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

.sort-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  text-align: left;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: #A1A1AA;
  cursor: pointer;
}

.sort-item:hover { background: #1A1A1E; color: #FAFAFA; }
.sort-item.active { color: #00D2BE; }
.sort-item-check { width: 14px; height: 14px; flex-shrink: 0; }

:root.light .sort-item { color: #52525B; }
:root.light .sort-item:hover { background: #F5F5F3; color: #111111; }
:root.light .sort-item.active { color: #00A89A; }

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
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
}

.select-count {
  font-size: calc(13px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
}

/* Maps grid */
.maps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.map-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #111113;
  border: 1px solid #1A1A1E;
  cursor: pointer;
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
  font-size: calc(16px * var(--nc-text-scale, 1));
}

.map-card.selected .card-checkbox {
  color: #00D2BE;
  border-color: #00D2BE;
}

/* Card preview */
.card-preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  padding: 20px;
  background: #0D0D0F;
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
  color: #27272A;
}

.preview-mock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  width: 100%;
  height: 100%;
  justify-content: center;
}

.mock-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mock-row--mid { gap: 12px; }

.mock-blob {
  height: 16px;
  border-radius: 4px;
}

.mock-blob.gray { background: rgba(63, 63, 70, 0.55); }
.mock-blob.gray.dim { background: rgba(63, 63, 70, 0.32); }
.mock-blob.teal { background: rgba(0, 210, 190, 0.32); }
.mock-blob.teal.solid { background: rgba(0, 210, 190, 0.85); }

.mock-count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: rgba(161, 161, 170, 0.7);
  letter-spacing: 0.02em;
}

:root.light .mock-blob.gray { background: rgba(115, 115, 115, 0.45); }
:root.light .mock-blob.gray.dim { background: rgba(115, 115, 115, 0.22); }
:root.light .mock-blob.teal { background: rgba(0, 168, 152, 0.32); }
:root.light .mock-blob.teal.solid { background: rgba(0, 168, 152, 0.85); }
:root.light .mock-count { color: rgba(82, 82, 91, 0.7); }

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
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-size: calc(12px * var(--nc-text-scale, 1));
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
  font-size: calc(32px * var(--nc-text-scale, 1));
  color: #27272A;
  margin-bottom: 16px;
}

.empty-title {
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: #FAFAFA;
  margin: 0 0 6px;
}

.empty-desc {
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-size: calc(14px * var(--nc-text-scale, 1));
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
  font-size: calc(13px * var(--nc-text-scale, 1));
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
    display: inline-flex; align-items: center; gap: 8px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(17px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 22px;
    letter-spacing: -0.01em; color: #FAFAFA; margin: 0;
    text-decoration: none;
  }
  :root.light .m-brand { color: #18181B; }
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
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
  }
  .m-avatar-img { width: 100%; height: 100%; object-fit: cover; }

  /* Page title */
  .m-page-title {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(28px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 34px;
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
    font-size: calc(15px * var(--nc-text-scale, 1)); line-height: 18px;
    color: #FAFAFA; padding: 0;
  }
  :root.light .search-box--mobile .search-input { color: #18181B; }
  .search-box--mobile .search-input::placeholder { color: #555558; }

  /* Count label */
  .m-count {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 16px;
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
    font-size: calc(15px * var(--nc-text-scale, 1)); font-weight: 600; line-height: 18px;
    color: #FAFAFA;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  :root.light .map-card .card-title { color: #18181B; }
  .map-card .card-meta {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: calc(13px * var(--nc-text-scale, 1)); font-weight: 400; line-height: 16px;
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
