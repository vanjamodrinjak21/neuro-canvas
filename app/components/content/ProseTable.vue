<script setup lang="ts">
</script>

<template>
  <div class="table-wrapper">
    <table class="prose-table">
      <slot />
    </table>
  </div>
</template>

<style scoped>
.table-wrapper {
  overflow-x: auto;
  margin: 16px 0 24px;
}

.prose-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  overflow: hidden;
}

.prose-table :deep(thead) {
  background: var(--nc-surface);
}

.prose-table :deep(th) {
  text-align: left;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--nc-text-muted);
  border-bottom: 1px solid var(--nc-border);
  white-space: nowrap;
}

.prose-table :deep(td) {
  padding: 10px 16px;
  font-size: 14px;
  color: var(--nc-text-secondary);
  border-bottom: 1px solid var(--nc-border);
}

.prose-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.prose-table :deep(tbody tr) {
  transition: background 0.1s ease;
}

.prose-table :deep(tbody tr:hover) {
  background: var(--nc-accent-glow);
}

.table-wrapper::-webkit-scrollbar {
  height: 6px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: var(--nc-border-active);
  border-radius: 3px;
}

:root.light .prose-table :deep(tbody tr:hover) {
  background: rgba(0, 210, 190, 0.04);
}
</style>
