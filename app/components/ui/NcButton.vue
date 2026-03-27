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
  primary: 'bg-nc-teal text-nc-charcoal hover:bg-nc-teal-hover hover:shadow-nc-glow hover:-translate-y-px active:scale-98',
  secondary: 'nc-glass text-nc-ink hover:border-nc-teal hover:text-nc-teal hover:shadow-nc-md active:scale-98',
  ghost: 'text-nc-ink-soft hover:text-nc-ink hover:bg-nc-graphite bg-transparent border-transparent',
  danger: 'bg-nc-error/10 text-nc-error border-nc-error/20 hover:bg-nc-error/20 hover:border-nc-error/40',
  ai: 'ai-gradient text-nc-charcoal font-semibold hover:brightness-110 hover:scale-102 active:scale-98 shadow-nc-glow',
  tool: `
    bg-gradient-to-b from-white/[0.02] to-transparent
    border border-nc-border
    text-nc-ink-muted
    shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]
    hover:bg-nc-surface-2
    hover:text-nc-ink
    hover:border-nc-border-active
    hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.3),0_0_24px_var(--nc-accent-glow)]
    hover:-translate-y-px
    active:scale-96 active:translate-y-0
    active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)]
    relative overflow-hidden
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
  'transition-all duration-250',
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
