<script setup lang="ts">
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent
} from 'radix-vue'

export interface NcTooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
  sideOffset?: number
}

withDefaults(defineProps<NcTooltipProps>(), {
  side: 'top',
  align: 'center',
  // 300ms first hover; Radix's TooltipProvider skipDelayDuration handles instant-skip on subsequent
  delayDuration: 300,
  sideOffset: 8
})
</script>

<template>
  <TooltipRoot :delay-duration="delayDuration">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>

    <TooltipPortal>
      <!-- data-tip grammar (REDESIGN.md §5): flat bg, hairline, mono micro type -->
      <TooltipContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="nc-tooltip-content px-2.5 py-1.5"
      >
        {{ content }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.nc-tooltip-content {
  z-index: var(--nc-z-toast);
  max-width: 280px;
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.35rem;
  color: var(--nc-text);
  font-family: var(--nc-font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  line-height: 1.5;
  transform-origin: var(--radix-tooltip-content-transform-origin);
}

/* Enter 150ms / exit 100ms, scale(0.97)+opacity, single ease (REDESIGN.md §6) */
.nc-tooltip-content[data-state='delayed-open'],
.nc-tooltip-content[data-state='instant-open'] {
  animation: nc-tip-in 150ms var(--nc-ease);
}
.nc-tooltip-content[data-state='closed'] {
  animation: nc-tip-out 100ms var(--nc-ease) forwards;
}

@keyframes nc-tip-in {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}
@keyframes nc-tip-out {
  to {
    opacity: 0;
    transform: scale(0.97);
  }
}
</style>
