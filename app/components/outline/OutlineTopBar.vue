<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore'
import { useAutoSave } from '~/composables/useAutoSave'

const router = useRouter()
const mapStore = useMapStore()
const autoSave = useAutoSave()

const emit = defineEmits<{
  'export': []
}>()

const isEditingTitle = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)

const saveStatusText = computed(() => {
  if (!autoSave.lastSavedAt.value) return 'Not saved'
  const diff = Date.now() - autoSave.lastSavedAt.value
  if (diff < 5000) return 'Saved'
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  return `${Math.floor(diff / 60000)}m ago`
})

function handleBack() {
  router.push('/dashboard')
}

function startEditTitle() {
  isEditingTitle.value = true
  nextTick(() => titleInput.value?.focus())
}

function commitTitle() {
  isEditingTitle.value = false
  const val = titleInput.value?.value?.trim()
  if (val && val !== mapStore.title) {
    mapStore.setTitle(val)
  }
}
</script>

<template>
  <div class="nc-outline-topbar">
    <button class="nc-outline-back" @click="handleBack" aria-label="Back">
      <span class="i-lucide-chevron-left" />
    </button>

    <div class="nc-outline-title-group">
      <input
        v-if="isEditingTitle"
        ref="titleInput"
        class="nc-outline-title-input"
        :value="mapStore.title"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
      >
      <button v-else class="nc-outline-title" @click="startEditTitle">
        {{ mapStore.title || 'Untitled' }}
      </button>
      <span class="nc-outline-save-status">{{ saveStatusText }}</span>
    </div>

    <button class="nc-outline-export-btn" @click="$emit('export')" aria-label="Export">
      <span class="i-lucide-share-2" />
    </button>
  </div>
</template>

<style scoped>
.nc-outline-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  padding-top: max(8px, env(safe-area-inset-top));
  background: var(--nc-bg, #09090B);
  border-bottom: 1px solid var(--nc-border, #1A1A1E);
  min-height: 52px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nc-outline-back {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--nc-radius-md, 8px);
  background: transparent;
  border: none;
  color: var(--nc-text-soft, #A1A1AA);
  font-size: 20px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.nc-outline-back:active {
  background: var(--nc-surface-3, #18181B);
}

.nc-outline-title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nc-outline-title {
  font-family: var(--nc-font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--nc-text, #FAFAFA);
  letter-spacing: -0.01em;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-tap-highlight-color: transparent;
}

.nc-outline-title-input {
  font-family: var(--nc-font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--nc-text, #FAFAFA);
  letter-spacing: -0.01em;
  background: var(--nc-surface-3, #18181B);
  border: 1px solid var(--nc-accent, #00D2BE);
  border-radius: var(--nc-radius-sm, 6px);
  padding: 2px 8px;
  outline: none;
  width: 100%;
}

.nc-outline-save-status {
  font-size: 11px;
  font-weight: 500;
  color: var(--nc-accent, #00D2BE);
  opacity: 0.7;
}

.nc-outline-export-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--nc-radius-md, 8px);
  background: transparent;
  border: none;
  color: var(--nc-text-soft, #A1A1AA);
  font-size: 18px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.nc-outline-export-btn:active {
  background: var(--nc-surface-3, #18181B);
}
</style>
