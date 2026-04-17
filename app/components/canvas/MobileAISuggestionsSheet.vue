<script setup lang="ts">
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import type { Node } from '~/types/canvas'
import type { SidebarAction } from '~/types/sidebar'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'

const props = defineProps<{
  visible: boolean
  selectedNode: Node | null
  isAILoading: boolean
  aiSuggestions: AISuggestion[]
  richSuggestions: RichNodeSuggestion[]
}>()

const emit = defineEmits<{
  close: []
  action: [action: SidebarAction]
}>()

// Provide dispatch for child components
provide(SIDEBAR_DISPATCH_KEY, (action: SidebarAction) => {
  emit('action', action)
})

// ─── Swipe-to-dismiss ──────────────────────────────────────────

const sheetRef = ref<HTMLElement | null>(null)
const translateY = ref(0)
const isDragging = ref(false)
const startY = ref(0)

function onDragStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  isDragging.value = true
  startY.value = touch.clientY
  translateY.value = 0
}

function onDragMove(e: TouchEvent) {
  if (!isDragging.value) return
  const touch = e.touches[0]
  if (!touch) return
  translateY.value = Math.max(0, touch.clientY - startY.value)
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  const height = sheetRef.value?.offsetHeight ?? 400
  if (translateY.value / height > 0.3) {
    translateY.value = height
    setTimeout(() => {
      emit('close')
      translateY.value = 0
    }, 200)
  } else {
    translateY.value = 0
  }
}

const sheetStyle = computed(() => ({
  transform: translateY.value > 0 ? `translateY(${translateY.value}px)` : undefined,
  transition: isDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'
}))
</script>

<template>
  <Teleport to="body">
    <!-- Scrim -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal bg-black/50"
        @click="emit('close')"
      />
    </Transition>

    <!-- Sheet -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="visible"
        ref="sheetRef"
        class="fixed inset-x-0 bottom-0 z-modal bg-nc-bg rounded-t-2xl border-t border-nc-surface-3 max-h-[70vh] overflow-hidden"
        :style="sheetStyle"
      >
        <!-- Drag handle + header -->
        <div
          class="flex flex-col items-center pt-3 pb-2 border-b border-nc-surface-2 touch-none sticky top-0 bg-nc-bg z-10"
          @touchstart.passive="onDragStart"
          @touchmove.passive="onDragMove"
          @touchend="onDragEnd"
        >
          <div class="w-10 h-1 bg-nc-border-active rounded-full mb-2" />
          <div class="flex items-center justify-between w-full px-4">
            <div class="flex items-center gap-2">
              <span class="i-lucide-sparkles text-lg text-nc-accent" />
              <span class="text-sm font-semibold text-nc-ink">AI Suggestions</span>
              <span
                v-if="isAILoading"
                class="w-4 h-4 border-2 border-nc-accent border-t-transparent rounded-full animate-spin"
              />
            </div>
            <button
              class="p-1 rounded hover:bg-nc-surface-2 text-nc-ink-muted"
              @click="emit('close')"
            >
              <span class="i-lucide-x text-lg" />
            </button>
          </div>
        </div>

        <!-- AI Suggestions content -->
        <div
          class="overflow-y-auto"
          style="max-height: calc(70vh - 3rem); padding-bottom: max(1rem, env(safe-area-inset-bottom))"
        >
          <CanvasSidebarAISuggestionsPanel
            :selected-node="selectedNode"
            :is-a-i-loading="isAILoading"
            :ai-suggestions="aiSuggestions"
            :rich-suggestions="richSuggestions"
            class="!border-none !min-h-0"
            @action="emit('action', $event)"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
