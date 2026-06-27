<script setup lang="ts">
</script>

<template>
  <li class="prose-li">
    <slot />
  </li>
</template>

<style scoped>
.prose-li {
  font-size: calc(15px * var(--nc-text-scale, 1));
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 6px;
}
</style>
