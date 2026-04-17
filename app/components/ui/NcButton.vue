<script setup lang="ts">
import { Primitive } from 'radix-vue'

export interface NcButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'tool'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  disabled?: boolean
  loading?: boolean
  as?: string
}

const props = withDefaults(defineProps<NcButtonProps>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  as: 'button'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClasses: Record<string, string> = {
  primary: 'bg-nc-teal text-nc-charcoal active:scale-97 nc-btn-primary-hover',
  secondary: 'nc-glass text-nc-ink active:scale-97 nc-btn-secondary-hover',
  ghost: 'text-nc-ink-soft bg-transparent border-transparent nc-btn-ghost-hover',
  danger: 'bg-nc-error/10 text-nc-error border-nc-error/20 nc-btn-danger-hover',
  ai: 'ai-gradient text-nc-charcoal font-semibold shadow-nc-glow active:scale-97 nc-btn-ai-hover',
  tool: `
    bg-gradient-to-b from-white/[0.02] to-transparent
    border border-nc-border
    text-nc-ink-muted
    shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
    active:scale-97 active:translate-y-0
    active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]
    relative overflow-hidden nc-btn-tool-hover
  `
}

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
  icon: 'p-2 aspect-square'
}

const buttonClass = computed(() => [
  // Base styles
  'inline-flex items-center justify-center',
  'font-medium rounded-nc-md',
  'border border-transparent',
  // Explicit properties only — never transition:all
  'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150',
  'cursor-pointer select-none',
  'font-sans',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nc-teal focus-visible:ring-offset-2 focus-visible:ring-offset-nc-charcoal',

  // Variant
  variantClasses[props.variant],

  // Size
  sizeClasses[props.size],

  // States
  props.disabled && 'opacity-40 grayscale-[0.3] cursor-not-allowed pointer-events-none',
  props.loading && 'opacity-70 cursor-wait'
])

function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<template>
  <Primitive
    :as="as"
    :class="buttonClass"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <span v-if="loading" class="i-lucide-loader-2 animate-spin" />

    <!-- Content -->
    <slot />
  </Primitive>
</template>

<style scoped>
/* Hover animations gated to pointer devices only */
@media (hover: hover) and (pointer: fine) {
  .nc-btn-primary-hover:hover {
    background-color: var(--nc-teal-dark);
    box-shadow: 0 0 32px rgba(0, 210, 190, 0.25);
    transform: translateY(-1px);
  }

  .nc-btn-secondary-hover:hover {
    border-color: var(--nc-teal);
    color: var(--nc-teal);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .nc-btn-ghost-hover:hover {
    color: var(--nc-ink);
    background-color: var(--nc-graphite);
  }

  .nc-btn-danger-hover:hover {
    background-color: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .nc-btn-ai-hover:hover {
    filter: brightness(1.1);
    transform: scale(1.02);
  }

  .nc-btn-tool-hover:hover {
    background-color: var(--nc-surface-2);
    color: var(--nc-ink);
    border-color: var(--nc-border-active);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 16px rgba(0, 0, 0, 0.3),
      0 0 24px var(--nc-accent-glow);
    transform: translateY(-1px);
  }
}
</style>
