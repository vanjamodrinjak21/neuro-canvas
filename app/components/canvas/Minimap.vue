<script setup lang="ts">
import type { Camera, MapRegion, NavigationBreadcrumb } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'

export interface MinimapProps {
  camera: Camera
  width?: number
  height?: number
  containerWidth?: number
  containerHeight?: number
  regions?: MapRegion[]
  breadcrumbs?: NavigationBreadcrumb[]
}

const props = withDefaults(defineProps<MinimapProps>(), {
  width: 200,
  height: 140,
  containerWidth: 0,
  containerHeight: 0,
  regions: () => [],
  breadcrumbs: () => []
})

const emit = defineEmits<{
  'update:camera': [camera: Camera]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const mapStore = useMapStore()
const isHovered = ref(false)

// Expanded size on hover
const displayWidth = computed(() => isHovered.value ? 280 : props.width)
const displayHeight = computed(() => isHovered.value ? Math.round(280 * props.height / props.width) : props.height)

// Category color map for color-coding
const categoryColors: Record<string, string> = {
  default: '#00D2BE',
  idea: '#A78BFA',
  task: '#60A5FA',
  note: '#4ADE80',
  question: '#F472B6'
}

// Infinite Canvas color palette
const colors = {
  bg: 'rgba(12, 12, 18, 0.95)',
  node: '#00D2BE',
  nodeSelected: '#00FFE0',
  root: '#FAFAFA',
  edge: 'rgba(37, 37, 48, 0.6)',
  viewport: '#00D2BE',
  viewportFill: 'rgba(0, 210, 190, 0.12)',
  regionLabel: 'rgba(250, 250, 250, 0.4)',
  breadcrumb: 'rgba(0, 210, 190, 0.3)'
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
  return Math.min(displayWidth.value / contentWidth, displayHeight.value / contentHeight)
})

// Viewport rectangle in minimap coordinates
const viewportRect = computed(() => {
  const viewportWidth = (props.containerWidth || window.innerWidth) / props.camera.zoom
  const viewportHeight = (props.containerHeight || window.innerHeight) / props.camera.zoom
  const viewportX = -props.camera.x / props.camera.zoom
  const viewportY = -props.camera.y / props.camera.zoom

  return {
    x: (viewportX - contentBounds.value.minX) * scale.value,
    y: (viewportY - contentBounds.value.minY) * scale.value,
    width: viewportWidth * scale.value,
    height: viewportHeight * scale.value
  }
})

// Throttled render at 20fps
let renderScheduled = false
let lastRenderTime = 0
const RENDER_INTERVAL = 50 // 20fps

function scheduleRender() {
  if (renderScheduled) return
  renderScheduled = true
  const now = performance.now()
  const wait = Math.max(0, RENDER_INTERVAL - (now - lastRenderTime))
  setTimeout(() => {
    renderScheduled = false
    lastRenderTime = performance.now()
    render()
  }, wait)
}

// Render minimap
function render() {
  if (!canvasRef.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const w = displayWidth.value
  const h = displayHeight.value
  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = `${w}px`
  canvasRef.value.style.height = `${h}px`
  ctx.scale(dpr, dpr)

  // Clear
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, w, h)

  // Draw region labels at 50% opacity
  if (props.regions.length > 0) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.font = '8px "Inter", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.regionLabel
    for (const region of props.regions) {
      const rx = (region.centerX - contentBounds.value.minX) * scale.value
      const ry = (region.centerY - contentBounds.value.minY) * scale.value
      ctx.fillText(region.label, rx, ry)
    }
    ctx.restore()
  }

  // Draw breadcrumb trail
  if (props.breadcrumbs.length > 1) {
    ctx.save()
    ctx.setLineDash([2, 2])
    ctx.strokeStyle = colors.breadcrumb
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < props.breadcrumbs.length; i++) {
      const crumb = props.breadcrumbs[i]!
      const cx = (-crumb.x / crumb.zoom - contentBounds.value.minX) * scale.value
      const cy = (-crumb.y / crumb.zoom - contentBounds.value.minY) * scale.value
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Draw crumb dots (fade by age)
    const now = Date.now()
    for (let i = 0; i < props.breadcrumbs.length; i++) {
      const crumb = props.breadcrumbs[i]!
      const age = (now - crumb.timestamp) / 1000
      const opacity = Math.max(0.2, 1 - age / 60)
      const cx = (-crumb.x / crumb.zoom - contentBounds.value.minX) * scale.value
      const cy = (-crumb.y / crumb.zoom - contentBounds.value.minY) * scale.value
      ctx.globalAlpha = opacity
      ctx.fillStyle = colors.viewport
      ctx.beginPath()
      ctx.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Draw edges
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

  // Draw nodes — color-coded by category
  for (const node of mapStore.nodes.values()) {
    const x = (node.position.x - contentBounds.value.minX) * scale.value
    const y = (node.position.y - contentBounds.value.minY) * scale.value
    const nw = Math.max(node.size.width * scale.value, 3)
    const nh = Math.max(node.size.height * scale.value, 3)

    const isSelected = mapStore.selection.nodeIds.has(node.id)
    const isRoot = node.isRoot || node.id === mapStore.rootNodeId
    const category = (node.metadata?.category as string) || 'default'

    // Color by category or border color
    let nodeColor = node.style.borderColor || categoryColors[category] || colors.node
    if (isSelected) nodeColor = colors.nodeSelected

    ctx.fillStyle = nodeColor
    ctx.beginPath()
    ctx.roundRect(x, y, nw, nh, 1)
    ctx.fill()

    // Selected nodes: brighter with glow
    if (isSelected) {
      ctx.shadowColor = nodeColor
      ctx.shadowBlur = 4
      ctx.strokeStyle = nodeColor
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    // Root node: ring
    if (isRoot) {
      ctx.strokeStyle = colors.root
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(x - 1, y - 1, nw + 2, nh + 2, 2)
      ctx.stroke()
    }
  }

  // Draw viewport rectangle
  ctx.strokeStyle = colors.viewport
  ctx.lineWidth = 1.5
  ctx.strokeRect(
    viewportRect.value.x,
    viewportRect.value.y,
    viewportRect.value.width,
    viewportRect.value.height
  )

  ctx.fillStyle = colors.viewportFill
  ctx.fillRect(
    viewportRect.value.x,
    viewportRect.value.y,
    viewportRect.value.width,
    viewportRect.value.height
  )
}

// Watch for changes and re-render (throttled)
watch([() => props.camera, () => mapStore.nodesVersion, () => mapStore.nodes.size, () => mapStore.edges.size, () => props.regions, () => props.breadcrumbs], () => {
  scheduleRender()
}, { deep: false })

watch([displayWidth, displayHeight], () => {
  scheduleRender()
})

onMounted(() => {
  scheduleRender()
})

// Click to navigate (emits camera for spring nav)
function handleClick(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top

  const worldX = clickX / scale.value + contentBounds.value.minX
  const worldY = clickY / scale.value + contentBounds.value.minY

  const viewportWidth = (props.containerWidth || window.innerWidth) / props.camera.zoom
  const viewportHeight = (props.containerHeight || window.innerHeight) / props.camera.zoom

  emit('update:camera', {
    ...props.camera,
    x: -(worldX - viewportWidth / 2) * props.camera.zoom,
    y: -(worldY - viewportHeight / 2) * props.camera.zoom
  })
}

// Drag to pan
const isDragging = ref(false)

function handlePointerDown(event: PointerEvent) {
  isDragging.value = true
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  handleClick(event)
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value) return
  handleClick(event)
}

function handlePointerUp() {
  isDragging.value = false
}
</script>

<template>
  <div
    class="nc-minimap nc-glass-elevated rounded-nc-lg overflow-hidden cursor-pointer shadow-nc-lg"
    :style="{ width: `${displayWidth}px`, height: `${displayHeight}px` }"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointerleave="handlePointerUp"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <canvas
      ref="canvasRef"
      :style="{ width: `${displayWidth}px`, height: `${displayHeight}px` }"
    />
  </div>
</template>

<style scoped>
.nc-minimap {
  transition: width 0.2s ease, height 0.2s ease;
}
</style>
