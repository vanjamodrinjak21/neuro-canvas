<script setup lang="ts">
import type { Camera } from '~/types'
import { useMapStore } from '~/stores/mapStore'

export interface MinimapProps {
  camera: Camera
  width?: number
  height?: number
}

const props = withDefaults(defineProps<MinimapProps>(), {
  width: 180,
  height: 120
})

const emit = defineEmits<{
  'update:camera': [camera: Camera]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const mapStore = useMapStore()

// Infinite Canvas color palette
const colors = {
  bg: 'rgba(12, 12, 18, 0.95)',           // Surface glass
  node: '#00D2BE',                         // Petronas Teal nodes
  edge: 'rgba(37, 37, 48, 0.6)',          // Border edges
  viewport: '#00D2BE',                     // Teal viewport
  viewportFill: 'rgba(0, 210, 190, 0.12)' // Accent glow fill
}

// Calculate content bounds
const contentBounds = computed(() => {
  if (mapStore.nodes.size === 0) {
    return { minX: -500, minY: -500, maxX: 500, maxY: 500 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of mapStore.nodes.values()) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + node.size.width)
    maxY = Math.max(maxY, node.position.y + node.size.height)
  }

  // Add padding
  const padding = 100
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding
  }
})

// Scale factor to fit content in minimap
const scale = computed(() => {
  const contentWidth = contentBounds.value.maxX - contentBounds.value.minX
  const contentHeight = contentBounds.value.maxY - contentBounds.value.minY
  return Math.min(props.width / contentWidth, props.height / contentHeight)
})

// Viewport rectangle in minimap coordinates
const viewportRect = computed(() => {
  const viewportWidth = window.innerWidth / props.camera.zoom
  const viewportHeight = window.innerHeight / props.camera.zoom
  const viewportX = -props.camera.x / props.camera.zoom
  const viewportY = -props.camera.y / props.camera.zoom

  return {
    x: (viewportX - contentBounds.value.minX) * scale.value,
    y: (viewportY - contentBounds.value.minY) * scale.value,
    width: viewportWidth * scale.value,
    height: viewportHeight * scale.value
  }
})

// Render minimap
function render() {
  if (!canvasRef.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = props.width * dpr
  canvasRef.value.height = props.height * dpr
  ctx.scale(dpr, dpr)

  // Clear with cream glass background
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, props.width, props.height)

  // Draw nodes (sepia)
  ctx.fillStyle = colors.node
  for (const node of mapStore.nodes.values()) {
    const x = (node.position.x - contentBounds.value.minX) * scale.value
    const y = (node.position.y - contentBounds.value.minY) * scale.value
    const w = Math.max(node.size.width * scale.value, 2)
    const h = Math.max(node.size.height * scale.value, 2)

    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 2)
    ctx.fill()
  }

  // Draw edges (teal)
  ctx.strokeStyle = colors.edge
  ctx.lineWidth = 1
  for (const edge of mapStore.edges.values()) {
    const sourceNode = mapStore.nodes.get(edge.sourceId)
    const targetNode = mapStore.nodes.get(edge.targetId)
    if (!sourceNode || !targetNode) continue

    const x1 = (sourceNode.position.x + sourceNode.size.width / 2 - contentBounds.value.minX) * scale.value
    const y1 = (sourceNode.position.y + sourceNode.size.height / 2 - contentBounds.value.minY) * scale.value
    const x2 = (targetNode.position.x + targetNode.size.width / 2 - contentBounds.value.minX) * scale.value
    const y2 = (targetNode.position.y + targetNode.size.height / 2 - contentBounds.value.minY) * scale.value

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Draw viewport rectangle (sepia)
  ctx.strokeStyle = colors.viewport
  ctx.lineWidth = 2
  ctx.strokeRect(
    viewportRect.value.x,
    viewportRect.value.y,
    viewportRect.value.width,
    viewportRect.value.height
  )

  // Fill viewport with semi-transparent sepia
  ctx.fillStyle = colors.viewportFill
  ctx.fillRect(
    viewportRect.value.x,
    viewportRect.value.y,
    viewportRect.value.width,
    viewportRect.value.height
  )
}

// Watch for changes and re-render
watch([() => props.camera, () => mapStore.nodes.size, () => mapStore.edges.size], () => {
  requestAnimationFrame(render)
}, { deep: true })

onMounted(() => {
  requestAnimationFrame(render)
})

// Click to navigate
function handleClick(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top

  // Convert minimap coordinates to world coordinates
  const worldX = clickX / scale.value + contentBounds.value.minX
  const worldY = clickY / scale.value + contentBounds.value.minY

  // Center viewport on clicked position
  const viewportWidth = window.innerWidth / props.camera.zoom
  const viewportHeight = window.innerHeight / props.camera.zoom

  emit('update:camera', {
    ...props.camera,
    x: -(worldX - viewportWidth / 2) * props.camera.zoom,
    y: -(worldY - viewportHeight / 2) * props.camera.zoom
  })
}

// Drag to pan
const isDragging = ref(false)

function handleMouseDown(event: MouseEvent) {
  isDragging.value = true
  handleClick(event)
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value) return
  handleClick(event)
}

function handleMouseUp() {
  isDragging.value = false
}
</script>

<template>
  <div
    class="nc-glass-elevated rounded-nc-lg overflow-hidden cursor-pointer shadow-nc-lg"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <canvas
      ref="canvasRef"
      :width="width"
      :height="height"
      :style="{ width: `${width}px`, height: `${height}px` }"
    />
  </div>
</template>
