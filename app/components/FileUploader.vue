<script setup lang="ts">
import vueFilePond from 'vue-filepond'
import 'filepond/dist/filepond.min.css'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'

// Register FilePond plugins
const FilePond = vueFilePond(FilePondPluginFileValidateType)

// Emit event when file is added
const emit = defineEmits<{
  'file-added': [file: File]
}>()

// Track files for FilePond
const files = ref<File[]>([])

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
      :accepted-file-types="['text/markdown', 'text/x-opml', 'application/xml', 'text/plain', '.md', '.opml']"
      label-idle="Drag & drop your file or <span class='filepond--label-action'>Browse</span>"
      :credits="false"
      @addfile="handleAddFile"
    />
    <template #fallback>
      <div class="filepond-fallback">
        <p>Loading file uploader...</p>
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
/* FilePond Dark Theme Overrides */
.filepond-uploader {
  font-family: inherit;
}

.filepond-uploader :deep(.filepond--root) {
  font-family: inherit;
  margin-bottom: 0;
}

.filepond-uploader :deep(.filepond--panel-root) {
  background-color: var(--surface-2, #121216);
  border: 2px dashed var(--border, #252529);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.filepond-uploader :deep(.filepond--drop-label) {
  color: var(--text-secondary, #A1A1AA);
  font-size: 1rem;
  padding: 3rem 1rem;
}

.filepond-uploader :deep(.filepond--drop-label label) {
  cursor: pointer;
}

.filepond-uploader :deep(.filepond--label-action) {
  color: var(--accent, #00D2BE);
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.2s ease;
}

.filepond-uploader :deep(.filepond--label-action:hover) {
  color: var(--accent-light, #00FFE5);
}

/* Hover state */
.filepond-uploader :deep(.filepond--root[data-hopper-hover="true"] .filepond--panel-root) {
  border-color: var(--accent, #00D2BE);
  background-color: rgba(0, 210, 190, 0.05);
}

/* File item styling */
.filepond-uploader :deep(.filepond--item-panel) {
  background-color: var(--surface-3, #18181D);
  border-radius: 12px;
}

.filepond-uploader :deep(.filepond--file-action-button) {
  background-color: rgba(0, 0, 0, 0.5);
  color: var(--text, #FAFAFA);
  cursor: pointer;
}

.filepond-uploader :deep(.filepond--file-action-button:hover) {
  background-color: rgba(0, 0, 0, 0.7);
}

.filepond-uploader :deep(.filepond--file) {
  color: var(--text, #FAFAFA);
}

.filepond-uploader :deep(.filepond--file-info-main) {
  font-size: 0.95rem;
}

.filepond-uploader :deep(.filepond--file-info-sub) {
  font-size: 0.8rem;
  color: var(--text-muted, #71717A);
}

/* Progress indicator */
.filepond-uploader :deep(.filepond--progress-indicator) {
  background-color: var(--accent, #00D2BE);
}

/* Error state */
.filepond-uploader :deep([data-filepond-item-state*="error"] .filepond--item-panel) {
  background-color: rgba(239, 68, 68, 0.2);
}

/* Accepted file hint */
.filepond-uploader :deep(.filepond--credits) {
  display: none;
}

/* Fallback loading state */
.filepond-fallback {
  padding: 3rem 1rem;
  text-align: center;
  background-color: var(--surface-2, #121216);
  border: 2px dashed var(--border, #252529);
  border-radius: 16px;
  color: var(--text-muted, #71717A);
}
</style>
