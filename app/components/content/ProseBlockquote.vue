<script setup lang="ts">
</script>

<template>
  <blockquote class="prose-blockquote">
    <div class="blockquote-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </div>
    <div class="blockquote-content">
      <slot />
    </div>
  </blockquote>
</template>

<style scoped>
.prose-blockquote {
  display: flex;
  gap: 12px;
  border-left: 2px solid var(--nc-accent);
  background: var(--nc-accent-glow);
  padding: 14px 16px 14px 18px;
  border-radius: 0 var(--nc-radius-sm) var(--nc-radius-sm) 0;
  margin: 16px 0 24px;
}

.blockquote-icon {
  flex-shrink: 0;
  color: var(--nc-accent);
  line-height: 0;
  margin-top: 4px;
}

.blockquote-content {
  font-family: var(--nc-font-serif, Georgia, serif);
  font-style: italic;
  font-size: calc(17px * var(--nc-text-scale, 1));
  line-height: 1.55;
  color: var(--nc-text-secondary);
  min-width: 0;
}

.blockquote-content :deep(p) {
  margin-bottom: 0;
}

.blockquote-content :deep(p + p) {
  margin-top: 8px;
}

:root.light .prose-blockquote {
  background: var(--nc-accent-glow-strong);
}

:root.light .blockquote-content {
  color: var(--nc-text-secondary);
}
</style>
