<script setup lang="ts">
</script>

<template>
  <ol class="prose-ol">
    <slot />
  </ol>
</template>

<style scoped>
.prose-ol {
  padding-left: 20px;
  margin-bottom: 16px;
  list-style-type: decimal;
}

.prose-ol :deep(li) {
  font-size: 15px;
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 6px;
}

.prose-ol :deep(li::marker) {
  color: var(--nc-text-dim);
  font-weight: 500;
}
</style>
