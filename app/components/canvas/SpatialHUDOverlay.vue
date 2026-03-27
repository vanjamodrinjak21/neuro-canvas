<script setup lang="ts">
import type { Camera, Node, MapRegion } from '~/types/canvas'

const props = defineProps<{
  camera: Camera
  nodes: Map<string, Node>
  visibleCount: number
  regions: MapRegion[]
  rootNodeId?: string
  isEditingTitle: boolean
}>()

// Visibility: >3 nodes, not editing title, camera recently moved
const cameraMovedRecently = ref(false)
let cameraDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => [props.camera.x, props.camera.y, props.camera.zoom], () => {
  cameraMovedRecently.value = true
  if (cameraDebounceTimer) clearTimeout(cameraDebounceTimer)
  cameraDebounceTimer = setTimeout(() => {
    cameraMovedRecently.value = false
  }, 2000)
}, { deep: false })

onUnmounted(() => {
  if (cameraDebounceTimer) clearTimeout(cameraDebounceTimer)
})

const isVisible = computed(() => {
  return props.nodes.size > 3 && !props.isEditingTitle && cameraMovedRecently.value
})

// Compute HUD data
const regionName = computed(() => {
  if (props.regions.length === 0) return null
  const viewCenterX = -props.camera.x / props.camera.zoom + window.innerWidth / props.camera.zoom / 2
  const viewCenterY = -props.camera.y / props.camera.zoom + window.innerHeight / props.camera.zoom / 2

  let name: string | null = null
  let minDist = Infinity

  for (const region of props.regions) {
    const dx = viewCenterX - region.centerX
    const dy = viewCenterY - region.centerY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist && dist < 500) {
      minDist = dist
      name = region.label
    }
  }
  return name
})

const zoomPercent = computed(() => Math.round(props.camera.zoom * 100))

const distanceLabel = computed(() => {
  if (!props.rootNodeId) return null
  const root = props.nodes.get(props.rootNodeId)
  if (!root) return null

  const viewCenterX = -props.camera.x / props.camera.zoom + window.innerWidth / props.camera.zoom / 2
  const viewCenterY = -props.camera.y / props.camera.zoom + window.innerHeight / props.camera.zoom / 2
  const dx = viewCenterX - (root.position.x + root.size.width / 2)
  const dy = viewCenterY - (root.position.y + root.size.height / 2)
  const dist = Math.round(Math.sqrt(dx * dx + dy * dy))

  if (dist < 200) return 'Near root'
  return 'Far from root'
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    leave-active-class="transition-all duration-150 ease-in"
    enter-from-class="opacity-0 translate-y-2"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div v-if="isVisible" class="nc-spatial-hud">
      <div v-if="regionName" class="nc-hud-region">{{ regionName }}</div>
      <div class="nc-hud-stats">
        <span>{{ visibleCount }}/{{ nodes.size }} nodes</span>
        <span class="nc-hud-sep">&middot;</span>
        <span>{{ zoomPercent }}%</span>
      </div>
      <div v-if="distanceLabel" class="nc-hud-distance">{{ distanceLabel }}</div>
    </div>
  </Transition>
</template>

<style scoped>
.nc-spatial-hud {
  position: absolute;
  bottom: 80px;
  left: 16px;
  z-index: 90;
  padding: 6px 10px;
  background: rgba(18, 18, 24, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 100px;
}

.nc-hud-region {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-accent, #00D2BE);
  letter-spacing: 0.02em;
}

.nc-hud-stats {
  font-size: 11px;
  color: var(--nc-ink-soft);
  display: flex;
  align-items: center;
  gap: 4px;
}

.nc-hud-sep {
  opacity: 0.4;
}

.nc-hud-distance {
  font-size: 11px;
  color: var(--nc-ink-soft);
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .nc-spatial-hud {
    transition: none;
  }
}

@media (max-width: 767px) {
  .nc-spatial-hud {
    display: none;
  }
}
</style>
