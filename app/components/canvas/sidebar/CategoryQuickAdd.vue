<script setup lang="ts">
import { nodeCategories, type NodeCategory } from '~/composables/useSidebarState'

/**
 * CategoryQuickAdd — Draggable category button row with tooltips
 * Each button creates a new node of that category or can be dragged to canvas
 */
const emit = defineEmits<{
  addCategory: [category: NodeCategory]
  dragStartCategory: [category: NodeCategory]
}>()

function handleDragStart(event: DragEvent, category: NodeCategory) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'category',
    category,
  }))
  event.dataTransfer.effectAllowed = 'copy'
  emit('dragStartCategory', category)
}
</script>

<template>
  <div class="category-row">
    <NcTooltip
      v-for="cat in nodeCategories"
      :key="cat.id"
      :content="cat.label"
      side="bottom"
      :delay-duration="200"
    >
      <button
        class="category-btn"
        :style="{
          '--cat-color': cat.color,
          '--cat-glow': `${cat.color}20`,
        }"
        draggable="true"
        @click="emit('addCategory', cat)"
        @dragstart="handleDragStart($event, cat)"
      >
        <span :class="cat.icon" class="category-btn__icon" />
      </button>
    </NcTooltip>
  </div>
</template>

<style scoped>
.category-row {
  display: flex;
  gap: 6px;
  padding: 0 12px 10px;
}

.category-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
}

.category-btn::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 2px;
  background: var(--cat-color);
  border-radius: 1px;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.category-btn:hover {
  background: var(--cat-glow);
  border-color: var(--cat-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px var(--cat-glow);
}

.category-btn:hover::after {
  width: 18px;
  opacity: 1;
}

.category-btn:active {
  transform: scale(0.95);
  cursor: grabbing;
}

.category-btn__icon {
  font-size: 15px;
  color: var(--cat-color);
  transition: transform 0.2s ease;
}

.category-btn:hover .category-btn__icon {
  transform: scale(1.1);
}
</style>
