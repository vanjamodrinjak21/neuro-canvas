<script setup lang="ts">
const props = defineProps<{
  open: boolean
  pngDataUrl: string | null
  shareLink: string | null
  isGenerating: boolean
}>()

const emit = defineEmits<{
  'close': []
  'download-png': []
  'copy-link': []
  'share': []
}>()

const linkCopied = ref(false)

function handleCopyLink() {
  if (props.shareLink) {
    navigator.clipboard.writeText(props.shareLink)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  }
  emit('copy-link')
}

async function handleShare() {
  if (navigator.share && props.shareLink) {
    try {
      await navigator.share({
        title: 'NeuroCanvas Map',
        url: props.shareLink,
      })
    } catch {
      // User cancelled
    }
  }
  emit('share')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nc-sheet">
      <div v-if="open" class="nc-export-overlay" @click.self="$emit('close')">
        <div class="nc-export-sheet">
          <div class="nc-export-handle" />

          <h3 class="nc-export-title">Export Map</h3>

          <!-- PNG Preview -->
          <div class="nc-export-preview">
            <div v-if="isGenerating" class="nc-export-preview-loading">
              <span class="i-lucide-loader-circle nc-spin" />
              <span>Generating preview...</span>
            </div>
            <img
              v-else-if="pngDataUrl"
              :src="pngDataUrl"
              alt="Map preview"
              class="nc-export-preview-img"
            >
            <div v-else class="nc-export-preview-empty">
              <span class="i-lucide-image" />
              <span>No preview available</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="nc-export-actions">
            <button class="nc-export-action nc-export-action--primary" @click="$emit('download-png')">
              <span class="i-lucide-download" />
              Download PNG
            </button>
            <button
              v-if="shareLink"
              class="nc-export-action"
              @click="handleCopyLink"
            >
              <span :class="linkCopied ? 'i-lucide-check' : 'i-lucide-link'" />
              {{ linkCopied ? 'Copied!' : 'Copy Link' }}
            </button>
            <button
              v-if="typeof navigator !== 'undefined' && 'share' in navigator"
              class="nc-export-action"
              @click="handleShare"
            >
              <span class="i-lucide-share-2" />
              Share
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nc-export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.nc-export-sheet {
  width: 100%;
  max-width: 440px;
  background: var(--nc-surface, #111113);
  border-top-left-radius: var(--nc-radius-2xl, 20px);
  border-top-right-radius: var(--nc-radius-2xl, 20px);
  padding: 12px 20px 20px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
  border: 1px solid var(--nc-border, #1A1A1E);
  border-bottom: none;
}

.nc-export-handle {
  width: 36px;
  height: 4px;
  background: var(--nc-text-dim, #3F3F46);
  border-radius: 2px;
  margin: 0 auto 16px;
}

.nc-export-title {
  font-family: var(--nc-font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--nc-text, #FAFAFA);
  margin-bottom: 16px;
}

.nc-export-preview {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--nc-surface-3, #18181B);
  border-radius: var(--nc-radius-lg, 12px);
  border: 1px solid var(--nc-border, #1A1A1E);
  overflow: hidden;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nc-export-preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.nc-export-preview-loading,
.nc-export-preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--nc-text-muted, #52525B);
}

.nc-export-preview-loading .nc-spin,
.nc-export-preview-empty span:first-child {
  font-size: 24px;
}

.nc-spin {
  animation: nc-spin 0.8s linear infinite;
}

@keyframes nc-spin {
  to { transform: rotate(360deg); }
}

.nc-export-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nc-export-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 48px;
  border-radius: var(--nc-radius-lg, 12px);
  border: 1px solid var(--nc-border, #1A1A1E);
  background: var(--nc-surface-3, #18181B);
  color: var(--nc-text, #FAFAFA);
  font-family: var(--nc-font-body);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--nc-duration-fast) var(--nc-ease);
  -webkit-tap-highlight-color: transparent;
}

.nc-export-action:active {
  transform: scale(0.98);
}

.nc-export-action--primary {
  background: var(--nc-accent, #00D2BE);
  border-color: var(--nc-accent, #00D2BE);
  color: #09090B;
  font-weight: 600;
}

.nc-export-action--primary:active {
  background: var(--nc-accent-dark, #00A89A);
}

/* Sheet transition */
.nc-sheet-enter-active {
  transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
.nc-sheet-leave-active {
  transition: all 200ms ease-in;
}
.nc-sheet-enter-from .nc-export-sheet,
.nc-sheet-leave-to .nc-export-sheet {
  transform: translateY(100%);
}
.nc-sheet-enter-from,
.nc-sheet-leave-to {
  opacity: 0;
}
</style>
