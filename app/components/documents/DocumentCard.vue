<script setup lang="ts">
import type { DocumentSummary } from '~/composables/useDocuments'

// ---------------------------------------------------------------------------
// DocumentCard — knowledge-base document tile (Document RAG, plan §8)
// ---------------------------------------------------------------------------
//
// Renders a single shaped row from /api/documents. The list endpoint augments
// each DocumentSummary with the bidirectional map links:
//   - generatedMap: the single map produced FROM this document (or null)
//   - attachedMaps: every map this document was attached to as a RAG source
//
// Visual language mirrors the map / template cards (tokens, rounded corners,
// hover lift). No inline styles — status colour is driven by a data-attribute
// resolved against scoped CSS.
// ---------------------------------------------------------------------------

export interface DocumentMapRef {
  id: string
  title: string
}

export interface DocumentCardItem extends DocumentSummary {
  generatedMap?: DocumentMapRef | null
  attachedMaps?: DocumentMapRef[]
}

const props = defineProps<{
  document: DocumentCardItem
  selectMode?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  click: [document: DocumentCardItem]
  delete: [documentId: string]
  'open-map': [mapId: string]
}>()

const { t } = useI18n()

// Title falls back to filename, then to a neutral placeholder.
const displayTitle = computed(
  () => props.document.title || props.document.filename || '—',
)

// Status → badge label + colour token (resolved in scoped CSS via data-status).
const statusKey = computed(() => props.document.status.toLowerCase())
const statusLabel = computed(() => {
  switch (props.document.status) {
    case 'PENDING':
      return t('documents.status.pending')
    case 'QUEUED':
      return t('documents.status.queued')
    case 'PROCESSING':
      return t('documents.status.processing')
    case 'READY':
      return t('documents.status.ready')
    case 'FAILED':
      return t('documents.status.failed')
    default:
      return props.document.status
  }
})

// Type icon by mime family (lucide classes).
const typeIcon = computed(() => {
  const mime = props.document.mimeType || ''
  if (mime === 'application/pdf') return 'i-lucide-file-text'
  if (mime.startsWith('image/')) return 'i-lucide-file-image'
  if (mime.includes('markdown') || mime === 'text/plain') return 'i-lucide-file-type'
  if (mime.includes('word') || mime.includes('officedocument')) return 'i-lucide-file-text'
  return 'i-lucide-file'
})

const pagesLabel = computed(() => {
  const n = props.document.pageCount
  if (n == null) return null
  return n === 1 ? t('documents.meta.pages_one', { n }) : t('documents.meta.pages_other', { n })
})

const chunksLabel = computed(() => {
  const n = props.document.chunkCount ?? 0
  return n === 1 ? t('documents.meta.chunks_one', { n }) : t('documents.meta.chunks_other', { n })
})

const attachedMaps = computed(() => props.document.attachedMaps ?? [])
const generatedMap = computed(() => props.document.generatedMap ?? null)
const hasChips = computed(() => !!generatedMap.value || attachedMaps.value.length > 0)

function formatDate(value: string | number): string {
  const ts = typeof value === 'number' ? value : Date.parse(value)
  if (Number.isNaN(ts)) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return t('common.time.today')
  if (diffDays === 1) return t('common.time.yesterday')
  if (diffDays < 7) return t('common.time.days_ago', { n: diffDays })
  return date.toLocaleDateString()
}

function onCardClick() {
  emit('click', props.document)
}

function onDelete(event: Event) {
  event.stopPropagation()
  emit('delete', props.document.id)
}

function onChipClick(mapId: string, event: Event) {
  event.stopPropagation()
  emit('open-map', mapId)
}
</script>

<template>
  <div
    :class="['doc-card', { selected }]"
    role="button"
    tabindex="0"
    @click="onCardClick"
    @keydown.enter="onCardClick"
    @keydown.space.prevent="onCardClick"
  >
    <!-- Checkbox (select mode) -->
    <button
      v-if="selectMode"
      class="card-checkbox"
      :aria-pressed="selected"
      @click.stop="onCardClick"
    >
      <span :class="selected ? 'i-lucide-check-square' : 'i-lucide-square'" />
    </button>

    <!-- Head: type icon + title + delete -->
    <div class="card-head">
      <span class="doc-icon" :data-status="statusKey">
        <span :class="['doc-icon-glyph', typeIcon]" />
      </span>
      <span class="card-title" :title="displayTitle">{{ displayTitle }}</span>
      <button
        v-if="!selectMode"
        class="card-menu"
        :aria-label="t('common.buttons.delete')"
        @click="onDelete"
      >
        <span class="i-lucide-trash-2" />
      </button>
    </div>

    <!-- Meta: status badge · pages · chunks · date -->
    <div class="card-meta">
      <span class="status-badge" :data-status="statusKey">
        <span class="status-dot" />
        {{ statusLabel }}
      </span>
      <template v-if="pagesLabel">
        <span class="meta-dot">·</span>
        <span class="meta-text">{{ pagesLabel }}</span>
      </template>
      <span class="meta-dot">·</span>
      <span class="meta-text">{{ chunksLabel }}</span>
      <span class="meta-dot">·</span>
      <span class="meta-text">{{ formatDate(document.createdAt) }}</span>
    </div>

    <!-- Bidirectional link chips -->
    <div v-if="hasChips" class="card-chips">
      <button
        v-if="generatedMap"
        class="chip chip--generated"
        @click="onChipClick(generatedMap.id, $event)"
      >
        <span class="i-lucide-sparkles chip-icon" />
        <span class="chip-text">{{ t('documents.chips.generated_map', { title: generatedMap.title }) }}</span>
      </button>
      <button
        v-for="map in attachedMaps"
        :key="map.id"
        class="chip chip--attached"
        @click="onChipClick(map.id, $event)"
      >
        <span class="i-lucide-link chip-icon" />
        <span class="chip-text">{{ t('documents.chips.attached_map', { title: map.title }) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.doc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 16px;
  border-radius: 8px;
  background: #111113;
  border: 1px solid #1A1A1E;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.2s, transform 0.15s;
}

.doc-card:hover {
  border-color: #27272A;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
}

.doc-card:active {
  transform: translateY(0);
}

.doc-card.selected {
  border-color: #00D2BE;
}

.doc-card:focus-visible {
  outline: 2px solid #00D2BE;
  outline-offset: 2px;
}

/* Checkbox */
.card-checkbox {
  position: absolute;
  top: 10px;
  right: 10px;
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

.doc-card.selected .card-checkbox {
  color: #00D2BE;
  border-color: #00D2BE;
}

/* Head */
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.doc-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #1A1A1E;
  color: #A1A1AA;
}

.doc-icon[data-status="ready"] {
  background: rgba(0, 210, 190, 0.1);
  color: #00D2BE;
}

.doc-icon[data-status="failed"] {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
}

.doc-icon[data-status="processing"],
.doc-icon[data-status="queued"],
.doc-icon[data-status="pending"] {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
}

.doc-icon-glyph {
  font-size: 18px;
}

.card-title {
  flex: 1;
  min-width: 0;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #FAFAFA;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-menu {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: none;
  border: none;
  border-radius: 6px;
  color: var(--nc-ink-faint, #52525B);
  cursor: pointer;
  opacity: 0.5;
  font-size: 15px;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
}

.doc-card:hover .card-menu,
.card-menu:focus-visible {
  opacity: 1;
}

.card-menu:hover {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.08);
}

@media (hover: none) {
  .card-menu {
    opacity: 1;
    width: 40px;
    height: 40px;
  }
}

/* Meta */
.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  color: var(--nc-ink-muted, #71717A);
  line-height: 16px;
}

.meta-dot {
  color: var(--nc-ink-faint, #3F3F46);
}

.meta-text {
  white-space: nowrap;
}

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-badge[data-status="ready"] {
  background: rgba(0, 210, 190, 0.1);
  color: #00D2BE;
}

.status-badge[data-status="failed"] {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
}

.status-badge[data-status="processing"],
.status-badge[data-status="queued"],
.status-badge[data-status="pending"] {
  background: rgba(245, 158, 11, 0.12);
  color: #F59E0B;
}

/* Chips */
.card-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid #1A1A1E;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.chip-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip--generated {
  background: rgba(0, 210, 190, 0.08);
  border-color: rgba(0, 210, 190, 0.22);
  color: #00D2BE;
}

.chip--generated:hover {
  background: rgba(0, 210, 190, 0.14);
  border-color: rgba(0, 210, 190, 0.4);
}

.chip--attached {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.22);
  color: #A78BFA;
}

.chip--attached:hover {
  background: rgba(139, 92, 246, 0.14);
  border-color: rgba(139, 92, 246, 0.4);
}

/* Light theme */
:root.light .doc-card {
  background: #FFFFFF;
  border-color: #E8E8E6;
}

:root.light .doc-card:hover {
  border-color: #D4D4D2;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

:root.light .doc-icon {
  background: #F5F5F3;
}

:root.light .card-title {
  color: #111111;
}

:root.light .card-chips {
  border-top-color: #E8E8E6;
}

:root.light .chip--attached {
  color: #7C3AED;
}
</style>
