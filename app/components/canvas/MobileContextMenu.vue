<script setup lang="ts">
import type { ContextMenuItem } from '~/components/ui/NcContextMenu.vue'

defineProps<{
  visible: boolean
  items: ContextMenuItem[]
  nodeName?: string
  nodeColor?: string
}>()

const emit = defineEmits<{
  close: []
  select: [item: ContextMenuItem]
}>()

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

  const height = sheetRef.value?.offsetHeight ?? 300
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
        class="fixed inset-x-0 bottom-0 z-modal bg-nc-bg rounded-t-2xl border-t border-nc-surface-3"
        :style="sheetStyle"
      >
        <!-- Drag handle -->
        <div
          class="flex items-center justify-center pt-3 pb-1 touch-none"
          @touchstart.passive="onDragStart"
          @touchmove.passive="onDragMove"
          @touchend="onDragEnd"
        >
          <div class="w-10 h-1 bg-nc-border-active rounded-full" />
        </div>

        <!-- Header (if node is selected) -->
        <div v-if="nodeName" class="flex items-center gap-2 px-4 pb-2 border-b border-nc-surface-2">
          <div
            v-if="nodeColor"
            class="w-3 h-3 rounded-full shrink-0"
            :style="{ backgroundColor: nodeColor }"
          />
          <span class="text-sm font-medium text-nc-ink truncate">{{ nodeName }}</span>
        </div>

        <!-- Menu items -->
        <div class="py-2" style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom))">
          <template v-for="(item, index) in items" :key="index">
            <div v-if="item.type === 'separator'" class="h-px bg-nc-surface-2 mx-4 my-1" />
            <button
              v-else
              :disabled="item.disabled"
              class="flex items-center gap-3 w-full px-4 py-3 text-left active:bg-nc-surface-2 transition-colors"
              :class="[
                item.disabled && 'opacity-40 pointer-events-none',
                item.danger && 'text-red-400'
              ]"
              @click="item.action?.(); emit('close')"
            >
              <span v-if="item.icon" :class="[item.icon, 'text-lg shrink-0']" />
              <span class="flex-1 text-sm" :class="item.danger ? 'text-red-400' : 'text-nc-ink'">
                {{ item.label }}
              </span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
