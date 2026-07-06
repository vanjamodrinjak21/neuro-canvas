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

// Component grammar per design/REDESIGN.md §5:
// primary/ai = ink/accent pill; secondary/ghost = mono uppercase underline-grow
// text link; danger = calm coral border/text; tool = flat chip for toolbars.
const variantClasses: Record<string, string> = {
  primary: 'nc-btn-primary-v rounded-[2.4rem] bg-nc-ink text-nc-bg font-display font-bold',
  secondary: 'nc-btn-ghost-v font-mono uppercase tracking-[0.1em] font-medium text-nc-text-secondary bg-transparent',
  ghost: 'nc-btn-ghost-v font-mono uppercase tracking-[0.1em] font-medium text-nc-text-secondary bg-transparent',
  danger: 'nc-btn-danger-v rounded-nc-md font-sans font-medium bg-nc-chip text-nc-coral border-nc-coral/45',
  ai: 'nc-btn-ai-v rounded-[2.4rem] bg-nc-accent text-nc-bg font-display font-bold',
  tool: 'nc-btn-tool-v rounded-nc-md font-sans font-medium bg-transparent border-nc-border text-nc-ink-muted'
}

const sizeClasses: Record<string, string> = {
  sm: 'px-3.5 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2 text-base gap-2',
  lg: 'px-7 py-3 text-lg gap-2.5',
  icon: 'p-2 aspect-square'
}

const buttonClass = computed(() => [
  // Base styles — transitions via nc-anim (explicit properties, single ease)
  'inline-flex items-center justify-center',
  'border border-transparent',
  'nc-anim',
  'cursor-pointer select-none',
  'active:scale-97',

  // Variant
  variantClasses[props.variant],

  // Size
  sizeClasses[props.size],

  // States — disabled: opacity .45, no transform (pointer-events off)
  props.disabled && 'opacity-45 cursor-not-allowed pointer-events-none',
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
/* Ghost / secondary — mono uppercase text link with underline-grow.
   The underline rests at scaleX(0.35), origin-left, and grows on hover. */
.nc-btn-ghost-v {
  position: relative;
  font-size: 0.78rem;
}

.nc-btn-ghost-v::after {
  content: '';
  position: absolute;
  left: 0.9em;
  right: 0.9em;
  bottom: 0.3em;
  height: 1px;
  background: currentColor;
  transform: scaleX(0.35);
  transform-origin: left;
  transition: transform 0.45s var(--nc-ease);
}

/* Hover effects gated to pointer devices (REDESIGN.md §6) */
@media (hover: hover) and (pointer: fine) {
  /* Primary ink pill — hover flips to accent, lifts 1px. No glow in chrome. */
  .nc-btn-primary-v:hover {
    background-color: var(--nc-accent);
    transform: translateY(-1px);
  }

  .nc-btn-ai-v:hover {
    background-color: var(--nc-accent-light);
    transform: translateY(-1px);
  }

  .nc-btn-ghost-v:hover {
    color: var(--nc-accent);
  }

  .nc-btn-ghost-v:hover::after {
    transform: scaleX(1);
  }

  /* Danger — coral border/text logic, kept calm. */
  .nc-btn-danger-v:hover {
    border-color: var(--nc-coral);
    background-color: rgba(var(--nc-coral-rgb), 0.08);
  }

  /* Tool — flat chip; hover brightens text + border, no movement. */
  .nc-btn-tool-v:hover {
    background-color: var(--nc-surface-2);
    color: var(--nc-ink);
    border-color: var(--nc-border-active);
  }
}
</style>
