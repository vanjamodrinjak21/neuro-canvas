<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore'

defineProps<{
  canUndo: boolean
  canRedo: boolean
  isDirty: boolean
}>()

const emit = defineEmits<{
  undo: []
  redo: []
  save: []
  share: []
  export: []
  help: []
  settings: []
}>()

const open = ref(false)

function handle(action: () => void) {
  action()
  open.value = false
}
</script>

<template>
  <div class="relative">
    <button
      class="w-8 h-8 rounded-md flex items-center justify-center text-nc-ink-soft hover:text-nc-ink hover:bg-nc-surface-3 transition-colors"
      @click.stop="open = !open"
    >
      <span class="i-lucide-more-horizontal text-lg" />
    </button>

    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      leave-active-class="transition-all duration-100 ease-in"
      enter-from-class="opacity-0 scale-95"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        class="absolute right-0 top-full mt-2 w-48 rounded-xl p-1.5 shadow-lg overflow-menu-panel"
        @click.stop
      >
        <button
          class="overflow-menu-item"
          :disabled="!canUndo"
          @click="handle(() => emit('undo'))"
        >
          <span class="i-lucide-undo text-base" />
          <span class="flex-1 text-left">Undo</span>
          <span class="overflow-menu-shortcut">⌘Z</span>
        </button>
        <button
          class="overflow-menu-item"
          :disabled="!canRedo"
          @click="handle(() => emit('redo'))"
        >
          <span class="i-lucide-redo text-base" />
          <span class="flex-1 text-left">Redo</span>
          <span class="overflow-menu-shortcut">⌘⇧Z</span>
        </button>

        <div class="overflow-menu-divider" />

        <button
          class="overflow-menu-item"
          :disabled="!isDirty"
          @click="handle(() => emit('save'))"
        >
          <span class="i-lucide-save text-base" />
          <span class="flex-1 text-left">Save</span>
          <span class="overflow-menu-shortcut">⌘S</span>
        </button>
        <button
          class="overflow-menu-item"
          @click="handle(() => emit('share'))"
        >
          <span class="i-lucide-share text-base" />
          <span class="flex-1 text-left">Share</span>
        </button>
        <button
          class="overflow-menu-item"
          @click="handle(() => emit('export'))"
        >
          <span class="i-lucide-download text-base" />
          <span class="flex-1 text-left">Export</span>
        </button>

        <div class="overflow-menu-divider" />

        <button
          class="overflow-menu-item"
          @click="handle(() => emit('help'))"
        >
          <span class="i-lucide-help-circle text-base" />
          <span class="flex-1 text-left">Help</span>
          <span class="overflow-menu-shortcut">?</span>
        </button>
        <button
          class="overflow-menu-item"
          @click="handle(() => emit('settings'))"
        >
          <span class="i-lucide-settings text-base" />
          <span class="flex-1 text-left">Settings</span>
        </button>
      </div>
    </Transition>

    <!-- Backdrop to close -->
    <div
      v-if="open"
      class="fixed inset-0 z-[-1]"
      @click="open = false"
    />
  </div>
</template>

<style scoped>
.overflow-menu-panel {
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  z-index: var(--nc-z-dropdown);
}

.overflow-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--nc-ink);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}

.overflow-menu-item:hover:not(:disabled) {
  background: var(--nc-surface-3);
}

.overflow-menu-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.overflow-menu-shortcut {
  font-size: 11px;
  color: var(--nc-ink-muted);
}

.overflow-menu-divider {
  height: 1px;
  background: var(--nc-border);
  margin: 6px 0;
}
</style>
