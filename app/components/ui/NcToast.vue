<script setup lang="ts">
import {
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose
} from 'radix-vue'

export type ToastVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

export interface NcToastProps {
  open?: boolean
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

const props = withDefaults(defineProps<NcToastProps>(), {
  open: true,
  title: '',
  description: '',
  variant: 'default',
  duration: 5000
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const variantStyles: Record<ToastVariant, { icon: string; iconClass: string; borderClass: string }> = {
  default: {
    icon: 'i-lucide-info',
    iconClass: 'text-nc-teal',
    borderClass: 'border-nc-teal/30'
  },
  success: {
    icon: 'i-lucide-check-circle',
    iconClass: 'text-nc-success',
    borderClass: 'border-nc-success/30'
  },
  warning: {
    icon: 'i-lucide-alert-triangle',
    iconClass: 'text-nc-warning',
    borderClass: 'border-nc-warning/30'
  },
  error: {
    icon: 'i-lucide-x-circle',
    iconClass: 'text-nc-error',
    borderClass: 'border-nc-error/30'
  },
  info: {
    icon: 'i-lucide-info',
    iconClass: 'text-nc-info',
    borderClass: 'border-nc-info/30'
  }
}

const currentVariant = computed(() => variantStyles[props.variant])
</script>

<template>
  <ToastRoot
    v-model:open="isOpen"
    :duration="duration"
    :class="[
      'group nc-glass-elevated rounded-nc-xl p-4 shadow-nc-xl',
      'flex items-start gap-3',
      'border-l-4',
      currentVariant.borderClass,
      // Enter 300ms snappy from right, exit 200ms faster — asymmetric
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
      'data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full',
      'data-[state=open]:duration-[300ms] data-[state=closed]:duration-[200ms]',
      'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
      'data-[swipe=cancel]:translate-x-0',
      'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
      'data-[swipe=end]:animate-out data-[swipe=end]:fade-out-80'
    ]"
  >
    <!-- Icon -->
    <span :class="[currentVariant.icon, 'text-xl shrink-0', currentVariant.iconClass]" />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <ToastTitle v-if="title" class="text-sm font-semibold text-nc-text">
        {{ title }}
      </ToastTitle>
      <ToastDescription v-if="description" class="mt-1 text-sm text-nc-text-muted">
        {{ description }}
      </ToastDescription>

      <!-- Action -->
      <ToastAction
        v-if="action"
        :alt-text="action.label"
        class="mt-2 inline-flex items-center px-3 py-1.5 rounded-nc-md text-sm font-medium
               bg-nc-graphite text-nc-ink hover:bg-nc-pencil
               transition-[color,background-color] duration-100
               active:scale-97
               focus:outline-none focus:ring-2 focus:ring-nc-teal"
        @click="action.onClick"
      >
        {{ action.label }}
      </ToastAction>
    </div>

    <!-- Close button -->
    <ToastClose
      class="p-1 rounded-nc-md text-nc-ink-muted hover:text-nc-ink
             hover:bg-nc-graphite transition-[color,background-color] duration-100
             active:scale-97
             opacity-0 group-hover:opacity-100
             focus:outline-none focus:ring-2 focus:ring-nc-teal"
    >
      <span class="i-lucide-x text-lg" />
    </ToastClose>
  </ToastRoot>
</template>
