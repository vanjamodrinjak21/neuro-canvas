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

// Node dot follows the user-chosen node color (data, not chrome) via v-bind
const dotColor = computed(() => props.node.style?.borderColor || 'var(--nc-border-active)')

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
    <span class="explorer-item__dot" />
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
  transition: background 150ms var(--nc-ease), color 150ms var(--nc-ease);
  text-align: left;
}

@media (hover: hover) and (pointer: fine) {
  .explorer-item:hover {
    background: var(--nc-chip-bg);
  }
}

/* Active row = accent tint + left marker (never color alone) */
.explorer-item--active {
  background: rgba(var(--nc-accent-rgb), 0.06);
  border-left: 2px solid var(--nc-accent);
  padding-left: 22px;
}

.explorer-item--active .explorer-item__label {
  color: var(--nc-text);
}

.explorer-item:active {
  cursor: grabbing;
  opacity: 0.8;
}

.explorer-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: v-bind(dotColor);
  flex-shrink: 0;
  transition: transform 150ms var(--nc-ease);
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
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  transition: color 150ms var(--nc-ease);
}

.explorer-item:hover .explorer-item__label {
  color: var(--nc-text);
}

.explorer-item__notes {
  font-family: var(--nc-font-body);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.explorer-item__count {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  padding: 1px 6px;
  border-radius: 0.4rem;
  flex-shrink: 0;
}
</style>
