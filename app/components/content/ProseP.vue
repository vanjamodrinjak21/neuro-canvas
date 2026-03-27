<script setup lang="ts">
</script>

<template>
  <p class="prose-p">
    <slot />
  </p>
</template>

<style scoped>
.prose-p {
  font-size: 15px;
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 16px;
}
</style>
