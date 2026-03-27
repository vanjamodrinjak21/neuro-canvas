<script setup lang="ts">
import { useMapStore } from '~/stores/mapStore'

const mapStore = useMapStore()

const emit = defineEmits<{
  'undo': []
  'redo': []
  'indent': []
  'outdent': []
  'bold': []
  'toggle-ai': []
  'export': []
}>()

const aiEnabled = ref(false)
</script>

<template>
  <div class="nc-outline-toolbar">
    <div class="nc-outline-toolbar-inner">
      <button
        class="nc-outline-tool"
        :disabled="!mapStore.canUndo()"
        @click="$emit('undo')"
        aria-label="Undo"
      >
        <span class="i-lucide-undo-2" />
      </button>
      <button
        class="nc-outline-tool"
        :disabled="!mapStore.canRedo()"
        @click="$emit('redo')"
        aria-label="Redo"
      >
        <span class="i-lucide-redo-2" />
      </button>

      <span class="nc-outline-tool-divider" />

      <button class="nc-outline-tool" @click="$emit('outdent')" aria-label="Outdent">
        <span class="i-lucide-outdent" />
      </button>
      <button class="nc-outline-tool" @click="$emit('indent')" aria-label="Indent">
        <span class="i-lucide-indent" />
      </button>

      <span class="nc-outline-tool-divider" />

      <button class="nc-outline-tool" @click="$emit('bold')" aria-label="Bold">
        <span class="i-lucide-bold" />
      </button>

      <span class="nc-outline-tool-divider" />

      <button
        class="nc-outline-tool"
        :class="{ 'is-active': aiEnabled }"
        @click="aiEnabled = !aiEnabled; $emit('toggle-ai')"
        aria-label="Toggle AI suggestions"
      >
        <span class="i-lucide-sparkles" />
      </button>

      <button class="nc-outline-tool nc-outline-tool--export" @click="$emit('export')" aria-label="Export">
        <span class="i-lucide-download" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.nc-outline-toolbar {
  position: sticky;
  bottom: 0;
  padding: 8px 12px;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  background: var(--nc-bg, #09090B);
  border-top: 1px solid var(--nc-border, #1A1A1E);
  z-index: 100;
}

.nc-outline-toolbar-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--nc-surface, #111113);
  border-radius: var(--nc-radius-xl, 16px);
  border: 1px solid var(--nc-border, #1A1A1E);
}

.nc-outline-tool {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--nc-radius-md, 8px);
  background: transparent;
  border: none;
  color: var(--nc-text-soft, #A1A1AA);
  font-size: 18px;
  cursor: pointer;
  transition: all var(--nc-duration-fast) var(--nc-ease);
  -webkit-tap-highlight-color: transparent;
}

.nc-outline-tool:active:not(:disabled) {
  background: var(--nc-surface-3, #18181B);
  transform: scale(0.92);
}

.nc-outline-tool:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nc-outline-tool.is-active {
  color: var(--nc-accent, #00D2BE);
  background: rgba(0, 210, 190, 0.08);
}

.nc-outline-tool--export {
  margin-left: auto;
}

.nc-outline-tool-divider {
  width: 1px;
  height: 20px;
  background: var(--nc-border, #1A1A1E);
  flex-shrink: 0;
}
</style>
