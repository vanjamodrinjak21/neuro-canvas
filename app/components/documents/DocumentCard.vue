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
// Visual language follows the AER-76 grammar: flat surface + hairline,
// border-shift hover. No inline styles — status colour is driven by a
// data-attribute resolved against scoped CSS.
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
        <span class="i-lucide-waypoints chip-icon" />
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
/* Card grammar (REDESIGN.md §5): flat surface-2 + THE hairline, radius 8px.
   Hover = border-color shift only — no lift, no shadow, no glow. */
.doc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 16px;
  border-radius: var(--nc-radius-md);
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .doc-card:hover {
    border-color: var(--nc-border-active);
  }
}

.doc-card:active {
  transform: scale(0.97);
}

.doc-card.selected {
  border-color: var(--nc-accent);
}

.doc-card:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
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
  background: rgba(var(--nc-bg-rgb), 0.8);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-muted);
  cursor: pointer;
  font-size: calc(16px * var(--nc-text-scale, 1));
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease);
}

.card-checkbox:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.doc-card.selected .card-checkbox {
  color: var(--nc-accent);
  border-color: var(--nc-accent);
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
  border-radius: var(--nc-radius-md);
  background: var(--nc-surface-3);
  color: var(--nc-text-muted);
}

/* Accent discipline (REDESIGN.md §1): cyan = ready, coral = failure,
   ink tier = in flight. Never a status rainbow. */
.doc-icon[data-status="ready"] {
  background: rgba(var(--nc-accent-rgb), 0.1);
  color: var(--nc-accent);
}

.doc-icon[data-status="failed"] {
  background: rgba(var(--nc-coral-rgb), 0.1);
  color: var(--nc-coral);
}

.doc-icon[data-status="processing"],
.doc-icon[data-status="queued"],
.doc-icon[data-status="pending"] {
  background: var(--nc-chip-bg);
  color: var(--nc-text-secondary);
}

.doc-icon-glyph {
  font-size: calc(18px * var(--nc-text-scale, 1));
}

.card-title {
  flex: 1;
  min-width: 0;
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
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
  border-radius: var(--nc-radius-sm);
  color: var(--nc-text-muted);
  cursor: pointer;
  opacity: 0.5;
  font-size: calc(15px * var(--nc-text-scale, 1));
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease);
}

.card-menu:focus-visible {
  opacity: 1;
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .doc-card:hover .card-menu {
    opacity: 1;
  }

  /* Destructive affordance — coral only (REDESIGN.md §1) */
  .card-menu:hover {
    color: var(--nc-coral);
    background: rgba(var(--nc-coral-rgb), 0.08);
  }
}

@media (hover: none) {
  .card-menu {
    opacity: 1;
    width: 40px;
    height: 40px;
  }
}

/* Meta — file metadata readouts are mono micro-labels (page grammar) */
.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.meta-text {
  white-space: nowrap;
}

/* Status badge — mono chip on chip fill + hairline, radius 0.4rem.
   Ready = accent, failed = coral, in-flight = ink tier. */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
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
  color: var(--nc-accent);
}

.status-badge[data-status="failed"] {
  color: var(--nc-coral);
}

/* Chips — mono on chip fill + hairline, radius 0.4rem (REDESIGN.md §5).
   Accent = the hot generated link; attached links stay ink tier
   (cyan is the only interactive color — §1 accent discipline). */
.card-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid var(--nc-border-subtle);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 0.4rem;
  border: 1px solid var(--nc-border);
  background: var(--nc-chip-bg);
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.chip:active {
  transform: scale(0.97);
}

.chip:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.chip-icon {
  font-size: calc(12px * var(--nc-text-scale, 1));
  flex-shrink: 0;
}

.chip-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip--generated {
  border-color: rgba(var(--nc-accent-rgb), 0.3);
  color: var(--nc-accent);
}

.chip--attached {
  color: var(--nc-text-secondary);
}

@media (hover: hover) and (pointer: fine) {
  .chip--generated:hover {
    background: rgba(var(--nc-accent-rgb), 0.08);
    border-color: rgba(var(--nc-accent-rgb), 0.5);
  }

  .chip--attached:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-text);
  }
}
</style>
