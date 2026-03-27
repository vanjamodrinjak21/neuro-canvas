<script setup lang="ts">
import type { Node } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  node: Node
  screenX: number
  screenY: number
}>()

const mapStore = useMapStore()

// Category color map
const categoryColors: Record<string, string> = {
  default: '#00D2BE',
  idea: '#A78BFA',
  task: '#60A5FA',
  note: '#4ADE80',
  question: '#F472B6'
}

const category = computed(() => {
  return (props.node.metadata?.category as string) || 'default'
})

const categoryColor = computed(() => {
  return props.node.style.borderColor || categoryColors[category.value] || categoryColors.default
})

const categoryLabel = computed(() => {
  const cat = category.value
  return cat.charAt(0).toUpperCase() + cat.slice(1)
})

// Determine badge text color based on background color for contrast
const badgeTextColor = computed(() => {
  const color = categoryColor.value
  // Light backgrounds (yellow, green, orange) get dark text; dark backgrounds (purple, pink, blue) get white text
  const lightBgColors = ['#FACC15', '#4ADE80', '#FB923C']
  const darkBgColors = ['#A78BFA', '#F472B6', '#60A5FA']
  if (darkBgColors.includes(color)) return '#FFFFFF'
  if (lightBgColors.includes(color)) return '#0A0A0C'
  // Default: use dark text for the accent teal
  return '#0A0A0C'
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

// Clamp position to stay within viewport
const style = computed(() => ({
  position: 'fixed' as const,
  left: `${Math.max(120, Math.min(props.screenX, window.innerWidth - 120))}px`,
  top: `${Math.max(8, props.screenY - 12)}px`,
  transform: 'translateX(-50%) translateY(-100%)',
  zIndex: 150
}))
</script>

<template>
  <div class="nc-hover-preview" :style="style">
    <!-- Category badge -->
    <span class="nc-hover-badge" :style="{ background: categoryColor, color: badgeTextColor }">
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
.nc-hover-preview {
  max-width: 220px;
  min-width: 140px;
  padding: 8px 10px;
  background: rgba(18, 18, 24, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nc-hover-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  align-self: flex-start;
  letter-spacing: 0.02em;
}

.nc-hover-desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--nc-ink-soft, #AAAAB0);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nc-hover-desc-empty {
  color: var(--nc-ink-muted, #888890);
  font-style: italic;
}

.nc-hover-connections {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--nc-ink-muted, #888890);
}
</style>
