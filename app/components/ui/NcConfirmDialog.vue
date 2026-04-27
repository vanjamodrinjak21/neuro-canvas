<script setup lang="ts">
import {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction
} from 'radix-vue'

export interface NcConfirmDialogProps {
  open?: boolean
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  icon?: string
}

const props = withDefaults(defineProps<NcConfirmDialogProps>(), {
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

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

function handleConfirm() {
  emit('confirm')
  isOpen.value = false
}

function handleCancel() {
  emit('cancel')
  isOpen.value = false
}
</script>

<template>
  <AlertDialogRoot v-model:open="isOpen">
    <AlertDialogTrigger as-child>
      <slot name="trigger" />
    </AlertDialogTrigger>

    <AlertDialogPortal>
      <AlertDialogOverlay class="confirm-overlay" />

      <AlertDialogContent class="confirm-modal">
        <!-- Header -->
        <div class="confirm-header">
          <div
            v-if="icon"
            :class="['confirm-icon', variant === 'danger' ? 'confirm-icon--danger' : 'confirm-icon--default']"
          >
            <span :class="[icon, 'text-xl']" />
          </div>
          <AlertDialogTitle class="confirm-title">
            {{ title }}
          </AlertDialogTitle>
          <AlertDialogDescription v-if="description" class="confirm-subtitle">
            {{ description }}
          </AlertDialogDescription>
        </div>

        <!-- Footer -->
        <div class="confirm-footer">
          <AlertDialogCancel as-child>
            <button class="confirm-btn confirm-btn--ghost" @click="handleCancel">
              {{ cancelText }}
            </button>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <button
              :class="['confirm-btn', variant === 'danger' ? 'confirm-btn--danger' : 'confirm-btn--primary']"
              @click="handleConfirm"
            >
              <span v-if="icon && variant === 'danger'" :class="[icon, 'text-sm']" />
              {{ confirmText }}
            </button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
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
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.confirm-icon--danger {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #EF4444;
}

.confirm-icon--default {
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.2);
  color: #00D2BE;
}

.confirm-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
  color: #FAFAFA;
}

.confirm-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
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
  font-size: 13px;
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
  background: #EF4444;
  color: #FFFFFF;
}

.confirm-btn--danger:hover {
  background: #DC2626;
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
