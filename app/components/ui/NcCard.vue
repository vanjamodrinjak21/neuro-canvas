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

  // Interactive hover effect — specific properties only, hover gated to pointer devices via style block
  props.interactive && [
    'cursor-pointer',
    'transition-[border-color,box-shadow,transform] duration-150',
    'nc-card-interactive',
    'active:translate-y-0 active:scale-97'
  ]
])
</script>

<template>
  <div :class="cardClass">
    <slot />
  </div>
</template>

<style scoped>
@media (hover: hover) and (pointer: fine) {
  .nc-card-interactive:hover {
    border-color: rgba(0, 210, 190, 0.3);
    box-shadow: 0 0 32px rgba(0, 210, 190, 0.25);
    transform: translateY(-2px);
  }
}
</style>
