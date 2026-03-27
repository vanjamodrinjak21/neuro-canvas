<script setup lang="ts">
defineProps<{
  id?: string
}>()
</script>

<template>
  <h1 :id="id" class="prose-h1">
    <slot />
  </h1>
</template>

<style scoped>
.prose-h1 {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
  margin-bottom: 8px;
  color: var(--nc-text);
  font-family: var(--nc-font-display, system-ui);
}
</style>
