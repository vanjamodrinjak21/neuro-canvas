<script setup lang="ts">
const props = defineProps<{
  count: number
  screenX: number
  screenY: number
}>()

const emit = defineEmits<{
  'duplicate': []
  'ai-expand': []
  'delete': []
}>()

// JS-computed position — single-custom-property pattern (REDESIGN.md §9),
// consumed by scoped CSS; no direct CSS props in :style.
const positionVars = computed(() => ({
  '--ms-x': `${Math.max(120, Math.min(props.screenX, window.innerWidth - 120))}px`,
  '--ms-y': `${Math.max(8, props.screenY - 8)}px`
}))
</script>

<template>
  <div class="nc-multiselect-bar" :style="positionVars">
    <span class="nc-ms-count">{{ $t('maps.select.selected_count', { n: count }) }}</span>

    <div class="nc-ms-divider" />

    <button
      class="nc-ms-btn"
      :title="$t('canvas.multiselect.duplicate_tooltip')"
      :aria-label="$t('canvas.multiselect.duplicate_tooltip')"
      @click="emit('duplicate')"
    >
      <span class="i-lucide-copy text-sm" />
    </button>

    <button
      class="nc-ms-btn nc-ms-btn-ai"
      :title="$t('canvas.multiselect.ai_expand_tooltip')"
      :aria-label="$t('canvas.multiselect.ai_expand_tooltip')"
      @click="emit('ai-expand')"
    >
      <span class="i-lucide-waypoints text-sm" />
    </button>

    <button
      class="nc-ms-btn nc-ms-btn-danger"
      :title="$t('canvas.multiselect.delete_tooltip')"
      :aria-label="$t('canvas.multiselect.delete_tooltip')"
      @click="emit('delete')"
    >
      <span class="i-lucide-trash-2 text-sm" />
    </button>
  </div>
</template>

<style scoped>
/* Floating toolbar — flat surface-2 + hairline (REDESIGN.md §5),
   enters scale(0.97)+opacity from the selection anchor below. */
.nc-multiselect-bar {
  position: fixed;
  left: var(--ms-x);
  top: var(--ms-y);
  transform: translateX(-50%) translateY(-100%);
  transform-origin: bottom center;
  z-index: 160;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  pointer-events: auto;
  animation: nc-ms-in 150ms var(--nc-ease);
}

@keyframes nc-ms-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-100%) scale(0.97);
  }
}

/* Selection count — mono micro readout (REDESIGN.md §4) */
.nc-ms-count {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  letter-spacing: 0.05em;
  color: var(--nc-text-secondary);
  padding: 0 4px;
  white-space: nowrap;
}

.nc-ms-divider {
  width: 1px;
  height: 16px;
  background: var(--nc-border);
  margin: 0 2px;
}

.nc-ms-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--nc-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-ms-btn:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }

  .nc-ms-btn-ai:hover {
    color: var(--nc-accent-text);
    background: rgba(var(--nc-accent-rgb), 0.08);
  }

  /* Destructive — coral, never a second interactive hue (REDESIGN.md §1) */
  .nc-ms-btn-danger:hover {
    color: var(--nc-coral);
    background: rgba(var(--nc-coral-rgb), 0.08);
  }
}

.nc-ms-btn:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .nc-multiselect-bar {
    animation: none;
  }

  .nc-ms-btn {
    transition: none;
  }
}
</style>
