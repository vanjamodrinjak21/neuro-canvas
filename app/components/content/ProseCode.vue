<script setup lang="ts">
</script>

<template>
  <code class="prose-code"><slot /></code>
</template>

<style scoped>
.prose-code {
  background: var(--nc-accent-glow);
  color: var(--nc-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--nc-font-mono, 'JetBrains Mono', monospace);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  word-break: break-word;
}

/* Light: inline code is small text — text-tier accent on the soft wash */
:root.light .prose-code {
  background: var(--nc-accent-glow-strong);
  color: var(--nc-accent-text);
}
</style>
