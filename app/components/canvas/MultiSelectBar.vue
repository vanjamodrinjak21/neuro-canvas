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

const style = computed(() => ({
  position: 'fixed' as const,
  left: `${Math.max(120, Math.min(props.screenX, window.innerWidth - 120))}px`,
  top: `${Math.max(8, props.screenY - 8)}px`,
  transform: 'translateX(-50%) translateY(-100%)',
  zIndex: 160
}))
</script>

<template>
  <div class="nc-multiselect-bar" :style="style">
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
.nc-multiselect-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--nc-surface, #111114);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  pointer-events: auto;
}

.nc-ms-count {
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-ink-soft, #AAAAB0);
  padding: 0 4px;
  white-space: nowrap;
}

.nc-ms-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 2px;
}

.nc-ms-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--nc-ink-soft, #AAAAB0);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-ms-btn:hover {
  color: var(--nc-ink, #FAFAFA);
  background: rgba(255, 255, 255, 0.06);
}

.nc-ms-btn-ai:hover {
  color: var(--nc-accent, #00D2BE);
  background: rgba(0, 210, 190, 0.08);
}

.nc-ms-btn-danger:hover {
  color: #F87171;
  background: rgba(248, 113, 113, 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .nc-multiselect-bar {
    transition: none;
  }
}
</style>
