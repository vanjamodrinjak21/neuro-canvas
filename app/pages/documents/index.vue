<script setup lang="ts">
import { useDocuments } from '~/composables/useDocuments'
import type { DocumentCardItem } from '~/components/documents/DocumentCard.vue'
import { useConfirmDialog } from '~/composables/useConfirmDialog'

definePageMeta({
  layout: false,
  middleware: 'auth',
})

const router = useRouter()
const { t } = useI18n()
const { isMobile } = usePlatform()
const { confirm, ConfirmDialog } = useConfirmDialog()
const { documents, loading, getDocuments, deleteDocuments } = useDocuments()

// ── State ──────────────────────────────────────────────────────────────────
const searchQuery = ref('')
const sortBy = ref<'recent' | 'alphabetical' | 'status'>('recent')
const isInitialLoad = ref(true)

// Upload modal
const uploadOpen = ref(false)

// Selection
const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())

// Sort dropdown
const sortMenuOpen = ref(false)
const sortOptions = computed(() => [
  { value: 'recent' as const, label: t('documents.sort.recent') },
  { value: 'alphabetical' as const, label: t('documents.sort.alphabetical') },
  { value: 'status' as const, label: t('documents.sort.status') },
])
const currentSortLabel = computed(
  () => sortOptions.value.find(o => o.value === sortBy.value)?.label ?? '',
)

function toggleSortMenu() { sortMenuOpen.value = !sortMenuOpen.value }
function pickSort(v: 'recent' | 'alphabetical' | 'status') {
  sortBy.value = v
  sortMenuOpen.value = false
}

// READY before any other state so finished docs surface first in "By status".
const STATUS_RANK: Record<string, number> = {
  READY: 0,
  PROCESSING: 1,
  QUEUED: 2,
  PENDING: 3,
  FAILED: 4,
}

function docTitle(d: DocumentCardItem): string {
  return (d.title || d.filename || '').toLowerCase()
}

function docTime(value: string | number): number {
  return typeof value === 'number' ? value : Date.parse(value) || 0
}

// The list endpoint augments each summary with the bidirectional map links.
const allDocuments = computed(() => documents.value as unknown as DocumentCardItem[])

const filteredDocuments = computed(() => {
  let docs = [...allDocuments.value]

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    docs = docs.filter(d =>
      (d.title || '').toLowerCase().includes(q) ||
      (d.filename || '').toLowerCase().includes(q),
    )
  }

  switch (sortBy.value) {
    case 'recent':
      docs.sort((a, b) => docTime(b.createdAt) - docTime(a.createdAt))
      break
    case 'alphabetical':
      docs.sort((a, b) => docTitle(a).localeCompare(docTitle(b)))
      break
    case 'status':
      docs.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))
      break
  }

  return docs
})

const totalCount = computed(() => allDocuments.value.length)

// ── Selection ────────────────────────────────────────────────────────────────
const selectedCount = computed(() => selectedIds.value.size)
const allSelected = computed(
  () => filteredDocuments.value.length > 0 && selectedIds.value.size === filteredDocuments.value.length,
)

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedIds.value = new Set()
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredDocuments.value.map(d => d.id))
  }
}

// ── Actions ────────────────────────────────────────────────────────────────
function openDocument(doc: DocumentCardItem) {
  if (selectMode.value) {
    toggleSelect(doc.id)
    return
  }
  router.push(`/documents/${doc.id}`)
}

function openMap(mapId: string) {
  router.push(`/map/${mapId}`)
}

async function deleteOne(documentId: string) {
  const confirmed = await confirm({
    title: t('documents.delete_single_confirm.title'),
    description: t('documents.delete_single_confirm.description'),
    confirmText: t('common.buttons.delete'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-trash-2',
  })
  if (!confirmed) return
  try {
    await deleteDocuments([documentId])
  } catch (error) {
    console.error('Failed to delete document:', error)
  }
}

async function deleteSelected() {
  if (selectedIds.value.size === 0) return
  const count = selectedIds.value.size
  const confirmed = await confirm({
    title: count === 1
      ? t('documents.delete_confirm.title_one')
      : t('documents.delete_confirm.title_other', { n: count }),
    description: count === 1
      ? t('documents.delete_confirm.description_one')
      : t('documents.delete_confirm.description_other', { n: count }),
    confirmText: t('common.buttons.delete'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-trash-2',
  })
  if (!confirmed) return
  try {
    await deleteDocuments([...selectedIds.value])
    selectedIds.value = new Set()
    selectMode.value = false
  } catch (error) {
    console.error('Failed to delete documents:', error)
  }
}

function openUpload() {
  uploadOpen.value = true
}

async function onUploaded() {
  await getDocuments()
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await getDocuments()
  isInitialLoad.value = false

  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      if (target && !target.closest('.sort-wrap')) sortMenuOpen.value = false
    })
  }
})

const showLoading = computed(() => loading.value && isInitialLoad.value)
</script>

<template>
  <div class="docs-layout">
    <AppSidebar active-nav="documents" />
    <MobileTabBar />

    <main class="docs-main">
      <!-- Mobile header -->
      <h1 v-if="isMobile" class="m-page-title">{{ $t('common.nav.documents') }}</h1>
      <p v-if="isMobile" class="m-count">
        {{ totalCount === 1 ? $t('documents.count_label_one', { n: totalCount }) : $t('documents.count_label_other', { n: totalCount }) }}
      </p>

      <!-- Desktop header -->
      <div v-if="!isMobile" class="docs-header">
        <div class="header-left">
          <span class="header-eyebrow">{{ $t('documents.header.eyebrow') }}</span>
          <h1 class="header-title">
            {{ $t('documents.header.title_a') }} <span class="header-title-italic">{{ $t('documents.header.title_b') }}</span>
          </h1>
          <span class="header-count">
            {{ totalCount === 1 ? $t('documents.count_label_one', { n: totalCount }) : $t('documents.count_label_other', { n: totalCount }) }}
          </span>
        </div>

        <div class="header-actions">
          <div class="search-box search-box--desktop">
            <span class="i-lucide-search search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              :placeholder="$t('documents.search_placeholder')"
            >
          </div>
          <button :class="['btn-filter', selectMode && 'active']" @click="toggleSelectMode">
            <span class="i-lucide-check-square" />
            {{ selectMode ? $t('common.buttons.cancel') : $t('documents.select.button') }}
          </button>
          <div class="sort-wrap">
            <button class="btn-sort" @click="toggleSortMenu">
              <span class="i-lucide-arrow-up-down" />
              {{ $t('documents.sort.label') }} <span class="btn-sort-current">· {{ currentSortLabel }}</span>
            </button>
            <div v-if="sortMenuOpen" class="sort-menu">
              <button
                v-for="opt in sortOptions"
                :key="opt.value"
                :class="['sort-item', { active: sortBy === opt.value }]"
                @click="pickSort(opt.value)"
              >
                <span :class="['i-lucide-check sort-item-check', { 'is-hidden': sortBy !== opt.value }]" />
                {{ opt.label }}
              </button>
            </div>
          </div>
          <button class="btn-primary btn-primary--header" @click="openUpload">
            <span class="i-lucide-upload" />
            {{ $t('documents.actions.upload') }}
          </button>
        </div>
      </div>

      <!-- Mobile search + upload -->
      <div v-if="isMobile" class="mobile-controls">
        <div class="search-box search-box--mobile">
          <span class="i-lucide-search search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="$t('documents.search_placeholder')"
          >
        </div>
        <button class="btn-primary btn-primary--mobile" @click="openUpload">
          <span class="i-lucide-upload" />
          {{ $t('documents.actions.upload') }}
        </button>
      </div>

      <!-- Select toolbar -->
      <div v-if="selectMode" class="select-bar">
        <button class="btn-select-all" @click="toggleSelectAll">
          <span :class="allSelected ? 'i-lucide-check-square' : 'i-lucide-square'" />
          {{ allSelected ? $t('documents.select.deselect_all') : $t('documents.select.select_all') }}
        </button>
        <span class="select-count">{{ $t('documents.select.selected_count', { n: selectedCount }) }}</span>
        <button v-if="selectedCount > 0" class="btn-delete" @click="deleteSelected">
          <span class="i-lucide-trash-2" />
          {{ $t('common.buttons.delete') }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="showLoading" class="loading-state">
        <div class="spinner" />
        <p class="loading-text">{{ $t('documents.loading') }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredDocuments.length === 0 && !searchQuery" class="empty-state">
        <span class="i-lucide-file-text empty-icon" />
        <h3 class="empty-title">{{ $t('documents.empty.title') }}</h3>
        <p class="empty-desc">{{ $t('documents.empty.desc') }}</p>
        <button class="btn-primary" @click="openUpload">
          <span class="i-lucide-upload" />
          {{ $t('documents.empty.cta') }}
        </button>
      </div>

      <!-- No results -->
      <div v-else-if="filteredDocuments.length === 0 && searchQuery" class="empty-state">
        <span class="i-lucide-search-x empty-icon" />
        <h3 class="empty-title">{{ $t('documents.no_results.title') }}</h3>
        <p class="empty-desc">{{ $t('documents.no_results.desc') }}</p>
        <button class="btn-ghost" @click="searchQuery = ''">
          {{ $t('common.buttons.cancel') }}
        </button>
      </div>

      <!-- Grid -->
      <div v-else class="docs-grid">
        <DocumentsDocumentCard
          v-for="doc in filteredDocuments"
          :key="doc.id"
          :document="doc"
          :select-mode="selectMode"
          :selected="selectedIds.has(doc.id)"
          @click="openDocument"
          @delete="deleteOne"
          @open-map="openMap"
        />
      </div>
    </main>

    <CanvasDocumentUploadModal v-model:open="uploadOpen" @uploaded="onUploaded" />
    <component :is="ConfirmDialog" />
  </div>
</template>

<style scoped>
.docs-layout {
  display: flex;
  min-height: 100vh;
  background: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
}

.docs-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  overflow-y: auto;
  gap: 24px;
}

/* Header */
.docs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:root.light .sort-menu {
  background: #FFFFFF;
  border-color: #E8E8E6;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
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
  font-size: 13px;
  color: #A1A1AA;
  cursor: pointer;
}

.sort-item:hover { background: #1A1A1E; color: #FAFAFA; }
.sort-item.active { color: #00D2BE; }
.sort-item-check { width: 14px; height: 14px; flex-shrink: 0; }
.sort-item-check.is-hidden { visibility: hidden; }

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

/* Grid */
.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* Primary / ghost */
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

.btn-primary--header {
  padding: 8px 16px;
  font-size: 13px;
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

/* Loading */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
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

.loading-text {
  font-size: 13px;
  color: #52525B;
  margin: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation-duration: 2s; }
}

/* Empty */
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
  max-width: 360px;
}

/* Light theme */
:root.light .docs-layout { background: #FAFAF9; }
:root.light .header-title { color: #111111; }
:root.light .header-count { color: #777777; }
:root.light .search-box { background: #F5F5F3; border-color: #E8E8E6; }
:root.light .search-input { color: #111111; }
:root.light .search-input::placeholder { color: #777777; }
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
:root.light .empty-title { color: #111111; }
:root.light .empty-desc { color: #777777; }
:root.light .btn-primary { background: #00D2BE; color: #FFFFFF; }
:root.light .btn-ghost { border-color: #E8E8E6; color: #52525B; }

/* Mobile header chrome (hidden on desktop) */
.m-page-title, .m-count { display: none; }

/* Laptop */
@media (max-width: 1100px) {
  .docs-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

/* Mobile */
.mobile-controls { display: none; }

@media (max-width: 768px) {
  .docs-layout { flex-direction: column; }
  :deep(.sidebar) { display: none; }

  .docs-main {
    padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
    gap: 12px;
  }

  .docs-header { display: none; }

  .m-page-title {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 28px; font-weight: 700; line-height: 34px;
    letter-spacing: -0.02em; color: #FAFAFA;
    margin: 12px 0 0;
  }
  :root.light .m-page-title { color: #18181B; }

  .m-count {
    display: block;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px; font-weight: 500; line-height: 16px;
    color: #888890;
    margin: 0 0 4px;
  }
  :root.light .m-count { color: #6B6E74; }

  .mobile-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .search-box--mobile {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #111114; border: 1px solid #1E1E22;
    min-width: 0;
  }
  :root.light .search-box--mobile { background: #FFFFFF; border-color: #E8E8E6; }
  .search-box--mobile .search-input { font-size: 15px; line-height: 18px; }

  .btn-primary--mobile {
    width: 100%;
    justify-content: center;
    padding: 12px 20px;
    border-radius: 10px;
  }

  .docs-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :root.platform-android .search-box--mobile { border-radius: 28px; padding: 12px 16px; }
  :root.platform-android .btn-primary--mobile { border-radius: 16px; }
  :root.platform-android .docs-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  }
  :root.platform-ios .docs-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }
}
</style>
