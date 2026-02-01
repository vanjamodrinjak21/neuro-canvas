<script setup lang="ts">
export interface NcCardProps {
  elevated?: boolean
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<NcCardProps>(), {
  elevated: false,
  interactive: false,
  padding: 'md'
})

const paddingClasses: Record<string, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6'
}

const cardClass = computed(() => [
  // Base glass effect
  props.elevated ? 'nc-glass-elevated' : 'nc-glass',

  // Border radius
  'rounded-nc-xl',

  // Padding
  paddingClasses[props.padding],

  // Shadow
  props.elevated ? 'shadow-nc-lg' : 'shadow-nc-md',

  // Interactive hover effect
  props.interactive && [
    'cursor-pointer',
    'transition-all duration-200',
    'hover:border-[rgba(0,210,190,0.3)]',
    'hover:shadow-nc-glow',
    'hover:-translate-y-0.5',
    'active:translate-y-0'
  ]
])
</script>

<template>
  <div :class="cardClass">
    <slot />
  </div>
</template>
