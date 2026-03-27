<script setup lang="ts">
import type { Camera, MapRegion, NavigationBreadcrumb } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'

export interface MinimapProps {
  camera: Camera
  width?: number
  height?: number
  containerWidth?: number
  containerHeight?: number
  collapsed?: boolean
  regions?: MapRegion[]
  breadcrumbs?: NavigationBreadcrumb[]
}

const props = withDefaults(defineProps<MinimapProps>(), {
  width: 220,
  height: 156,
  containerWidth: 0,
  containerHeight: 0,
  regions: () => [],
  breadcrumbs: () => []
})

const emit = defineEmits<{
  'update:camera': [camera: Camera]
  'update:collapsed': [value: boolean]
  'fit-all': []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const mapStore = useMapStore()
const isHovered = ref(false)

// Support v-model:collapsed with local fallback
const _localCollapsed = ref(false)
const isCollapsed = computed({
  get: () => props.collapsed ?? _localCollapsed.value,
  set: (val: boolean) => {
    _localCollapsed.value = val
    emit('update:collapsed', val)
  }
})

// Fixed size — no hover expansion per Paper design
const canvasWidth = computed(() => props.width - 14) // 6px margin each side + 1px border each side
const canvasHeight = computed(() => {
  // Header ~28px + 6px bottom margin
  return props.height - 34
})

// Category color map for color-coding
const categoryColors: Record<string, string> = {
  default: '#00D2BE',
  idea: '#A78BFA',
  task: '#60A5FA',
  note: '#4ADE80',
  question: '#F472B6'
}

// Theme-aware minimap palettes
const darkPalette = {
  bg: '#0D0D0F',
  node: '#00D2BE',
  nodeSelected: '#00FFE0',
  root: '#FAFAFA',
  edge: 'rgba(37, 37, 48, 0.6)',
  viewport: 'rgba(0, 210, 190, 0.5)',
  viewportFill: 'rgba(0, 210, 190, 0.04)',
  regionLabel: 'rgba(250, 250, 250, 0.4)',
  breadcrumb: 'rgba(0, 210, 190, 0.3)',
}

const lightPalette = {
  bg: '#F5F5F3',
  node: '#00D2BE',
  nodeSelected: '#00A89A',
  root: '#111111',
  edge: 'rgba(180, 180, 176, 0.6)',
  viewport: 'rgba(0, 210, 190, 0.5)',
  viewportFill: 'rgba(0, 210, 190, 0.04)',
  regionLabel: 'rgba(17, 17, 17, 0.4)',
  breadcrumb: 'rgba(0, 210, 190, 0.3)',
}

const isLight = ref(false)

function syncTheme() {
  if (typeof document !== 'undefined') {
    isLight.value = document.documentElement.classList.contains('light')
  }
}

onMounted(() => {
  syncTheme()
  const observer = new MutationObserver(syncTheme)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onBeforeUnmount(() => observer.disconnect())
})

const colors = computed(() => isLight.value ? lightPalette : darkPalette)

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

// Scale factor to fit content in minimap canvas
const scale = computed(() => {
  const contentWidth = contentBounds.value.maxX - contentBounds.value.minX
  const contentHeight = contentBounds.value.maxY - contentBounds.value.minY
  return Math.min(canvasWidth.value / contentWidth, canvasHeight.value / contentHeight)
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
const RENDER_INTERVAL = 50

function scheduleRender() {
  if (renderScheduled || isCollapsed.value) return
  renderScheduled = true
  const now = performance.now()
  const wait = Math.max(0, RENDER_INTERVAL - (now - lastRenderTime))
  setTimeout(() => {
    renderScheduled = false
    lastRenderTime = performance.now()
    render()
  }, wait)
}

// Compute density grid for heatmap effect
function computeDensityGrid(gridSize: number): number[][] {
  const w = canvasWidth.value
  const h = canvasHeight.value
  const cols = Math.ceil(w / gridSize)
  const rows = Math.ceil(h / gridSize)
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (const node of mapStore.nodes.values()) {
    const x = (node.position.x + node.size.width / 2 - contentBounds.value.minX) * scale.value
    const y = (node.position.y + node.size.height / 2 - contentBounds.value.minY) * scale.value
    const col = Math.floor(x / gridSize)
    const row = Math.floor(y / gridSize)
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      grid[row]![col]! += 1
    }
  }
  return grid
}

// Render minimap
function render() {
  if (!canvasRef.value || isCollapsed.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const w = canvasWidth.value
  const h = canvasHeight.value
  if (w <= 0 || h <= 0) return

  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = `${w}px`
  canvasRef.value.style.height = `${h}px`
  ctx.scale(dpr, dpr)

  // Clear with canvas area bg
  ctx.fillStyle = colors.value.bg
  ctx.fillRect(0, 0, w, h)

  // Draw density heatmap (subtle background effect)
  if (mapStore.nodes.size > 5) {
    const gridSize = 16
    const densityGrid = computeDensityGrid(gridSize)
    let maxDensity = 0
    for (const row of densityGrid) {
      for (const val of row) {
        if (val > maxDensity) maxDensity = val
      }
    }
    if (maxDensity > 0) {
      for (let r = 0; r < densityGrid.length; r++) {
        for (let c = 0; c < densityGrid[r]!.length; c++) {
          const density = densityGrid[r]![c]!
          if (density > 0) {
            const intensity = density / maxDensity
            ctx.fillStyle = `rgba(0, 210, 190, ${0.02 + intensity * 0.08})`
            ctx.fillRect(c * gridSize, r * gridSize, gridSize, gridSize)
          }
        }
      }
    }
  }

  // Draw region labels
  if (props.regions.length > 0) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.font = '8px "Inter", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.value.regionLabel
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
    ctx.strokeStyle = colors.value.breadcrumb
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

    const now = Date.now()
    for (let i = 0; i < props.breadcrumbs.length; i++) {
      const crumb = props.breadcrumbs[i]!
      const age = (now - crumb.timestamp) / 1000
      const opacity = Math.max(0.2, 1 - age / 60)
      const cx = (-crumb.x / crumb.zoom - contentBounds.value.minX) * scale.value
      const cy = (-crumb.y / crumb.zoom - contentBounds.value.minY) * scale.value
      ctx.globalAlpha = opacity
      ctx.fillStyle = colors.value.viewport
      ctx.beginPath()
      ctx.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Draw edges
  ctx.lineWidth = 1
  for (const edge of mapStore.edges.values()) {
    const sourceNode = mapStore.nodes.get(edge.sourceId)
    const targetNode = mapStore.nodes.get(edge.targetId)
    if (!sourceNode || !targetNode) continue

    const x1 = (sourceNode.position.x + sourceNode.size.width / 2 - contentBounds.value.minX) * scale.value
    const y1 = (sourceNode.position.y + sourceNode.size.height / 2 - contentBounds.value.minY) * scale.value
    const x2 = (targetNode.position.x + targetNode.size.width / 2 - contentBounds.value.minX) * scale.value
    const y2 = (targetNode.position.y + targetNode.size.height / 2 - contentBounds.value.minY) * scale.value

    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    const vpCx = viewportRect.value.x + viewportRect.value.width / 2
    const vpCy = viewportRect.value.y + viewportRect.value.height / 2
    const dist = Math.sqrt((midX - vpCx) ** 2 + (midY - vpCy) ** 2)
    const maxDist = Math.sqrt(w * w + h * h)
    const opacity = 0.3 + 0.4 * (1 - Math.min(dist / maxDist, 1))

    ctx.strokeStyle = isLight.value ? `rgba(180, 180, 176, ${opacity})` : `rgba(37, 37, 48, ${opacity})`
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Draw nodes — color-coded, with Paper-matching minimum sizes
  for (const node of mapStore.nodes.values()) {
    const x = (node.position.x - contentBounds.value.minX) * scale.value
    const y = (node.position.y - contentBounds.value.minY) * scale.value
    const isRoot = node.isRoot || node.id === mapStore.rootNodeId
    const isSelected = mapStore.selection.nodeIds.has(node.id)
    const category = (node.metadata?.category as string) || 'default'

    // Minimum sizes matching Paper specs
    const nw = Math.max(node.size.width * scale.value, isRoot ? 20 : 12)
    const nh = Math.max(node.size.height * scale.value, isRoot ? 14 : 7)
    const radius = isRoot ? 3 : 2

    let nodeColor = node.style.borderColor || categoryColors[category] || colors.value.node
    if (isSelected) nodeColor = colors.value.nodeSelected

    ctx.fillStyle = nodeColor
    ctx.beginPath()
    ctx.roundRect(x, y, nw, nh, radius)
    ctx.fill()

    // Selected glow
    if (isSelected) {
      ctx.shadowColor = nodeColor
      ctx.shadowBlur = 4
      ctx.strokeStyle = nodeColor
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
    }

    // Root ring
    if (isRoot) {
      ctx.strokeStyle = colors.value.root
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(x - 1, y - 1, nw + 2, nh + 2, radius + 1)
      ctx.stroke()
    }
  }

  // Draw viewport rectangle with rounded corners (Paper spec)
  const vr = viewportRect.value
  ctx.beginPath()
  ctx.roundRect(vr.x, vr.y, vr.width, vr.height, 4)
  ctx.fillStyle = colors.value.viewportFill
  ctx.fill()
  ctx.strokeStyle = colors.value.viewport
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Crosshair on hover
  if (isHovered.value) {
    const vcx = vr.x + vr.width / 2
    const vcy = vr.y + vr.height / 2
    ctx.strokeStyle = 'rgba(0, 210, 190, 0.3)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(vcx - 4, vcy)
    ctx.lineTo(vcx + 4, vcy)
    ctx.moveTo(vcx, vcy - 4)
    ctx.lineTo(vcx, vcy + 4)
    ctx.stroke()
  }
}

// Watch for changes and re-render (throttled)
watch([() => props.camera, () => mapStore.nodesVersion, () => mapStore.nodes.size, () => mapStore.edges.size, () => props.regions, () => props.breadcrumbs], () => {
  scheduleRender()
}, { deep: false })

watch(isCollapsed, (collapsed) => {
  if (!collapsed) {
    nextTick(() => scheduleRender())
  }
})

onMounted(() => {
  scheduleRender()
})

// Click to navigate
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

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="nc-minimap-container">
    <!-- Collapsed toggle button -->
    <button
      v-if="isCollapsed"
      class="nc-minimap-toggle"
      title="Show minimap (M)"
      aria-label="Show minimap"
      @click="toggleCollapse"
    >
      <span class="i-lucide-map text-xs" />
    </button>

    <!-- Minimap body — unified container matching Paper -->
    <div
      v-show="!isCollapsed"
      class="nc-minimap-body"
    >
      <!-- Header -->
      <div class="nc-minimap-header">
        <span class="nc-minimap-title">MINIMAP</span>
        <button
          class="nc-minimap-collapse-btn"
          title="Collapse minimap (M)"
          aria-label="Toggle minimap"
          @click.stop="toggleCollapse"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>

      <!-- Canvas area -->
      <div
        class="nc-minimap-canvas"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointerleave="handlePointerUp"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
        <canvas ref="canvasRef" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-minimap-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.nc-minimap-body {
  display: flex;
  flex-direction: column;
  width: 220px;
  height: 156px;
  background: #09090BEB;
  border: 1px solid #1A1A1E;
  border-radius: 10px;
  overflow: hidden;
  animation: minimap-appear 0.2s ease-out;
}

@keyframes minimap-appear {
  from { opacity: 0; transform: translateY(8px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .nc-minimap-body {
    animation: none;
  }
}

.nc-minimap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 4px;
  flex-shrink: 0;
}

.nc-minimap-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--nc-ink-muted);
  text-transform: uppercase;
}

.nc-minimap-collapse-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--nc-ink-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}

.nc-minimap-collapse-btn:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 2px;
}

.nc-minimap-collapse-btn:hover {
  color: #A1A1AA;
}

.nc-minimap-canvas {
  flex: 1;
  margin: 0 6px 6px;
  border-radius: 6px;
  background: var(--nc-surface);
  overflow: hidden;
  cursor: pointer;
}

.nc-minimap-canvas canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Collapsed toggle */
.nc-minimap-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: #09090BEB;
  border: 1px solid #1A1A1E;
  color: var(--nc-ink-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  backdrop-filter: blur(8px);
}

.nc-minimap-toggle:hover {
  color: var(--nc-accent, #00D2BE);
  border-color: rgba(0, 210, 190, 0.3);
}

.nc-minimap-toggle:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 2px;
}

/* Light theme */
:root.light .nc-minimap-body {
  background: rgba(255, 255, 255, 0.92);
  border-color: #E8E8E6;
}

:root.light .nc-minimap-canvas {
  background: #F5F5F3;
}

:root.light .nc-minimap-title {
  color: #A1A1AA;
}

:root.light .nc-minimap-collapse-btn {
  color: #A1A1AA;
}

:root.light .nc-minimap-collapse-btn:hover {
  color: #71717A;
}

:root.light .nc-minimap-toggle {
  background: rgba(255, 255, 255, 0.92);
  border-color: #E8E8E6;
  color: #A1A1AA;
}

:root.light .nc-minimap-toggle:hover {
  border-color: rgba(0, 210, 190, 0.3);
}
</style>
