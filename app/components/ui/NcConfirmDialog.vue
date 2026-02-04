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
    <!-- Trigger slot -->
    <AlertDialogTrigger as-child>
      <slot name="trigger" />
    </AlertDialogTrigger>

    <AlertDialogPortal>
      <!-- Overlay - Dark -->
      <AlertDialogOverlay
        class="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm
               data-[state=open]:animate-in data-[state=closed]:animate-out
               data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />

      <!-- Content -->
      <AlertDialogContent
        class="fixed left-1/2 top-1/2 z-[301] w-full max-w-sm -translate-x-1/2 -translate-y-1/2
               nc-glass-elevated rounded-nc-2xl p-6 shadow-nc-xl
               focus:outline-none
               data-[state=open]:animate-in data-[state=closed]:animate-out
               data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
               data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95
               data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]
               data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
      >
        <!-- Header with optional icon -->
        <div class="mb-4">
          <div v-if="icon" class="mb-3 flex justify-center">
            <div
              :class="[
                'w-12 h-12 rounded-nc-lg flex items-center justify-center',
                variant === 'danger'
                  ? 'bg-nc-error/10 text-nc-error'
                  : 'bg-nc-teal/10 text-nc-teal'
              ]"
            >
              <span :class="[icon, 'text-xl']" />
            </div>
          </div>
          <AlertDialogTitle class="text-lg font-semibold text-nc-ink font-display text-center">
            {{ title }}
          </AlertDialogTitle>
          <AlertDialogDescription v-if="description" class="mt-2 text-sm text-nc-ink-muted font-sans text-center">
            {{ description }}
          </AlertDialogDescription>
        </div>

        <!-- Footer with actions -->
        <div class="flex justify-end gap-3 mt-6">
          <AlertDialogCancel as-child>
            <NcButton variant="ghost" @click="handleCancel">
              {{ cancelText }}
            </NcButton>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <NcButton
              :variant="variant === 'danger' ? 'danger' : 'primary'"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </NcButton>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
