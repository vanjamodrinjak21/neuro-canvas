<script setup lang="ts">
defineProps<{
  id?: string
}>()
</script>

<template>
  <h2 :id="id" class="prose-h2">
    <slot />
    <a v-if="id" :href="`#${id}`" class="anchor" aria-hidden="true">#</a>
  </h2>
</template>

<style scoped>
.prose-h2 {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--nc-border);
  margin-bottom: 16px;
  color: var(--nc-text);
  font-family: var(--nc-font-display, system-ui);
}

.anchor {
  color: var(--nc-text-muted);
  opacity: 0;
  font-size: 18px;
  font-weight: 400;
  text-decoration: none;
  transition: opacity 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.prose-h2:hover .anchor {
  opacity: 1;
}

.anchor:hover {
  color: var(--nc-accent);
}
</style>
