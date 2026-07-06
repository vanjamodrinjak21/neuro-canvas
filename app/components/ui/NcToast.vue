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

// Accent discipline (REDESIGN.md §1): cyan for info/success, coral for
// warning/error — no status rainbow in chrome. Semantic 2px left edge only.
const variantStyles: Record<ToastVariant, { icon: string; iconClass: string; edgeClass: string }> = {
  default: {
    icon: 'i-lucide-info',
    iconClass: 'text-nc-accent',
    edgeClass: 'border-l-nc-accent'
  },
  success: {
    icon: 'i-lucide-check-circle',
    iconClass: 'text-nc-accent',
    edgeClass: 'border-l-nc-accent'
  },
  warning: {
    icon: 'i-lucide-alert-triangle',
    iconClass: 'text-nc-coral',
    edgeClass: 'border-l-nc-coral'
  },
  error: {
    icon: 'i-lucide-x-circle',
    iconClass: 'text-nc-coral',
    edgeClass: 'border-l-nc-coral'
  },
  info: {
    icon: 'i-lucide-info',
    iconClass: 'text-nc-accent',
    edgeClass: 'border-l-nc-accent'
  }
}

const currentVariant = computed(() => variantStyles[props.variant])
</script>

<template>
  <ToastRoot
    v-model:open="isOpen"
    :duration="duration"
    :class="[
      'group nc-toast-root bg-nc-surface-2 border border-nc-border rounded-nc-md p-4 shadow-nc-md',
      'flex items-start gap-3',
      'border-l-2',
      currentVariant.edgeClass,
      'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
      'data-[swipe=cancel]:translate-x-0',
      'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]'
    ]"
  >
    <!-- Icon -->
    <span :class="[currentVariant.icon, 'text-xl shrink-0', currentVariant.iconClass]" />

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <!-- Title — mono micro-label (REDESIGN.md §4) -->
      <ToastTitle v-if="title" class="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-nc-text">
        {{ title }}
      </ToastTitle>
      <ToastDescription v-if="description" class="mt-1 text-sm text-nc-text-secondary">
        {{ description }}
      </ToastDescription>

      <!-- Action -->
      <ToastAction
        v-if="action"
        :alt-text="action.label"
        class="mt-2 inline-flex items-center px-3 py-1.5 rounded-[0.4rem]
               font-mono text-[0.72rem] uppercase tracking-[0.1em]
               bg-nc-chip border border-nc-border text-nc-text-secondary
               hover:text-nc-text hover:border-nc-border-active
               nc-anim active:scale-97 cursor-pointer"
        @click="action.onClick"
      >
        {{ action.label }}
      </ToastAction>
    </div>

    <!-- Close button -->
    <ToastClose
      class="p-1 rounded-[0.35rem] text-nc-ink-muted hover:text-nc-ink
             hover:bg-nc-surface-3 nc-anim active:scale-97 cursor-pointer
             opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
    >
      <span class="i-lucide-x text-lg" />
    </ToastClose>
  </ToastRoot>
</template>

<style scoped>
/* Toast motion — transform/opacity only, single ease, enter 250ms / exit
   150ms. Global reduced-motion rules zero these out. */
.nc-toast-root[data-state='open'] {
  animation: nc-toast-in 250ms var(--nc-ease);
}
.nc-toast-root[data-state='closed'] {
  animation: nc-toast-out 150ms var(--nc-ease) forwards;
}
.nc-toast-root[data-swipe='end'] {
  animation: nc-toast-out 150ms var(--nc-ease) forwards;
}

@keyframes nc-toast-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
}
@keyframes nc-toast-out {
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}
</style>
