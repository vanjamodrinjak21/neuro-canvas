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

// Flat surface + 1px hairline, radius ≤ 0.5rem (REDESIGN.md §5).
// Interactive hover = border-color shift only — no lift, no glow.
const cardClass = computed(() => [
  props.elevated ? 'bg-nc-surface-2' : 'bg-nc-surface',
  'border border-nc-border rounded-nc-md',

  // Padding
  paddingClasses[props.padding],

  // Interactive: border-color shift on hover (gated in style block), press feedback
  props.interactive && [
    'cursor-pointer',
    'nc-anim',
    'nc-card-interactive',
    'active:scale-97'
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
    border-color: var(--nc-text-secondary);
  }
}
</style>
