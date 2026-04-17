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
      <!-- Enter 125ms strong ease-out, exit 75ms instant — scale from 0.97 min -->
      <TooltipContent
        :side="side"
        :align="align"
        :side-offset="sideOffset"
        class="z-tooltip nc-glass-elevated rounded-nc-md px-3 py-1.5
               text-sm text-nc-text shadow-nc-lg
               animate-in fade-in-0 zoom-in-97 duration-[125ms]
               data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-97 data-[state=closed]:duration-[75ms]
               data-[side=bottom]:slide-in-from-top-1
               data-[side=left]:slide-in-from-right-1
               data-[side=right]:slide-in-from-left-1
               data-[side=top]:slide-in-from-bottom-1"
      >
        {{ content }}
        <TooltipArrow class="fill-nc-graphite" :width="10" :height="5" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
