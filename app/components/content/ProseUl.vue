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
  font-size: calc(15px * var(--nc-text-scale, 1));
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 6px;
}

.prose-ul :deep(li::marker) {
  color: var(--nc-accent);
}
</style>
