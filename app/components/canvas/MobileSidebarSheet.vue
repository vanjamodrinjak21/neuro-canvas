<script setup lang="ts">
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import type { Node } from '~/types/canvas'
import type { SidebarAction } from '~/types/sidebar'

defineProps<{
  visible: boolean
  selectedNode: Node | null
  isAILoading: boolean
  aiSuggestions: AISuggestion[]
  richSuggestions: RichNodeSuggestion[]
}>()

const emit = defineEmits<{
  action: [action: SidebarAction]
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-200"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="visible"
        class="fixed inset-x-0 bottom-0 z-modal bg-nc-bg rounded-t-2xl border-t border-nc-surface-3 max-h-[70vh] overflow-y-auto"
      >
        <div class="p-4">
          <div class="w-10 h-1 bg-nc-border-active rounded-full mx-auto mb-4" />
          <CanvasSidebarShell
            :selected-node="selectedNode"
            :is-a-i-loading="isAILoading"
            :ai-suggestions="aiSuggestions"
            :rich-suggestions="richSuggestions"
            class="!w-full !border-none !min-h-0"
            @action="emit('action', $event)"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
