<script setup lang="ts">
import type { Node } from '~/types'

/**
 * NodeExplorerItem — Single node row with description preview and child count
 */
const props = defineProps<{
  node: Node
  isActive: boolean
  childCount?: number
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

// Description from AI metadata or notes preview
const descriptionPreview = computed(() => {
  const desc = props.node.metadata?.description as { summary?: string } | undefined
  if (desc?.summary) return desc.summary.slice(0, 50)
  return notePreview.value
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
      <span v-if="descriptionPreview" class="explorer-item__notes">{{ descriptionPreview }}</span>
    </span>
    <span v-if="childCount !== undefined" class="explorer-item__count">{{ childCount }}</span>
  </button>
</template>

<style scoped>
.explorer-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px 7px 24px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: grab;
  transition: all 0.15s ease;
  text-align: left;
}

.explorer-item:hover {
  background: rgba(250, 250, 250, 0.03);
}

.explorer-item--active {
  background: rgba(0, 210, 190, 0.06);
  border-left: 2px solid #00D2BE;
  padding-left: 22px;
}

.explorer-item--active .explorer-item__label {
  color: #FAFAFA;
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
  transition: transform 0.15s ease;
}

.explorer-item:hover .explorer-item__dot {
  transform: scale(1.2);
}

.explorer-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.explorer-item__label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: #D4D4D8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  transition: color 0.15s ease;
}

.explorer-item:hover .explorer-item__label {
  color: #FAFAFA;
}

.explorer-item__notes {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  color: #3F3F46;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.explorer-item__count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #3F3F46;
  background: #18181B;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Light theme */
:root.light .explorer-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

:root.light .explorer-item__label {
  color: #3F3F46;
}

:root.light .explorer-item:hover .explorer-item__label {
  color: #18181B;
}

:root.light .explorer-item__notes {
  color: #A1A1AA;
}

:root.light .explorer-item__count {
  background: #F4F4F5;
  color: #A1A1AA;
}

:root.light .explorer-item--active {
  background: rgba(0, 210, 190, 0.06);
}

:root.light .explorer-item--active .explorer-item__label {
  color: #18181B;
}
</style>
