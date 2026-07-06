<script setup lang="ts">
/**
 * Global toast stack. Mount once at the app root. Reads the singleton
 * list from `useToast()` and renders each toast at the bottom-center.
 * Click a toast to dismiss it early.
 */
import { useToast } from '~/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div
      class="nc-toast-stack"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      <TransitionGroup name="nc-toast" tag="div" class="nc-toast-stack__inner">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['nc-toast', `nc-toast--${t.kind}`]"
          role="status"
          tabindex="0"
          @click="dismiss(t.id)"
          @keydown.enter.prevent="dismiss(t.id)"
          @keydown.space.prevent="dismiss(t.id)"
        >
          <span class="nc-toast__msg">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.nc-toast-stack {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--nc-z-toast, 400);
  pointer-events: none;
}

.nc-toast-stack__inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

/* Toast grammar (REDESIGN.md §5 + ui/NcToast): flat surface-2, hairline,
   2px semantic left edge. Accent discipline — cyan for success/info,
   coral for warning/error; text stays ink, never a status rainbow. */
.nc-toast {
  pointer-events: auto;
  max-width: 320px;
  min-width: 220px;
  padding: 12px 14px;
  border-radius: var(--nc-radius-md);
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-left-width: 2px;
  border-left-color: var(--nc-accent);
  color: var(--nc-text);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.4;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--nc-shadow-md);
  user-select: none;
}

.nc-toast:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

.nc-toast__msg {
  display: block;
  word-wrap: break-word;
}

.nc-toast--error,
.nc-toast--warning {
  border-left-color: var(--nc-coral);
}

.nc-toast--success,
.nc-toast--info {
  border-left-color: var(--nc-accent);
}

/* Enter / leave transitions — transform/opacity only, single ease */
.nc-toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.nc-toast-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-normal) var(--nc-ease);
}
.nc-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.nc-toast-leave-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease);
}

@media (prefers-reduced-motion: reduce) {
  .nc-toast-enter-active,
  .nc-toast-leave-active {
    transition: opacity 120ms linear;
    transform: none;
  }
  .nc-toast-enter-from,
  .nc-toast-leave-to {
    transform: none;
  }
}
</style>
