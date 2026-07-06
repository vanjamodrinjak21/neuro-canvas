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
  font-size: calc(34px * var(--nc-text-scale, 1));
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.1;
  margin-bottom: 8px;
  color: var(--nc-text);
  font-family: var(--nc-font-display, system-ui);
}
</style>
