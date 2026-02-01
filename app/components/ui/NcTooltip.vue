<script setup lang="ts">
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipArrow
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
      <TooltipContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="z-tooltip nc-glass-elevated rounded-nc-md px-3 py-1.5
               text-sm text-nc-text shadow-nc-lg
               animate-in fade-in-0 zoom-in-95
               data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
               data-[side=bottom]:slide-in-from-top-2
               data-[side=left]:slide-in-from-right-2
               data-[side=right]:slide-in-from-left-2
               data-[side=top]:slide-in-from-bottom-2"
      >
        {{ content }}
        <TooltipArrow class="fill-nc-graphite" :width="10" :height="5" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
