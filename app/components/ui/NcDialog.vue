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
      <!-- Scrim — flat, NO backdrop-filter blur (REDESIGN.md §5) -->
      <DialogOverlay class="nc-dialog-overlay fixed inset-0 z-modal bg-nc-bg/66 pointer-events-auto" />

      <!-- Content — flat surface-2 + hairline; enter scale(0.97)+opacity 200ms, exit 150ms -->
      <DialogContent
        :class="[
          'nc-dialog-content',
          'fixed left-1/2 top-1/2 z-[301] w-full -translate-x-1/2 -translate-y-1/2',
          'bg-nc-surface-2 border border-nc-border rounded-nc-md p-6 shadow-nc-lg',
          'focus:outline-none',
          sizeClasses[size]
        ]"
      >
        <!-- Header -->
        <div v-if="title || $slots.header" class="mb-4">
          <slot name="header">
            <DialogTitle class="text-xl font-bold text-nc-ink font-display tracking-[-0.015em]">
              {{ title }}
            </DialogTitle>
            <DialogDescription v-if="description" class="mt-2 text-sm text-nc-text-secondary font-sans">
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
                 bg-transparent border-none cursor-pointer
                 text-nc-ink-soft hover:text-nc-ink hover:bg-nc-surface-3
                 nc-anim active:scale-97"
        >
          <span class="i-lucide-x text-lg" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
/* Modal motion (REDESIGN.md §5/§6): transform-origin center, single ease,
   enter scale(0.97)+opacity 200ms, exit faster (150ms). Global
   prefers-reduced-motion / html.reduce-motion rules zero these out. */
.nc-dialog-overlay[data-state='open'] {
  animation: nc-dialog-fade-in 200ms var(--nc-ease);
}
.nc-dialog-overlay[data-state='closed'] {
  animation: nc-dialog-fade-out 150ms var(--nc-ease) forwards;
}

.nc-dialog-content {
  transform-origin: center;
}
.nc-dialog-content[data-state='open'] {
  animation: nc-dialog-in 200ms var(--nc-ease);
}
.nc-dialog-content[data-state='closed'] {
  animation: nc-dialog-out 150ms var(--nc-ease) forwards;
}

@keyframes nc-dialog-fade-in {
  from { opacity: 0; }
}
@keyframes nc-dialog-fade-out {
  to { opacity: 0; }
}
@keyframes nc-dialog-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.97);
  }
}
@keyframes nc-dialog-out {
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.97);
  }
}
</style>
