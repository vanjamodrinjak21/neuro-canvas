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
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: confirmFadeIn 150ms ease-out;
}

.confirm-modal {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 1001;
  width: 90%;
  max-width: 400px;
  transform: translate(-50%, -50%);
  background: #18181B;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: confirmSlideUp 200ms ease-out;
  outline: none;
}

.confirm-header {
  padding: 24px 24px 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.confirm-icon {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(20px * var(--nc-text-scale, 1));
}

/* Matches the home (dashboard) delete modal exactly. */
.confirm-icon--danger {
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.22);
  color: #DC2626;
}

.confirm-icon--default {
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  color: #00D2BE;
}

.confirm-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(18px * var(--nc-text-scale, 1));
  font-weight: 600;
  margin: 0 0 6px;
  color: #FAFAFA;
}

.confirm-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: #71717A;
  margin: 4px 0 0;
  line-height: 1.5;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.confirm-btn--ghost {
  background: transparent;
  color: #A1A1AA;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.confirm-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #E4E4E7;
}

.confirm-btn--danger {
  background: #DC2626;
  color: #FFFFFF;
}

.confirm-btn--danger:hover {
  background: #B91C1C;
}

.confirm-btn--primary {
  background: #00D2BE;
  color: #09090B;
}

.confirm-btn--primary:hover {
  opacity: 0.9;
}

/* ── Light theme ── */
:root.light .confirm-modal {
  background: #FFFFFF;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

:root.light .confirm-header {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

:root.light .confirm-title {
  color: #18181B;
}

:root.light .confirm-subtitle {
  color: #71717A;
}

:root.light .confirm-footer {
  border-top-color: rgba(0, 0, 0, 0.06);
  background: #FAFAF9;
}

:root.light .confirm-btn--ghost {
  color: #71717A;
  border-color: rgba(0, 0, 0, 0.1);
}

:root.light .confirm-btn--ghost:hover {
  background: rgba(0, 0, 0, 0.04);
  color: #18181B;
}

/* ── Animations ── */
@keyframes confirmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes confirmSlideUp {
  from { opacity: 0; transform: translate(-50%, -50%) translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translate(-50%, -50%) translateY(0) scale(1); }
}
</style>
