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
  background: var(--nc-bg);
  font-family: var(--nc-font-body);
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

/* Section eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.header-eyebrow {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--nc-text-secondary);
}

/* Page title — Cabinet Grotesk 700, tight tracking (REDESIGN.md §4) */
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

/* Search — input grammar: chip fill + hairline, focus = border only */
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

/* Toolbar controls — ghost grammar: transparent + hairline, mono uppercase */
.btn-filter,
.btn-sort {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-secondary);
  font-size: calc(12px * var(--nc-text-scale, 1));
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

.btn-filter:focus-visible,
.btn-sort:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .btn-filter:hover,
  .btn-sort:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

/* Active toggle = accent, never a 2nd interactive color (REDESIGN.md §1) */
.btn-filter.active {
  background: rgba(var(--nc-accent-rgb), 0.06);
  border-color: rgba(var(--nc-accent-rgb), 0.3);
  color: var(--nc-accent);
}

.btn-sort-current { color: var(--nc-text-muted); font-weight: 400; margin-left: 4px; }

.sort-wrap { position: relative; }

/* Dropdown grammar: flat surface-2 + hairline, scale(0.97)+opacity entrance
   from the trigger corner (REDESIGN.md §5/§6). */
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
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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

.sort-item:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.sort-item.active { color: var(--nc-accent); }
.sort-item-check { width: 14px; height: 14px; flex-shrink: 0; }
.sort-item-check.is-hidden { visibility: hidden; }

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
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-secondary);
  font-size: calc(12px * var(--nc-text-scale, 1));
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

.btn-select-all:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .btn-select-all:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}

/* Selection readout — mono micro-label */
.select-count {
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

/* Destructive — coral, never a hex red (REDESIGN.md §1) */
.btn-delete {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.3);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-delete:active {
  transform: scale(0.97);
}

.btn-delete:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .btn-delete:hover {
    background: rgba(var(--nc-coral-rgb), 0.14);
    border-color: rgba(var(--nc-coral-rgb), 0.5);
  }
}

/* Grid */
.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

/* Primary — ink pill (REDESIGN.md §5): hover flips to accent, lifts 1px */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--nc-text);
  color: var(--nc-bg);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 700;
  border: none;
  border-radius: 2.4rem;
  cursor: pointer;
  font-family: var(--nc-font-display);
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-primary:active {
  transform: scale(0.97);
}

.btn-primary:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .btn-primary:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

.btn-primary--header {
  padding: 8px 16px;
  font-size: calc(13px * var(--nc-text-scale, 1));
}

/* Ghost — mono uppercase text control, hover to accent (REDESIGN.md §5) */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-secondary);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: var(--nc-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.btn-ghost:active {
  transform: scale(0.97);
}

.btn-ghost:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .btn-ghost:hover {
    color: var(--nc-accent);
    border-color: var(--nc-border-active);
  }
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
  border: 2px solid var(--nc-border);
  border-top-color: var(--nc-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  margin: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation-duration: 2s; }
  .sort-menu { animation: none; }
}

/* Empty — plain dashed hairline frame (REDESIGN.md §5 empty states) */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 24px;
  text-align: center;
  border: 1px dashed var(--nc-border);
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
  color: var(--nc-text-muted);
  margin: 0 0 24px;
  max-width: 360px;
}

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
    font-family: var(--nc-font-display);
    font-size: calc(28px * var(--nc-text-scale, 1)); font-weight: 700; line-height: 1.05;
    letter-spacing: -0.02em; color: var(--nc-text);
    margin: 12px 0 0;
  }

  .m-count {
    display: block;
    font-family: var(--nc-font-mono);
    font-size: calc(12px * var(--nc-text-scale, 1)); font-weight: 500; line-height: 16px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--nc-text-secondary);
    margin: 0 0 4px;
  }

  .mobile-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .search-box--mobile {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    border-radius: var(--nc-radius-md);
    background: var(--nc-chip-bg); border: 1px solid var(--nc-border);
    min-width: 0;
  }
  .search-box--mobile .search-input { font-size: calc(15px * var(--nc-text-scale, 1)); line-height: 18px; }

  .btn-primary--mobile {
    width: 100%;
    justify-content: center;
    padding: 12px 20px;
  }

  .docs-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :root.platform-android .search-box--mobile { border-radius: 2.4rem; padding: 12px 16px; }
  :root.platform-android .docs-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  }
  :root.platform-ios .docs-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }
}
</style>
