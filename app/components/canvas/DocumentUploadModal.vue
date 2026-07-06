<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import NcDialog from '~/components/ui/NcDialog.vue'
import NcButton from '~/components/ui/NcButton.vue'
import NcSelect, { type NcSelectOption } from '~/components/ui/NcSelect.vue'
import { useDocumentUpload, type UploadIntent } from '~/composables/useDocumentUpload'
import { useSyncEngine } from '~/composables/useSyncEngine'

// ---------------------------------------------------------------------------
// DocumentUploadModal — Document RAG upload dialog (plan §8 UI)
// ---------------------------------------------------------------------------
//
// Built ON NcDialog (radix-backed: role=dialog, focus trap, esc). Drives the
// useDocumentUpload state machine through the three-phase server flow, then —
// once the document reaches READY — either generates a new map from it or
// attaches it to an existing map as a RAG source, per the chosen intent.
//
// Error codes from the composable are STABLE i18n keys under
// `documents.errors.*`; we map each to a modal-level `document_upload_modal.*`
// message and surface it via the app toast singleton.
// ---------------------------------------------------------------------------

const props = defineProps<{
  open: boolean
  mapId?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'uploaded': [documentId: string]
  'mapGenerated': [mapId: string]
}>()

const { t } = useI18n()
const toast = useToast()

// Upload → server ingest (presign / confirm / generate / attach) is fully
// online-only. Gate the primary CTA when offline; the cached documents list
// elsewhere stays readable offline.
const { isOnline } = useSyncEngine()
const offlineHint = computed(() => (isOnline.value ? undefined : t('common.offline.action_unavailable')))

const {
  state,
  progress,
  indeterminate,
  error,
  documentId,
  status,
  addFile,
  start,
  reset,
} = useDocumentUpload()

// ── Local UI state ──────────────────────────────────────────────────────────
type Intent = Extract<UploadIntent, 'generate_map' | 'attach_source'>

const selectedFile = ref<File | null>(null)
const intent = ref<Intent>('generate_map')
const targetMapId = ref<string>('')
const isDragOver = ref(false)
// True while a post-READY generate/attach request is in flight.
const finalizing = ref(false)
// Set once the attach flow completes, to swap the primary CTA to "done".
const attached = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Maps for the "attach" picker — fetched lazily on open.
const mapOptions = ref<NcSelectOption[]>([])
const mapsLoading = ref(false)

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

// Map the composable's stable error code → a modal-level i18n message.
const ERROR_KEY_MAP: Record<string, string> = {
  'documents.errors.unsupported_type': 'canvas.document_upload_modal.error_unsupported',
  'documents.errors.too_large': 'canvas.document_upload_modal.error_too_large',
  'documents.errors.presign_failed': 'canvas.document_upload_modal.error_upload_failed',
  'documents.errors.upload_failed': 'canvas.document_upload_modal.error_upload_failed',
  'documents.errors.confirm_failed': 'canvas.document_upload_modal.error_upload_failed',
  'documents.errors.processing_failed': 'canvas.document_upload_modal.error_parse_failed',
}

function messageForErrorCode(code: string): string {
  const key = ERROR_KEY_MAP[code]
  return key ? t(key) : t('canvas.document_upload_modal.error_upload_failed')
}

// Surface composable errors as toasts the moment a code appears.
watch(error, (code) => {
  if (code) toast.error(messageForErrorCode(code))
})

// ── Derived display state ─────────────────────────────────────────────────────
const hasFile = computed(() => selectedFile.value !== null)

const statusLine = computed<string | null>(() => {
  switch (state.value) {
    case 'uploading':
    case 'validating':
      return t('canvas.document_upload_modal.status_queued')
    case 'processing':
      return status.value === 'PROCESSING'
        ? t('canvas.document_upload_modal.status_processing')
        : t('canvas.document_upload_modal.status_queued')
    case 'ready':
      return t('canvas.document_upload_modal.status_ready')
    case 'failed':
      return t('canvas.document_upload_modal.status_failed')
    default:
      return null
  }
})

const isBusy = computed(
  () => state.value === 'uploading' || state.value === 'processing' || finalizing.value,
)
const isReady = computed(() => state.value === 'ready')
const showProgress = computed(
  () => state.value === 'uploading' || state.value === 'processing',
)
// The bar is indeterminate while processing (no server progress) AND during a
// native upload, where the native HTTP layer reports no byte-level progress.
const isIndeterminate = computed(
  () => state.value === 'processing' || (state.value === 'uploading' && indeterminate.value),
)
// Bound into the scoped <style> via v-bind() — keeps the bar width reactive
// without any inline style attribute.
const progressWidth = computed(() => `${progress.value}%`)

const intentOptions = computed(() => [
  {
    value: 'generate_map' as const,
    label: t('canvas.document_upload_modal.intent_generate'),
    icon: 'i-nc-ai-mark',
  },
  {
    value: 'attach_source' as const,
    label: t('canvas.document_upload_modal.intent_attach'),
    icon: 'i-lucide-paperclip',
  },
])

// Whether the primary action button is disabled.
const primaryDisabled = computed(() => {
  if (isBusy.value) return true
  // Offline: the whole flow (upload → ingest) needs the server. The "Done"
  // state after a successful attach only closes the dialog, so allow it.
  if (!isOnline.value && !attached.value) return true
  if (!hasFile.value) return true
  // When attaching without a prop-supplied map, a target must be picked.
  if (intent.value === 'attach_source' && !props.mapId && !targetMapId.value) return true
  return false
})

const primaryLabel = computed(() => {
  if (attached.value) return t('canvas.document_upload_modal.btn_done')
  if (isReady.value && intent.value === 'generate_map') {
    return t('canvas.document_upload_modal.btn_open_map')
  }
  return t('canvas.document_upload_modal.btn_upload')
})

// ── File selection ────────────────────────────────────────────────────────────
const ACCEPT = '.pdf,.docx,.md,.txt'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function handleFiles(files: FileList | null) {
  const f = files?.[0]
  if (!f) return
  const ok = addFile(f)
  if (ok) {
    selectedFile.value = f
  } else {
    selectedFile.value = null
    // addFile sets `error` (validation code); the watcher toasts it.
  }
}

function onInputChange(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
}

function browse() {
  fileInput.value?.click()
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (isBusy.value) return
  isDragOver.value = true
}

function onDragLeave() {
  isDragOver.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  if (isBusy.value) return
  handleFiles(e.dataTransfer?.files ?? null)
}

function clearFile() {
  reset()
  selectedFile.value = null
  attached.value = false
  if (fileInput.value) fileInput.value.value = ''
}

// ── Map picker (attach intent) ──────────────────────────────────────────────
async function loadMaps() {
  if (mapsLoading.value) return
  mapsLoading.value = true
  try {
    const rows = await $fetch<{ id: string; title: string }[]>('/api/maps/options')
    mapOptions.value = rows.map(r => ({
      value: r.id,
      label: r.title || t('canvas.untitled'),
    }))
  } catch {
    toast.error(t('canvas.document_upload_modal.error_upload_failed'))
  } finally {
    mapsLoading.value = false
  }
}

// Only fetch the picker list when needed: attaching, and no map was supplied.
watch(
  () => [intent.value, props.open] as const,
  ([currentIntent, open]) => {
    if (open && currentIntent === 'attach_source' && !props.mapId && mapOptions.value.length === 0) {
      void loadMaps()
    }
  },
)

// ── Primary action: upload → (generate | attach) ──────────────────────────────
async function onPrimary() {
  if (primaryDisabled.value) return

  // Attach already succeeded — the CTA now reads "Done" and just closes.
  if (attached.value) {
    close()
    return
  }

  // Kick off the upload flow (or, if already READY from a prior run, skip to
  // finalize using the existing documentId).
  if (!isReady.value) {
    await start({
      intent: intent.value,
      attachToMapId: intent.value === 'attach_source' ? resolvedMapId() : undefined,
    })
    // start() resolves on terminal state; a failure already toasted.
    if (state.value !== 'ready') return
  }

  const docId = documentId.value
  if (!docId) return
  emit('uploaded', docId)

  if (intent.value === 'generate_map') {
    await generateMap(docId)
  } else {
    await attachToMap(docId)
  }
}

function resolvedMapId(): string | undefined {
  return props.mapId ?? (targetMapId.value || undefined)
}

async function generateMap(docId: string) {
  finalizing.value = true
  try {
    const res = await $fetch<{ mapId?: string; id?: string }>(
      `/api/documents/${docId}/generate-map`,
      { method: 'POST', body: {} },
    )
    const newMapId = res?.mapId ?? res?.id
    if (!newMapId) {
      toast.error(t('canvas.document_upload_modal.error_parse_failed'))
      return
    }
    emit('mapGenerated', newMapId)
    close()
    await navigateTo(`/map/${newMapId}`)
  } catch {
    toast.error(t('canvas.document_upload_modal.error_parse_failed'))
  } finally {
    finalizing.value = false
  }
}

async function attachToMap(docId: string) {
  const mapId = resolvedMapId()
  if (!mapId) return
  finalizing.value = true
  try {
    await $fetch(`/api/documents/${docId}/attach`, {
      method: 'POST',
      body: { mapId },
    })
    attached.value = true
    toast.success(t('canvas.document_upload_modal.status_ready'))
  } catch {
    toast.error(t('canvas.document_upload_modal.error_upload_failed'))
  } finally {
    finalizing.value = false
  }
}

function close() {
  isOpen.value = false
}

// Reset everything when the dialog is dismissed so re-opening is clean.
watch(
  () => props.open,
  (open) => {
    if (!open) {
      clearFile()
      intent.value = 'generate_map'
      targetMapId.value = ''
    }
  },
)

onMounted(() => {
  // Pre-pick a sensible default intent: if opened from within a map, attaching
  // is the more likely action.
  if (props.mapId) intent.value = 'attach_source'
})
</script>

<template>
  <NcDialog
    :open="isOpen"
    size="md"
    @update:open="(v) => isOpen = v"
  >
    <template #header>
      <h2 class="dum-title">{{ t('canvas.document_upload_modal.title') }}</h2>
      <p class="dum-subtitle">{{ t('canvas.document_upload_modal.subtitle') }}</p>
    </template>

    <div class="dum-body">
      <!-- Dropzone -->
      <div
        v-if="!hasFile"
        class="dum-dropzone"
        :class="{ 'is-dragover': isDragOver }"
        role="button"
        tabindex="0"
        :aria-label="t('canvas.document_upload_modal.dropzone_prompt')"
        @click="browse"
        @keydown.enter.prevent="browse"
        @keydown.space.prevent="browse"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <span class="dum-dropzone-icon i-lucide-upload-cloud" aria-hidden="true" />
        <p class="dum-dropzone-prompt">
          {{ isDragOver
            ? t('canvas.document_upload_modal.dropzone_active')
            : t('canvas.document_upload_modal.dropzone_prompt') }}
        </p>
        <button
          type="button"
          class="dum-browse"
          :aria-label="t('canvas.document_upload_modal.browse')"
          @click.stop="browse"
        >
          {{ t('canvas.document_upload_modal.browse') }}
        </button>
        <p class="dum-dropzone-meta">{{ t('canvas.document_upload_modal.accepted') }}</p>
        <p class="dum-dropzone-meta">{{ t('canvas.document_upload_modal.size_limit') }}</p>
        <input
          ref="fileInput"
          type="file"
          class="dum-file-input"
          :accept="ACCEPT"
          tabindex="-1"
          aria-hidden="true"
          @change="onInputChange"
        >
      </div>

      <!-- Selected file row -->
      <div v-else class="dum-file-row">
        <span class="dum-file-icon i-lucide-file-text" aria-hidden="true" />
        <div class="dum-file-info">
          <span class="dum-file-name">{{ selectedFile?.name }}</span>
          <span class="dum-file-size">{{ formatSize(selectedFile?.size ?? 0) }}</span>
        </div>
        <button
          v-if="!isBusy"
          type="button"
          class="dum-file-clear"
          :aria-label="t('canvas.document_upload_modal.btn_cancel')"
          @click="clearFile"
        >
          <span class="i-lucide-x" aria-hidden="true" />
        </button>
      </div>

      <!-- Progress + status -->
      <div v-if="showProgress" class="dum-progress" aria-hidden="false">
        <div
          class="dum-progress-track"
          role="progressbar"
          :aria-valuenow="isIndeterminate ? undefined : progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="statusLine ?? ''"
        >
          <div
            class="dum-progress-fill"
            :class="{ 'is-indeterminate': isIndeterminate }"
          />
        </div>
      </div>
      <p
        v-if="statusLine"
        class="dum-status"
        :class="{ 'is-error': state === 'failed', 'is-ready': state === 'ready' }"
        role="status"
        aria-live="polite"
      >
        {{ statusLine }}
      </p>

      <!-- Intent selector -->
      <fieldset v-if="hasFile && !attached" class="dum-intent" :disabled="isBusy || isReady">
        <legend class="sr-only">{{ t('canvas.document_upload_modal.title') }}</legend>
        <button
          v-for="opt in intentOptions"
          :key="opt.value"
          type="button"
          class="dum-intent-btn"
          :class="{ active: intent === opt.value }"
          :aria-pressed="intent === opt.value"
          :disabled="isBusy || isReady"
          @click="intent = opt.value"
        >
          <span class="dum-intent-icon" :class="opt.icon" aria-hidden="true" />
          <span class="dum-intent-label">{{ opt.label }}</span>
        </button>
      </fieldset>

      <!-- Target map picker (attach, no prop mapId) -->
      <div v-if="hasFile && intent === 'attach_source' && !mapId && !attached" class="dum-field">
        <label class="dum-field-label">{{ t('canvas.document_upload_modal.target_map_label') }}</label>
        <NcSelect
          :model-value="targetMapId"
          :options="mapOptions"
          :disabled="isBusy || isReady || mapsLoading"
          :aria-label="t('canvas.document_upload_modal.target_map_label')"
          class="dum-map-select"
          @update:model-value="(v) => targetMapId = v"
        />
        <p v-if="mapOptions.length === 0 && !mapsLoading" class="dum-field-hint">
          {{ t('canvas.document_upload_modal.target_map_placeholder') }}
        </p>
      </div>
    </div>

    <template #footer>
      <NcButton variant="secondary" :disabled="isBusy" @click="close">
        {{ t('canvas.document_upload_modal.btn_cancel') }}
      </NcButton>
      <NcButton
        variant="primary"
        :loading="isBusy"
        :disabled="primaryDisabled"
        :title="offlineHint"
        @click="onPrimary"
      >
        {{ primaryLabel }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<style scoped>
.dum-title {
  font: 600 var(--nc-text-xl) / 1.2 var(--nc-font-display);
  color: var(--nc-ink);
  margin: 0;
}
.dum-subtitle {
  margin: 4px 0 0;
  font: 400 var(--nc-text-sm) / 1.4 var(--nc-font-body);
  color: var(--nc-ink-muted);
}

.dum-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Dropzone */
.dum-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 20px;
  border: 1.5px dashed var(--nc-border-active);
  border-radius: var(--nc-radius-lg);
  background: var(--nc-surface-3);
  text-align: center;
  cursor: pointer;
  transition:
    border-color var(--nc-duration-fast) var(--nc-ease),
    background var(--nc-duration-fast) var(--nc-ease);
}
.dum-dropzone:hover,
.dum-dropzone:focus-visible {
  outline: none;
  border-color: var(--nc-accent);
  background: var(--nc-accent-glow);
}
.dum-dropzone.is-dragover {
  border-color: var(--nc-accent);
  background: var(--nc-accent-glow-strong);
}
.dum-dropzone-icon {
  width: 32px;
  height: 32px;
  color: var(--nc-accent);
}
.dum-dropzone-prompt {
  margin: 0;
  font: 500 var(--nc-text-sm) / 1.4 var(--nc-font-body);
  color: var(--nc-ink);
}
.dum-browse {
  margin-top: 2px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--nc-border-active);
  border-radius: var(--nc-radius-md);
  color: var(--nc-accent);
  font: 500 var(--nc-text-sm) / 1 var(--nc-font-body);
  cursor: pointer;
  transition:
    border-color var(--nc-duration-fast) var(--nc-ease),
    background var(--nc-duration-fast) var(--nc-ease);
}
.dum-browse:hover {
  border-color: var(--nc-accent);
  background: var(--nc-accent-glow);
}
.dum-browse:focus-visible {
  outline: none;
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}
.dum-dropzone-meta {
  margin: 0;
  font: 400 var(--nc-text-xs) / 1.4 var(--nc-font-body);
  color: var(--nc-ink-muted);
}
.dum-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  border: 0;
}

/* Selected file row */
.dum-file-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-lg);
  background: var(--nc-surface-3);
}
.dum-file-icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  color: var(--nc-accent);
}
.dum-file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dum-file-name {
  font: 500 var(--nc-text-sm) / 1.3 var(--nc-font-body);
  color: var(--nc-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dum-file-size {
  font: 400 var(--nc-text-xs) / 1.2 var(--nc-font-body);
  color: var(--nc-ink-muted);
}
.dum-file-clear {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--nc-radius-md);
  background: transparent;
  color: var(--nc-ink-muted);
  cursor: pointer;
  transition:
    color var(--nc-duration-fast) var(--nc-ease),
    background var(--nc-duration-fast) var(--nc-ease);
}
.dum-file-clear:hover {
  color: var(--nc-ink);
  background: var(--nc-surface-4);
}
.dum-file-clear:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--nc-accent);
}

/* Progress */
.dum-progress {
  display: flex;
  flex-direction: column;
}
.dum-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--nc-surface-4);
  overflow: hidden;
}
.dum-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--nc-accent);
  width: v-bind(progressWidth);
  transition: width var(--nc-duration-normal) var(--nc-ease);
}
.dum-progress-fill.is-indeterminate {
  width: 40%;
  animation: dum-indeterminate 1.2s var(--nc-ease-in-out) infinite;
}
@keyframes dum-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@media (prefers-reduced-motion: reduce) {
  .dum-progress-fill.is-indeterminate {
    animation: none;
    width: 100%;
    opacity: 0.5;
  }
}

.dum-status {
  margin: 0;
  font: 400 var(--nc-text-xs) / 1.4 var(--nc-font-body);
  color: var(--nc-ink-muted);
}
.dum-status.is-ready { color: var(--nc-success); }
.dum-status.is-error { color: var(--nc-error); }

/* Intent selector */
.dum-intent {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0;
  margin: 0;
  border: none;
}
.dum-intent-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-lg);
  background: var(--nc-surface-3);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--nc-duration-fast) var(--nc-ease),
    background var(--nc-duration-fast) var(--nc-ease);
}
.dum-intent-btn:hover:not(:disabled) {
  border-color: var(--nc-border-active);
}
.dum-intent-btn.active {
  border-color: var(--nc-accent);
  background: var(--nc-accent-glow);
}
.dum-intent-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}
.dum-intent-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dum-intent-icon {
  width: 18px;
  height: 18px;
  color: var(--nc-accent);
}
.dum-intent-label {
  font: 500 var(--nc-text-sm) / 1.3 var(--nc-font-body);
  color: var(--nc-ink);
}

/* Target map field */
.dum-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dum-field-label {
  font: 600 var(--nc-text-xs) / 1 var(--nc-font-body);
  color: var(--nc-ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.dum-map-select {
  width: 100%;
}
.dum-field-hint {
  margin: 0;
  font: 400 var(--nc-text-xs) / 1.4 var(--nc-font-body);
  color: var(--nc-ink-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
</style>
