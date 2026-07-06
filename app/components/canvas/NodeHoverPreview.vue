<script setup lang="ts">
import type { Node } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  node: Node
  screenX: number
  screenY: number
}>()

const mapStore = useMapStore()

// Category color map — node-category DATA colors via tokens (REDESIGN.md §1);
// consumed as CSS custom-property values, never painted as hex chrome.
const DEFAULT_CATEGORY_COLOR = 'var(--nc-accent)'
const categoryColors: Record<string, string> = {
  default: DEFAULT_CATEGORY_COLOR,
  idea: 'var(--nc-node-purple)',
  task: 'var(--nc-node-blue)',
  note: 'var(--nc-node-green)',
  question: 'var(--nc-node-pink)'
}

const category = computed(() => {
  return (props.node.metadata?.category as string) || 'default'
})

const categoryColor = computed(() => {
  return props.node.style.borderColor || categoryColors[category.value] || DEFAULT_CATEGORY_COLOR
})

const categoryLabel = computed(() => {
  const cat = category.value
  return cat.charAt(0).toUpperCase() + cat.slice(1)
})

const description = computed(() => {
  const desc = props.node.metadata?.description as { summary?: string } | undefined
  return desc?.summary || null
})

const connectionCount = computed(() => {
  let count = 0
  for (const edge of mapStore.edges.values()) {
    if (edge.sourceId === props.node.id || edge.targetId === props.node.id) {
      count++
    }
  }
  return count
})

// Clamp position to stay within viewport — consumed via v-bind() in scoped
// CSS (no inline :style, REDESIGN.md §9)
const leftPx = computed(() => `${Math.max(120, Math.min(props.screenX, window.innerWidth - 120))}px`)
const topPx = computed(() => `${Math.max(8, props.screenY - 12)}px`)
</script>

<template>
  <div class="nc-hover-preview">
    <!-- Category badge — chip grammar, category color carried by the dot -->
    <span class="nc-hover-badge">
      <span class="nc-hover-badge-dot" />
      {{ categoryLabel }}
    </span>

    <!-- Description -->
    <p v-if="description" class="nc-hover-desc">
      {{ description }}
    </p>
    <p v-else class="nc-hover-desc nc-hover-desc-empty">
      {{ node.content }}
    </p>

    <!-- Connection count -->
    <span class="nc-hover-connections">
      <span class="i-lucide-git-branch text-[10px]" />
      {{ connectionCount }} connection{{ connectionCount !== 1 ? 's' : '' }}
    </span>
  </div>
</template>

<style scoped>
/* Floating tooltip-panel — flat surface-2 + hairline, no backdrop blur
   (REDESIGN.md §5); position clamped via v-bind from the script. */
.nc-hover-preview {
  position: fixed;
  left: v-bind(leftPx);
  top: v-bind(topPx);
  transform: translateX(-50%) translateY(-100%);
  z-index: 150;
  max-width: 220px;
  min-width: 140px;
  padding: 8px 10px;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Chip/badge grammar (REDESIGN.md §5): mono micro-label on chip fill,
   hairline, 0.4rem radius; category color carried by the dot (data color
   arrives as a token/value via v-bind, never hex chrome). */
.nc-hover-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 1px 6px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  align-self: flex-start;
  color: var(--nc-text-secondary);
}

.nc-hover-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: v-bind(categoryColor);
}

.nc-hover-desc {
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 1.4;
  color: var(--nc-text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nc-hover-desc-empty {
  color: var(--nc-text-muted);
  font-style: italic;
}

.nc-hover-connections {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}
</style>
