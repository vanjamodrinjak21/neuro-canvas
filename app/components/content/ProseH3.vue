<script setup lang="ts">
defineProps<{
  id?: string
}>()
</script>

<template>
  <h3 :id="id" class="prose-h3">
    <slot />
    <a v-if="id" :href="`#${id}`" class="anchor" aria-hidden="true">#</a>
  </h3>
</template>

<style scoped>
.prose-h3 {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.4;
  margin-top: 32px;
  margin-bottom: 12px;
  color: var(--nc-text);
  font-family: var(--nc-font-display, system-ui);
}

.anchor {
  color: var(--nc-text-muted);
  opacity: 0;
  font-size: 15px;
  font-weight: 400;
  text-decoration: none;
  transition: opacity 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}

.prose-h3:hover .anchor {
  opacity: 1;
}

.anchor:hover {
  color: var(--nc-accent);
}
</style>
