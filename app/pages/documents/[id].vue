<script setup lang="ts">
import type { DocumentSummary } from '~/composables/useDocuments'
import { useDocuments } from '~/composables/useDocuments'
import { useConfirmDialog } from '~/composables/useConfirmDialog'
import NcSelect, { type NcSelectOption } from '~/components/ui/NcSelect.vue'

// ---------------------------------------------------------------------------
// Document detail page (Document RAG, plan §8) — the click target from
// DocumentCard. Server-authoritative: the document (with its bidirectional map
// links) is fetched online from GET /api/documents/{id}; this view is not
// served from the offline list cache. Visual language mirrors the documents
// library (index.vue) and the map detail chrome. No inline styles.
// ---------------------------------------------------------------------------

definePageMeta({
  layout: false,
  middleware: 'auth',
})

interface DocumentMapRef {
  id: string
  title: string | null
}

interface DocumentDetail extends DocumentSummary {
  generatedMap: DocumentMapRef | null
  attachedMaps: DocumentMapRef[]
}

interface DocumentDetailResponse {
  document: DocumentDetail
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { confirm, ConfirmDialog } = useConfirmDialog()
const { deleteDocuments } = useDocuments()

const documentId = computed(() => String(route.params.id ?? ''))

// ── State ──────────────────────────────────────────────────────────────────
const doc = ref<DocumentDetail | null>(null)
const loading = ref(true)
const notFound = ref(false)

const generating = ref(false)
const attaching = ref(false)
const deleting = ref(false)

// Attach picker
const mapOptions = ref<NcSelectOption[]>([])
const attachTargetId = ref('')
const mapsLoaded = ref(false)

// ── Derived ──────────────────────────────────────────────────────────────────
const displayTitle = computed(() => doc.value?.title || doc.value?.filename || '—')
const statusKey = computed(() => (doc.value?.status ?? '').toLowerCase())
const isReady = computed(() => doc.value?.status === 'READY')

const statusLabel = computed(() => {
  switch (doc.value?.status) {
    case 'PENDING': return t('documents.status.pending')
    case 'QUEUED': return t('documents.status.queued')
    case 'PROCESSING': return t('documents.status.processing')
    case 'READY': return t('documents.status.ready')
    case 'FAILED': return t('documents.status.failed')
    default: return doc.value?.status ?? ''
  }
})

const sourceLabel = computed(() => {
  switch (doc.value?.source) {
    case 'UPLOAD': return t('documents.source.upload')
    case 'URL': return t('documents.source.url')
    case 'PASTE': return t('documents.source.paste')
    default: return doc.value?.source ?? '—'
  }
})

const typeIcon = computed(() => {
  const mime = doc.value?.mimeType || ''
  if (mime === 'application/pdf') return 'i-lucide-file-text'
  if (mime.startsWith('image/')) return 'i-lucide-file-image'
  if (mime.includes('markdown') || mime === 'text/plain') return 'i-lucide-file-type'
  if (mime.includes('word') || mime.includes('officedocument')) return 'i-lucide-file-text'
  return 'i-lucide-file'
})

const pagesLabel = computed(() => {
  const n = doc.value?.pageCount
  if (n == null) return null
  return n === 1 ? t('documents.meta.pages_one', { n }) : t('documents.meta.pages_other', { n })
})

const chunksLabel = computed(() => {
  const n = doc.value?.chunkCount ?? 0
  return n === 1 ? t('documents.meta.chunks_one', { n }) : t('documents.meta.chunks_other', { n })
})

const generatedMap = computed(() => doc.value?.generatedMap ?? null)
const attachedMaps = computed(() => doc.value?.attachedMaps ?? [])

const canAttach = computed(() => isReady.value && mapOptions.value.length > 0 && !!attachTargetId.value)

function mapTitle(map: DocumentMapRef): string {
  return map.title || t('documents.detail.links.untitled_map')
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

function formatDate(value: string | number | undefined): string {
  if (value == null) return ''
  const ts = typeof value === 'number' ? value : Date.parse(value)
  if (Number.isNaN(ts)) return ''
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  notFound.value = false
  try {
    const res = await $fetch<DocumentDetailResponse>(`/api/documents/${documentId.value}`)
    doc.value = res.document
  } catch {
    notFound.value = true
    doc.value = null
  } finally {
    loading.value = false
  }
}

async function loadMaps() {
  if (mapsLoaded.value) return
  try {
    const rows = await $fetch<DocumentMapRef[]>('/api/maps/options')
    mapOptions.value = rows.map(m => ({ value: m.id, label: mapTitle(m) }))
  } catch {
    mapOptions.value = []
  } finally {
    mapsLoaded.value = true
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────
function goBack() {
  router.push('/documents')
}

function openMap(mapId: string) {
  router.push(`/map/${mapId}`)
}

async function generate() {
  if (!isReady.value || generating.value) return
  generating.value = true
  try {
    const res = await $fetch<{ mapId?: string; id?: string }>(
      `/api/documents/${documentId.value}/generate-map`,
      { method: 'POST', body: {} },
    )
    const newMapId = res?.mapId ?? res?.id
    if (!newMapId) {
      toast.error(t('documents.detail.toast.generate_failed'))
      return
    }
    await navigateTo(`/map/${newMapId}`)
  } catch {
    toast.error(t('documents.detail.toast.generate_failed'))
  } finally {
    generating.value = false
  }
}

async function attach() {
  if (!canAttach.value || attaching.value) return
  const mapId = attachTargetId.value
  attaching.value = true
  try {
    await $fetch(`/api/documents/${documentId.value}/attach`, {
      method: 'POST',
      body: { mapId },
    })
    toast.success(t('documents.detail.toast.attach_success'))
    attachTargetId.value = ''
    await load()
  } catch {
    toast.error(t('documents.detail.toast.attach_failed'))
  } finally {
    attaching.value = false
  }
}

async function detach(mapId: string) {
  try {
    await $fetch(`/api/documents/${documentId.value}/detach`, {
      method: 'DELETE',
      query: { mapId },
    })
    toast.success(t('documents.detail.toast.detach_success'))
    await load()
  } catch {
    toast.error(t('documents.detail.toast.detach_failed'))
  }
}

async function remove() {
  if (deleting.value) return
  const confirmed = await confirm({
    title: t('documents.delete_single_confirm.title'),
    description: t('documents.delete_single_confirm.description'),
    confirmText: t('common.buttons.delete'),
    cancelText: t('common.buttons.cancel'),
    variant: 'danger',
    icon: 'i-lucide-trash-2',
  })
  if (!confirmed) return
  deleting.value = true
  try {
    await deleteDocuments([documentId.value])
    router.push('/documents')
  } catch {
    toast.error(t('documents.detail.toast.delete_failed'))
    deleting.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  await load()
  // Lazily warm the attach picker once the document resolves.
  if (doc.value) await loadMaps()
})
</script>

<template>
  <div class="doc-detail-layout">
    <AppSidebar active-nav="documents" />
    <MobileTabBar />

    <main class="doc-detail-main">
      <!-- Loading -->
      <div v-if="loading" class="state-block">
        <div class="spinner" />
        <p class="state-text">{{ $t('documents.detail.loading') }}</p>
      </div>

      <!-- Not found -->
      <div v-else-if="notFound || !doc" class="state-block">
        <span class="i-lucide-file-x state-icon" />
        <h2 class="state-title">{{ $t('documents.detail.not_found.title') }}</h2>
        <p class="state-text">{{ $t('documents.detail.not_found.desc') }}</p>
        <button class="btn-ghost" @click="goBack">
          <span class="i-lucide-arrow-left" />
          {{ $t('documents.detail.not_found.cta') }}
        </button>
      </div>

      <!-- Detail -->
      <template v-else>
        <button class="back-link" @click="goBack">
          <span class="i-lucide-arrow-left" />
          {{ $t('documents.detail.back') }}
        </button>

        <header class="doc-head">
          <span class="doc-icon" :data-status="statusKey">
            <span :class="['doc-icon-glyph', typeIcon]" />
          </span>
          <div class="doc-head-text">
            <span class="doc-eyebrow">{{ $t('documents.detail.meta.eyebrow') }}</span>
            <h1 class="doc-title">{{ displayTitle }}</h1>
            <span class="status-badge" :data-status="statusKey">
              <span class="status-dot" />
              {{ statusLabel }}
            </span>
          </div>
        </header>

        <div class="doc-grid">
          <!-- Left: metadata + links -->
          <div class="doc-col">
            <!-- Metadata -->
            <section class="panel">
              <dl class="meta-list">
                <div class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.type') }}</dt>
                  <dd class="meta-val">{{ doc.mimeType || '—' }}</dd>
                </div>
                <div class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.source') }}</dt>
                  <dd class="meta-val">{{ sourceLabel }}</dd>
                </div>
                <div class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.size') }}</dt>
                  <dd class="meta-val">{{ formatBytes(doc.byteSize) }}</dd>
                </div>
                <div v-if="pagesLabel" class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.pages') }}</dt>
                  <dd class="meta-val">{{ pagesLabel }}</dd>
                </div>
                <div class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.chunks') }}</dt>
                  <dd class="meta-val">{{ chunksLabel }}</dd>
                </div>
                <div class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.uploaded') }}</dt>
                  <dd class="meta-val">{{ formatDate(doc.createdAt) }}</dd>
                </div>
                <div class="meta-row">
                  <dt class="meta-key">{{ $t('documents.detail.meta.updated') }}</dt>
                  <dd class="meta-val">{{ formatDate(doc.updatedAt) }}</dd>
                </div>
              </dl>
            </section>

            <!-- Linked maps -->
            <section class="panel">
              <h2 class="panel-title">{{ $t('documents.detail.links.title') }}</h2>

              <!-- Generated -->
              <div class="link-group">
                <span class="link-label">{{ $t('documents.detail.links.generated_label') }}</span>
                <button
                  v-if="generatedMap"
                  class="link-item link-item--generated"
                  @click="openMap(generatedMap.id)"
                >
                  <span class="i-lucide-waypoints link-icon" />
                  <span class="link-text">{{ mapTitle(generatedMap) }}</span>
                  <span class="i-lucide-arrow-up-right link-go" />
                </button>
                <p v-else class="link-empty">{{ $t('documents.detail.links.generated_empty') }}</p>
              </div>

              <!-- Attached -->
              <div class="link-group">
                <span class="link-label">{{ $t('documents.detail.links.attached_label') }}</span>
                <template v-if="attachedMaps.length">
                  <div
                    v-for="map in attachedMaps"
                    :key="map.id"
                    class="link-item link-item--attached"
                  >
                    <span class="i-lucide-link link-icon" />
                    <button class="link-text link-text--btn" @click="openMap(map.id)">
                      {{ mapTitle(map) }}
                    </button>
                    <button class="link-detach" @click="detach(map.id)">
                      {{ $t('documents.detail.links.detach') }}
                    </button>
                  </div>
                </template>
                <p v-else class="link-empty">{{ $t('documents.detail.links.attached_empty') }}</p>
              </div>
            </section>
          </div>

          <!-- Right: actions -->
          <aside class="doc-col doc-col--side">
            <section class="panel">
              <h2 class="panel-title">{{ $t('documents.detail.actions.title') }}</h2>

              <!-- Generate -->
              <div class="action-block">
                <button
                  class="btn-primary btn-block"
                  :disabled="!isReady || generating"
                  @click="generate"
                >
                  <span v-if="generating" class="i-lucide-loader-circle spin-icon" />
                  <span v-else class="i-lucide-waypoints" />
                  {{ generating ? $t('documents.detail.actions.generating') : $t('documents.detail.actions.generate') }}
                </button>
                <p class="action-hint">
                  {{ isReady ? $t('documents.detail.actions.generate_hint') : $t('documents.detail.actions.generate_not_ready') }}
                </p>
              </div>

              <!-- Attach -->
              <div class="action-block">
                <span class="action-label">{{ $t('documents.detail.actions.attach') }}</span>
                <NcSelect
                  v-if="mapOptions.length"
                  class="attach-select"
                  :model-value="attachTargetId"
                  :options="mapOptions"
                  :disabled="!isReady || attaching"
                  :aria-label="$t('documents.detail.actions.attach')"
                  @update:model-value="(v) => attachTargetId = v"
                />
                <p v-if="!mapOptions.length && mapsLoaded" class="action-hint">
                  {{ $t('documents.detail.actions.attach_no_maps') }}
                </p>
                <button
                  v-if="mapOptions.length"
                  class="btn-secondary btn-block"
                  :disabled="!canAttach || attaching"
                  @click="attach"
                >
                  <span v-if="attaching" class="i-lucide-loader-circle spin-icon" />
                  <span v-else class="i-lucide-link" />
                  {{ attaching ? $t('documents.detail.actions.attaching') : $t('documents.detail.actions.attach') }}
                </button>
                <p v-if="mapOptions.length" class="action-hint">{{ $t('documents.detail.actions.attach_hint') }}</p>
              </div>

              <!-- Delete -->
              <div class="action-block action-block--danger">
                <button class="btn-danger btn-block" :disabled="deleting" @click="remove">
                  <span class="i-lucide-trash-2" />
                  {{ $t('documents.detail.actions.delete') }}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </template>
    </main>

    <component :is="ConfirmDialog" />
  </div>
</template>

<style scoped>
.doc-detail-layout {
  display: flex;
  min-height: 100vh;
  background: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
}

.doc-detail-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 40px;
  overflow-y: auto;
  gap: 24px;
  max-width: 1100px;
}

/* Back link */
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 6px 0;
  background: none;
  border: none;
  color: #71717A;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
  transition: color 0.15s;
}

.back-link:hover { color: #FAFAFA; }
:root.light .back-link { color: #777777; }
:root.light .back-link:hover { color: #111111; }

/* Head */
.doc-head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.doc-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #1A1A1E;
  color: #A1A1AA;
}

.doc-icon[data-status="ready"] { background: rgba(0, 210, 190, 0.1); color: #00D2BE; }
.doc-icon[data-status="failed"] { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
.doc-icon[data-status="processing"],
.doc-icon[data-status="queued"],
.doc-icon[data-status="pending"] { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }

.doc-icon-glyph { font-size: calc(26px * var(--nc-text-scale, 1)); }

.doc-head-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.doc-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: #52525B;
}
:root.light .doc-eyebrow { color: #8A8780; }

.doc-title {
  font-size: calc(26px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: #FAFAFA;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.15;
  word-break: break-word;
}
:root.light .doc-title { color: #111111; }

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-badge[data-status="ready"] { background: rgba(0, 210, 190, 0.1); color: #00D2BE; }
.status-badge[data-status="failed"] { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
.status-badge[data-status="processing"],
.status-badge[data-status="queued"],
.status-badge[data-status="pending"] { background: rgba(245, 158, 11, 0.12); color: #F59E0B; }

/* Grid */
.doc-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}

.doc-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* Panel */
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 10px;
  background: #111113;
  border: 1px solid #1A1A1E;
}
:root.light .panel { background: #FFFFFF; border-color: #E8E8E6; }

.panel-title {
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: #FAFAFA;
  margin: 0;
}
:root.light .panel-title { color: #111111; }

/* Metadata */
.meta-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 0;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid #1A1A1E;
}
.meta-row:last-child { border-bottom: none; }
:root.light .meta-row { border-bottom-color: #F0F0EE; }

.meta-key {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: #71717A;
  margin: 0;
}

.meta-val {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: #FAFAFA;
  margin: 0;
  text-align: right;
  word-break: break-word;
}
:root.light .meta-val { color: #111111; }

/* Linked maps */
.link-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.04em;
  color: #52525B;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: #1A1A1E;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
:root.light .link-item { background: #F5F5F3; }

.link-item--generated {
  background: rgba(0, 210, 190, 0.08);
  border-color: rgba(0, 210, 190, 0.22);
}
.link-item--generated:hover {
  background: rgba(0, 210, 190, 0.14);
  border-color: rgba(0, 210, 190, 0.4);
}

.link-item--attached {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.22);
  cursor: default;
}

.link-icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  flex-shrink: 0;
}
.link-item--generated .link-icon { color: #00D2BE; }
.link-item--attached .link-icon { color: #A78BFA; }

.link-text {
  flex: 1;
  min-width: 0;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: #FAFAFA;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:root.light .link-text { color: #111111; }

.link-text--btn {
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  padding: 0;
  font-family: 'Inter', system-ui, sans-serif;
}
.link-text--btn:hover { text-decoration: underline; }

.link-go {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: #00D2BE;
  flex-shrink: 0;
}

.link-detach {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.22);
  background: rgba(239, 68, 68, 0.08);
  color: #EF4444;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  font-family: 'Inter', system-ui, sans-serif;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.link-detach:hover {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.4);
}

.link-empty {
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: #52525B;
  margin: 0;
}
:root.light .link-empty { color: #8A8780; }

/* Actions */
.action-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-block--danger {
  padding-top: 16px;
  border-top: 1px solid #1A1A1E;
}
:root.light .action-block--danger { border-top-color: #F0F0EE; }

.action-label {
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: #A1A1AA;
}
:root.light .action-label { color: #52525B; }

.action-hint {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: #52525B;
  margin: 0;
  line-height: 16px;
}
:root.light .action-hint { color: #8A8780; }

.attach-select { width: 100%; }
.attach-select :deep(.nc-select) { display: flex; width: 100%; }

/* Buttons */
.btn-block {
  width: 100%;
  justify-content: center;
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
  transition: opacity 0.15s;
}
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
:root.light .btn-primary { background: #00D2BE; color: #FFFFFF; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: #1A1A1E;
  border: 1px solid #27272A;
  color: #FAFAFA;
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  transition: border-color 0.15s, opacity 0.15s;
}
.btn-secondary:hover:not(:disabled) { border-color: #3F3F46; }
.btn-secondary:disabled { opacity: 0.45; cursor: not-allowed; }
:root.light .btn-secondary { background: #F5F5F3; border-color: #E8E8E6; color: #111111; }

.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #EF4444;
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  transition: background 0.15s, border-color 0.15s;
}
.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.4);
}
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

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
:root.light .btn-ghost { border-color: #E8E8E6; color: #52525B; }

.spin-icon {
  animation: spin 0.8s linear infinite;
}

/* State blocks (loading / not found) */
.state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 80px 24px;
  text-align: center;
}

.state-icon {
  font-size: calc(32px * var(--nc-text-scale, 1));
  color: #27272A;
}

.state-title {
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: #FAFAFA;
  margin: 0;
}
:root.light .state-title { color: #111111; }

.state-text {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: #52525B;
  margin: 0;
  max-width: 360px;
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
  .spinner, .spin-icon { animation-duration: 2s; }
}

/* Light theme layout */
:root.light .doc-detail-layout { background: #FAFAF9; }

/* Laptop */
@media (max-width: 960px) {
  .doc-grid { grid-template-columns: 1fr; }
  .doc-col--side { order: -1; }
}

/* Mobile */
@media (max-width: 768px) {
  .doc-detail-layout { flex-direction: column; }
  :deep(.sidebar) { display: none; }

  .doc-detail-main {
    padding: 12px 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
    gap: 16px;
  }

  .doc-title { font-size: calc(22px * var(--nc-text-scale, 1)); }

  :root.platform-ios .doc-detail-main {
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 116px);
  }
}
</style>
