<script setup lang="ts">
import vueFilePond from 'vue-filepond'
import 'filepond/dist/filepond.min.css'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'

// Register FilePond plugins
const FilePond = vueFilePond(FilePondPluginFileValidateType)

const { t } = useI18n()

// Emit event when file is added
const emit = defineEmits<{
  'file-added': [file: File]
}>()

// Track files for FilePond
const files = ref<File[]>([])

const labelIdle = computed(() =>
  `${t('ui.file_uploader.label_prefix')} <span class="filepond--label-action">${t('ui.file_uploader.browse_action')}</span>`
)

// Handle file addition
function handleAddFile(error: any, file: any) {
  if (error) {
    console.error('FilePond error:', error)
    return
  }

  if (file && file.file) {
    emit('file-added', file.file)
    // Clear the files after emitting
    nextTick(() => {
      files.value = []
    })
  }
}
</script>

<template>
  <ClientOnly>
    <FilePond
      ref="pond"
      class="filepond-uploader"
      :files="files"
      :allow-multiple="false"
      :instant-upload="false"
      :accepted-file-types="['text/markdown', 'text/x-opml', 'application/xml', 'text/plain', 'application/json', '.md', '.opml', '.json']"
      :label-idle="labelIdle"
      :credits="false"
      @addfile="handleAddFile"
    />
    <template #fallback>
      <div class="filepond-fallback">
        <p>{{ $t('common.loading.text') }}</p>
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
/* FilePond — token-driven dropzone grammar (REDESIGN.md §5):
   dashed 1px hairline + flat chip fill, accent border on dragover. */
.filepond-uploader {
  font-family: inherit;
}

.filepond-uploader :deep(.filepond--root) {
  font-family: inherit;
  margin-bottom: 0;
}

.filepond-uploader :deep(.filepond--panel-root) {
  background-color: var(--nc-chip-bg);
  border: 1px dashed var(--nc-border);
  border-radius: var(--nc-radius-md);
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease);
}

.filepond-uploader :deep(.filepond--drop-label) {
  color: var(--nc-text-secondary);
  font-size: 1rem;
  padding: 3rem 1rem;
}

.filepond-uploader :deep(.filepond--drop-label label) {
  cursor: pointer;
}

.filepond-uploader :deep(.filepond--label-action) {
  color: var(--nc-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .filepond-uploader :deep(.filepond--label-action:hover) {
    color: var(--nc-accent-light);
  }
}

/* Dragover state — accent border cue, faint accent fill (no glow). */
.filepond-uploader :deep(.filepond--root[data-hopper-hover="true"] .filepond--panel-root) {
  border-color: var(--nc-accent);
  background-color: rgba(var(--nc-accent-rgb), 0.08);
}

/* File item styling */
.filepond-uploader :deep(.filepond--item-panel) {
  background-color: var(--nc-surface-3);
  border-radius: var(--nc-radius-md);
}

.filepond-uploader :deep(.filepond--file-action-button) {
  background-color: rgba(var(--nc-bg-rgb), 0.55);
  color: var(--nc-text);
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .filepond-uploader :deep(.filepond--file-action-button:hover) {
    background-color: rgba(var(--nc-bg-rgb), 0.75);
  }
}

.filepond-uploader :deep(.filepond--file) {
  color: var(--nc-text);
}

.filepond-uploader :deep(.filepond--file-info-main) {
  font-size: 0.95rem;
}

.filepond-uploader :deep(.filepond--file-info-sub) {
  font-size: 0.8rem;
  color: var(--nc-text-muted);
}

/* Progress indicator — accent fill */
.filepond-uploader :deep(.filepond--progress-indicator) {
  background-color: var(--nc-accent);
}

/* Error state — coral, the destructive/validation accent (REDESIGN.md §1) */
.filepond-uploader :deep([data-filepond-item-state*="error"] .filepond--item-panel) {
  background-color: rgba(var(--nc-coral-rgb), 0.12);
}

/* Accepted file hint */
.filepond-uploader :deep(.filepond--credits) {
  display: none;
}

/* Fallback loading state — same dropzone grammar */
.filepond-fallback {
  padding: 3rem 1rem;
  text-align: center;
  background-color: var(--nc-chip-bg);
  border: 1px dashed var(--nc-border);
  border-radius: var(--nc-radius-md);
  color: var(--nc-text-muted);
}
</style>
