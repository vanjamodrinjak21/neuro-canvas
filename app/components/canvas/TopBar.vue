<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore'
import { useAutoSave } from '~/composables/useAutoSave'

const props = defineProps<{
  isEditingTitle: boolean
  editedTitle: string
  isAILoading: boolean
  hasSelection: boolean
}>()

const emit = defineEmits<{
  'start-editing': []
  'save-title': []
  'cancel-edit': []
  'title-input': [value: string]
  'smart-expand': []
  'save': []
  'open-shortcuts': []
  'undo': []
  'redo': []
  'share': []
  'export': []
  'settings': []
}>()

const mapStore = useMapStore()
const autoSave = useAutoSave()

const titleInputRef = ref<HTMLElement | null>(null)

function focusTitleInput() {
  nextTick(() => {
    const el = titleInputRef.value
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

defineExpose({ focusTitleInput })
</script>

<template>
  <header class="absolute top-4 left-4 right-4 z-200 pointer-events-none">
    <div class="nc-between">
      <!-- Left: Back + Title -->
      <div class="pointer-events-auto flex items-center gap-4">
        <NuxtLink
          to="/dashboard"
          class="topbar-icon-btn"
          aria-label="Back to dashboard"
        >
          <span class="i-lucide-arrow-left text-lg" />
        </NuxtLink>

        <span
          v-if="isEditingTitle"
          ref="titleInputRef"
          contenteditable="true"
          class="topbar-title-edit"
          @keydown.enter.prevent="emit('save-title')"
          @keydown.escape="emit('cancel-edit')"
          @blur="emit('save-title')"
          @input="emit('title-input', ($event.target as HTMLElement).textContent || '')"
        >{{ editedTitle }}</span>
        <button
          v-else
          class="topbar-title-btn"
          @click="emit('start-editing')"
        >
          {{ mapStore.title }}
        </button>

        <!-- Inline save status -->
        <span class="topbar-save-status">
          <template v-if="autoSave.isSaving.value">
            <span class="i-lucide-loader-2 animate-spin text-nc-ink-soft" />
          </template>
          <template v-else-if="!mapStore.isDirty">
            <span class="topbar-saved-dot" />
            <span>Saved</span>
          </template>
          <template v-else>
            <span class="text-nc-ink-soft">Unsaved</span>
          </template>
        </span>
      </div>

      <!-- Right: AI Status + AI Expand + Overflow Menu -->
      <div class="pointer-events-auto flex items-center gap-3">
        <CanvasAIStatusIndicator />

        <button
          class="nc-ai-btn"
          :disabled="!hasSelection || isAILoading"
          @click="emit('smart-expand')"
        >
          <span class="i-lucide-sparkles" :class="isAILoading ? 'animate-spin' : ''" />
          AI Expand
        </button>

        <CanvasOverflowMenu
          :can-undo="mapStore.canUndo()"
          :can-redo="mapStore.canRedo()"
          :is-dirty="mapStore.isDirty"
          @undo="emit('undo')"
          @redo="emit('redo')"
          @save="emit('save')"
          @share="emit('share')"
          @export="emit('export')"
          @help="emit('open-shortcuts')"
          @settings="emit('settings')"
        />
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-ink-soft);
  transition: color 0.15s ease;
}

.topbar-icon-btn:hover {
  color: var(--nc-ink);
}

.topbar-title-edit {
  display: inline-block;
  min-width: 60px;
  max-width: 200px;
  background: var(--nc-surface-3);
  color: var(--nc-ink);
  font-weight: 500;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--nc-accent);
  outline: none;
  caret-color: var(--nc-accent);
  white-space: nowrap;
  overflow: hidden;
}

.topbar-title-btn {
  color: var(--nc-ink);
  font-weight: 500;
  font-size: 14px;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.topbar-title-btn:hover {
  color: var(--nc-accent);
}

.topbar-save-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--nc-ink-muted);
}

.topbar-saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-accent);
}
</style>
