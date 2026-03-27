<script setup lang="ts">
</script>

<template>
  <code class="prose-code"><slot /></code>
</template>

<style scoped>
.prose-code {
  background: rgba(0, 210, 190, 0.08);
  color: var(--nc-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: 0.875em;
  font-weight: 500;
  word-break: break-word;
}

:root.light .prose-code {
  background: rgba(0, 210, 190, 0.1);
  color: var(--nc-accent-dark);
}
</style>
