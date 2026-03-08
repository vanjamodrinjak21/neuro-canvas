<script setup lang="ts">
import type { Node } from '~/types'

/**
 * NodeExplorerItem — Single node row in the explorer list
 * Improved readability: larger text, color indicator, notes preview
 */
const props = defineProps<{
  node: Node
  isActive: boolean
}>()

const emit = defineEmits<{
  select: [nodeId: string]
  dragStart: [event: DragEvent, nodeId: string]
}>()

const nodeLabel = computed(() => props.node.content || 'Untitled')
const notePreview = computed(() => {
  const notes = props.node.metadata?.notes as string | undefined
  return notes ? notes.slice(0, 60) : ''
})

function handleDragStart(event: DragEvent) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'node',
    nodeId: props.node.id,
  }))
  event.dataTransfer.effectAllowed = 'move'
  emit('dragStart', event, props.node.id)
}
</script>

<template>
  <button
    :class="['explorer-item', isActive && 'explorer-item--active']"
    draggable="true"
    @click="emit('select', node.id)"
    @dragstart="handleDragStart"
  >
    <span
      class="explorer-item__dot"
      :style="{ backgroundColor: node.style?.borderColor || 'var(--nc-border-active)' }"
    />
    <span class="explorer-item__content">
      <span class="explorer-item__label">{{ nodeLabel }}</span>
      <span v-if="notePreview" class="explorer-item__notes">{{ notePreview }}</span>
    </span>
  </button>
</template>

<style scoped>
.explorer-item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 10px;
  margin-left: 8px;
  width: calc(100% - 8px);
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  cursor: grab;
  transition: all 0.15s ease;
  text-align: left;
}

.explorer-item:hover {
  background: var(--nc-surface-3);
  border-color: var(--nc-border);
}

.explorer-item--active {
  background: var(--nc-accent-glow);
  border-color: rgba(0, 210, 190, 0.15);
}

.explorer-item--active .explorer-item__label {
  color: var(--nc-accent);
}

.explorer-item:active {
  cursor: grabbing;
  opacity: 0.8;
}

.explorer-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  transition: transform 0.15s ease;
  box-shadow: 0 0 0 0 transparent;
}

.explorer-item:hover .explorer-item__dot {
  transform: scale(1.2);
  box-shadow: 0 0 6px currentColor;
}

.explorer-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.explorer-item__label {
  font-size: 12px;
  font-weight: 450;
  color: var(--nc-ink-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  transition: color 0.15s ease;
}

.explorer-item:hover .explorer-item__label {
  color: var(--nc-ink);
}

.explorer-item__notes {
  font-size: 10px;
  color: var(--nc-ink-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
</style>
