<script setup lang="ts">
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'

/**
 * Footer — Sidebar collapse toggle at the bottom
 */
const dispatch = inject(SIDEBAR_DISPATCH_KEY)!
</script>

<template>
  <div class="sidebar-footer">
    <button
      class="sidebar-footer__btn"
      @click="dispatch({ type: 'nav:toggle-sidebar' })"
    >
      <span class="i-lucide-panel-left-close text-base" />
      <span>Hide Sidebar</span>
    </button>
  </div>
</template>

<style scoped>
.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--nc-border);
}

.sidebar-footer__btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  color: var(--nc-ink-faint);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sidebar-footer__btn:hover {
  color: var(--nc-ink);
  background: var(--nc-surface);
  border-color: var(--nc-border-active);
}
</style>
