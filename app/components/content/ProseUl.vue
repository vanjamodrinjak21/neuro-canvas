<script setup lang="ts">
</script>

<template>
  <ul class="prose-ul">
    <slot />
  </ul>
</template>

<style scoped>
.prose-ul {
  padding-left: 20px;
  margin-bottom: 16px;
  list-style-type: disc;
}

.prose-ul :deep(li) {
  font-size: 15px;
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 6px;
}

.prose-ul :deep(li::marker) {
  color: var(--nc-text-dim);
}
</style>
