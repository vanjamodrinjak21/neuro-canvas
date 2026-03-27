<script setup lang="ts">
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
} from 'radix-vue'

export interface NcDialogProps {
  open?: boolean
  title?: string
  description?: string
  showClose?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const props = withDefaults(defineProps<NcDialogProps>(), {
  open: false,
  title: '',
  description: '',
  showClose: true,
  size: 'md'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]'
}
</script>

<template>
  <DialogRoot v-model:open="isOpen">
    <!-- Trigger slot -->
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>

    <DialogPortal>
      <!-- Overlay - Dark -->
      <DialogOverlay
        class="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm pointer-events-auto
               data-[state=open]:animate-in data-[state=closed]:animate-out
               data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
               motion-reduce:animate-none"
      />

      <!-- Content -->
      <DialogContent
        :class="[
          'fixed left-1/2 top-1/2 z-[301] w-full -translate-x-1/2 -translate-y-1/2',
          'nc-glass-elevated rounded-nc-2xl p-6 shadow-nc-xl',
          'focus:outline-none',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          'motion-reduce:animate-none',
          sizeClasses[size]
        ]"
      >
        <!-- Header -->
        <div v-if="title || $slots.header" class="mb-4">
          <slot name="header">
            <DialogTitle class="text-xl font-semibold text-nc-ink font-display">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="mt-2 text-sm text-nc-ink-muted font-sans">
              {{ description }}
            </DialogDescription>
          </slot>
        </div>

        <!-- Body -->
        <div class="text-nc-ink font-sans">
          <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" class="mt-6 flex justify-end gap-3">
          <slot name="footer" />
        </div>

        <!-- Close button -->
        <DialogClose
          v-if="showClose"
          class="absolute right-4 top-4 p-1.5 rounded-nc-md
                 bg-transparent border-none
                 text-nc-ink-soft hover:text-nc-ink hover:bg-nc-pencil
                 transition-colors focus:outline-none focus:ring-2 focus:ring-nc-teal"
        >
          <span class="i-lucide-x text-lg" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
