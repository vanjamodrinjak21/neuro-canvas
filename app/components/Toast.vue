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

.nc-toast {
  pointer-events: auto;
  max-width: 320px;
  min-width: 220px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--nc-surface-2, #15161A);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  user-select: none;
}

.nc-toast:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.nc-toast__msg {
  display: block;
  word-wrap: break-word;
}

.nc-toast--error {
  border-color: rgba(239, 68, 68, 0.4);
  color: #FCA5A5;
}

.nc-toast--warning {
  border-color: rgba(250, 204, 21, 0.4);
  color: #FACC15;
}

.nc-toast--success {
  border-color: rgba(0, 210, 190, 0.4);
  color: #00D2BE;
}

.nc-toast--info {
  border-color: rgba(96, 165, 250, 0.4);
  color: #93C5FD;
}

/* Enter / leave transitions */
.nc-toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.nc-toast-enter-active {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.nc-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.nc-toast-leave-active {
  transition: opacity 160ms ease-in, transform 160ms ease-in;
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
