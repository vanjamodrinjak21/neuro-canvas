<script setup lang="ts">
defineProps<{
  suggestions: readonly string[]
  depth: number
}>()

const emit = defineEmits<{
  'accept': []
  'dismiss': []
}>()
</script>

<template>
  <div v-if="suggestions.length > 0" class="nc-ghost-container">
    <div
      v-for="(suggestion, i) in suggestions"
      :key="i"
      class="nc-ghost-item"
      :style="{ paddingLeft: `${depth * 24 + 12}px` }"
    >
      <span class="nc-ghost-bullet" />
      <span class="nc-ghost-text">{{ suggestion }}</span>
    </div>
    <div class="nc-ghost-hint" :style="{ paddingLeft: `${depth * 24 + 38}px` }">
      <kbd>Tab</kbd> to accept
    </div>
  </div>
</template>

<style scoped>
.nc-ghost-container {
  animation: nc-ghost-fade-in 200ms var(--nc-ease) both;
}

.nc-ghost-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-right: 16px;
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 32px;
  opacity: 0.35;
  pointer-events: none;
}

.nc-ghost-bullet {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-accent, #5EF2E8);
  margin-top: 10px;
}

.nc-ghost-text {
  font-family: var(--nc-font-body);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 24px;
  color: var(--nc-accent, #5EF2E8);
  font-style: italic;
}

.nc-ghost-hint {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted, rgba(244, 244, 248, 0.45));
  padding-top: 2px;
  padding-bottom: 6px;
  opacity: 0.7;
}

.nc-ghost-hint kbd {
  display: inline-block;
  padding: 1px 5px;
  font-size: calc(10px * var(--nc-text-scale, 1));
  background: var(--nc-surface-3, #1a1a20);
  border: 1px solid var(--nc-border, rgba(244, 244, 248, 0.14));
  border-radius: 3px;
  margin-right: 3px;
}

@keyframes nc-ghost-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
