<script setup lang="ts">
/**
 * A compact, reusable segmented pill selector for AI-generation options
 * (style / tone). Shared by the Generate and Expand dialogs so the "način"
 * and "ton" controls stay visually and behaviourally identical everywhere.
 */
interface PillOption {
  value: string
  label: string
}

defineProps<{
  label: string
  options: PillOption[]
  modelValue: string
  disabled?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div class="nc-pills-field">
    <label class="nc-pills-label">{{ label }}</label>
    <div class="nc-pills">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        :class="['nc-pill', modelValue === opt.value && 'active']"
        :disabled="disabled"
        @click="$emit('update:modelValue', opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.nc-pills-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Field label — mono uppercase micro-label (REDESIGN.md §4/§5) */
.nc-pills-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.nc-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Fully-round pill — chip fill + hairline, accent when active */
.nc-pill {
  padding: 8px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 2rem;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .nc-pill:hover:not(:disabled) {
    border-color: var(--nc-border-active);
    background: var(--nc-surface-3);
  }
}

.nc-pill:active:not(:disabled) {
  transform: scale(0.97);
}

.nc-pill.active {
  border-color: var(--nc-accent);
  background: rgba(var(--nc-accent-rgb), 0.08);
  color: var(--nc-text);
}

.nc-pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
