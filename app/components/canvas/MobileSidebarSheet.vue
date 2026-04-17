<script setup lang="ts">
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import type { Node } from '~/types/canvas'
import type { SidebarAction } from '~/types/sidebar'

const props = defineProps<{
  visible: boolean
  selectedNode: Node | null
  isAILoading: boolean
  aiSuggestions: AISuggestion[]
  richSuggestions: RichNodeSuggestion[]
}>()

const emit = defineEmits<{
  action: [action: SidebarAction]
  close: []
}>()

// ─── Swipe-to-dismiss ──────────────────────────────────────────

const sheetRef = ref<HTMLElement | null>(null)
const translateY = ref(0)
const isDragging = ref(false)
const startY = ref(0)
const sheetHeight = ref(0)

const DISMISS_THRESHOLD = 0.3 // 30% of sheet height

function onDragStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch || !sheetRef.value) return
  isDragging.value = true
  startY.value = touch.clientY
  sheetHeight.value = sheetRef.value.offsetHeight
  translateY.value = 0
}

function onDragMove(e: TouchEvent) {
  if (!isDragging.value) return
  const touch = e.touches[0]
  if (!touch) return
  const delta = touch.clientY - startY.value
  // Only allow dragging downward
  translateY.value = Math.max(0, delta)
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  if (sheetHeight.value > 0 && translateY.value / sheetHeight.value > DISMISS_THRESHOLD) {
    // Dismiss — animate out
    translateY.value = sheetHeight.value
    setTimeout(() => {
      emit('close')
      translateY.value = 0
    }, 200)

    // Haptic feedback
    if (typeof window !== 'undefined' && 'Capacitor' in window) {
      import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
        Haptics.impact({ style: ImpactStyle.Light })
      }).catch(() => {})
    }
  } else {
    // Spring back
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
      enter-active-class="nc-scrim-enter"
      leave-active-class="nc-scrim-leave"
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
      enter-active-class="nc-sheet-enter"
      leave-active-class="nc-sheet-leave"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="visible"
        ref="sheetRef"
        class="fixed inset-x-0 bottom-0 z-modal bg-nc-bg rounded-t-2xl border-t border-nc-surface-3 max-h-[70vh] overflow-hidden"
        :style="sheetStyle"
      >
        <!-- Drag handle -->
        <div
          class="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          @touchstart.passive="onDragStart"
          @touchmove.passive="onDragMove"
          @touchend="onDragEnd"
        >
          <div class="w-10 h-1 bg-nc-border-active rounded-full" />
        </div>

        <!-- Content -->
        <div class="px-4 pb-4 overflow-y-auto" style="max-height: calc(70vh - 2rem); padding-bottom: max(1rem, env(safe-area-inset-bottom))">
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

<style scoped>
/* Scrim: 300ms enter, 200ms exit */
.nc-scrim-enter {
  transition: opacity 300ms var(--nc-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
}

.nc-scrim-leave {
  transition: opacity 200ms cubic-bezier(0.4, 0, 1, 1);
}

/* Sheet drawer: 300ms ease-drawer enter, 200ms exit */
.nc-sheet-enter {
  transition: transform 300ms var(--nc-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
}

.nc-sheet-leave {
  transition: transform 200ms cubic-bezier(0.4, 0, 1, 1);
}
</style>
