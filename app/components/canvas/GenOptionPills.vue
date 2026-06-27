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

.nc-pills-label {
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.nc-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nc-pill {
  padding: 8px 14px;
  background: var(--nc-surface-3, #0D0D10);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 999px;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-pill:hover:not(:disabled) {
  border-color: #2A2A30;
  background: var(--nc-surface, #141418);
}

.nc-pill.active {
  border-color: #00D2BE;
  background: rgba(0, 210, 190, 0.08);
  color: var(--nc-ink, #FAFAFA);
}

.nc-pill:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
