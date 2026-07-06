<script setup lang="ts">
// Plain Teleport + v-if modal — intentionally NOT radix-vue. The radix
// AlertDialog (Portal + focus-trap + as-child trigger) fails to render/interact
// inside native WKWebViews (Tauri/Capacitor), so the delete confirm looked
// broken on the maps/documents pages. This mirrors the home (dashboard) delete
// modal, which is dependency-free and works on web, desktop, and mobile alike.
// Props/emits API is unchanged so useConfirmDialog and every consumer keep working.
export interface NcConfirmDialogProps {
  open?: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  icon?: string
}

withDefaults(defineProps<NcConfirmDialogProps>(), {
  open: false,
  title: 'Are you sure?',
  description: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default',
  icon: ''
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
  'cancel': []
}>()

function handleConfirm() {
  emit('confirm')
  emit('update:open', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="confirm-overlay" @click.self="handleCancel">
      <div class="confirm-modal" role="alertdialog" aria-modal="true">
        <!-- Header -->
        <div class="confirm-header">
          <div
            v-if="icon"
            :class="['confirm-icon', variant === 'danger' ? 'confirm-icon--danger' : 'confirm-icon--default']"
          >
            <span :class="[icon, 'text-xl']" />
          </div>
          <h2 class="confirm-title">
            {{ title }}
          </h2>
          <p v-if="description" class="confirm-subtitle">
            {{ description }}
          </p>
        </div>

        <!-- Footer -->
        <div class="confirm-footer">
          <button class="confirm-btn confirm-btn--ghost" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button
            :class="['confirm-btn', variant === 'danger' ? 'confirm-btn--danger' : 'confirm-btn--primary']"
            @click="handleConfirm"
          >
            <span v-if="icon && variant === 'danger'" :class="[icon, 'text-sm']" />
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* All colors token-driven (var(--nc-*)) so light mode flips automatically —
   the per-theme override block this file used to carry is gone by design. */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(var(--nc-bg-rgb), 0.66);
  animation: confirmFadeIn 150ms var(--nc-ease);
}

/* Flat surface-2 + hairline, radius ≤ 0.5rem, transform-origin center,
   enter scale(0.97)+opacity 200ms single ease (REDESIGN.md §5/§6). */
.confirm-modal {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 1001;
  width: 90%;
  max-width: 400px;
  transform: translate(-50%, -50%);
  transform-origin: center;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: var(--nc-shadow-xl);
  animation: confirmScaleIn 200ms var(--nc-ease);
  outline: none;
}

.confirm-header {
  padding: 24px 24px 16px;
  text-align: center;
  border-bottom: 1px solid var(--nc-border-subtle);
}

.confirm-icon {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(20px * var(--nc-text-scale, 1));
}

/* Coral = destructive-confirm accent; cyan = interactive (REDESIGN.md §1) */
.confirm-icon--danger {
  background: rgba(var(--nc-coral-rgb), 0.1);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.22);
  color: var(--nc-coral);
}

.confirm-icon--default {
  background: rgba(var(--nc-accent-rgb), 0.1);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.2);
  color: var(--nc-accent);
}

/* Modal header — display font 700, tight tracking (REDESIGN.md §4) */
.confirm-title {
  font-family: var(--nc-font-display);
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  margin: 0 0 6px;
  color: var(--nc-text);
}

.confirm-subtitle {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  margin: 4px 0 0;
  line-height: 1.5;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--nc-border-subtle);
  background: var(--nc-chip-bg);
}

.confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  cursor: pointer;
  border: none;
  transition:
    background-color 0.15s var(--nc-ease),
    color 0.15s var(--nc-ease),
    transform 0.15s var(--nc-ease),
    opacity 0.15s var(--nc-ease);
}

.confirm-btn:active {
  transform: scale(0.97);
}

/* Ghost — mono uppercase text link with underline-grow (REDESIGN.md §5) */
.confirm-btn--ghost {
  position: relative;
  background: transparent;
  border-radius: 0.4rem;
  color: var(--nc-text-secondary);
  font-family: var(--nc-font-mono);
  font-size: calc(0.78rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.confirm-btn--ghost::after {
  content: '';
  position: absolute;
  left: 0.9em;
  right: 0.9em;
  bottom: 0.3em;
  height: 1px;
  background: currentColor;
  transform: scaleX(0.35);
  transform-origin: left;
  transition: transform 0.45s var(--nc-ease);
}

/* Primary — ink pill; Danger — coral pill (destructive confirm) */
.confirm-btn--primary,
.confirm-btn--danger {
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
}

.confirm-btn--primary {
  background: var(--nc-text);
  color: var(--nc-bg);
}

.confirm-btn--danger {
  background: var(--nc-coral);
  color: var(--nc-bg);
}

@media (hover: hover) and (pointer: fine) {
  .confirm-btn--ghost:hover {
    color: var(--nc-accent);
  }

  .confirm-btn--ghost:hover::after {
    transform: scaleX(1);
  }

  .confirm-btn--primary:hover {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }

  .confirm-btn--danger:hover {
    transform: translateY(-1px);
  }
}

/* ── Animations ── */
@keyframes confirmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes confirmScaleIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
</style>
