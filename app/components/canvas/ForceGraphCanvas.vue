<script setup lang="ts">
import { useForceGraph } from '~/composables/useForceGraph'
import { useMapStore } from '~/stores/mapStore'

const emit = defineEmits<{
  'select-node': [nodeId: string]
  'deselect': []
}>()

const mapStore = useMapStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Camera for pan/zoom
const camera = reactive({ x: 0, y: 0, zoom: 1 })
const hoveredNodeId = ref<string | null>(null)
const draggingNodeId = ref<string | null>(null)

// Panning state
const isPanning = ref(false)
const panStart = { x: 0, y: 0, camX: 0, camY: 0 }

const forceGraph = useForceGraph(
  () => mapStore.nodes,
  () => mapStore.edges,
  () => mapStore.rootNodeId,
)

// Initialize and start simulation
onMounted(() => {
  forceGraph.syncFromStore()
  forceGraph.startSimulation()
  startRenderLoop()
  window.addEventListener('resize', handleResize)
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cancelAnimationFrame(renderRafId)
})

// Restart when data changes
watch([() => mapStore.nodes.size, () => mapStore.edges.size], () => {
  forceGraph.restartSimulation()
})

function handleResize() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return
  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvas.style.width = `${rect.width}px`
  canvas.style.height = `${rect.height}px`
}

// Screen to world coordinate conversion
function screenToWorld(sx: number, sy: number) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const cx = rect.width / 2
  const cy = rect.height / 2
  return {
    x: (sx - rect.left - cx - camera.x) / camera.zoom,
    y: (sy - rect.top - cy - camera.y) / camera.zoom,
  }
}

// Render loop
let renderRafId = 0

function startRenderLoop() {
  function loop() {
    render()
    renderRafId = requestAnimationFrame(loop)
  }
  renderRafId = requestAnimationFrame(loop)
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const w = canvas.width
  const h = canvas.height
  const isLight = document.documentElement.classList.contains('light')

  // Clear
  ctx.clearRect(0, 0, w, h)

  // Apply camera transform
  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.translate(w / dpr / 2 + camera.x, h / dpr / 2 + camera.y)
  ctx.scale(camera.zoom, camera.zoom)

  const edges = mapStore.edges
  const nodes = forceGraph.forceNodes.value
  const selectedIds = mapStore.selection.nodeIds

  // Build set of connected node IDs for selected node highlighting
  const connectedIds = new Set<string>()
  const connectedEdgeIds = new Set<string>()
  for (const selId of selectedIds) {
    for (const edge of edges.values()) {
      if (edge.sourceId === selId || edge.targetId === selId) {
        connectedIds.add(edge.sourceId)
        connectedIds.add(edge.targetId)
        connectedEdgeIds.add(edge.id)
      }
    }
  }
  const hasSelection = selectedIds.size > 0

  // Draw edges — dim unconnected edges when a node is selected
  for (const edge of edges.values()) {
    const a = nodes.get(edge.sourceId)
    const b = nodes.get(edge.targetId)
    if (!a || !b) continue

    const isConnected = connectedEdgeIds.has(edge.id)

    if (hasSelection && isConnected) {
      ctx.strokeStyle = 'rgba(0, 210, 190, 0.3)'
      ctx.lineWidth = 1.5 / camera.zoom
    } else if (hasSelection) {
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)'
      ctx.lineWidth = 0.5 / camera.zoom
    } else {
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1 / camera.zoom
    }

    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  // Draw nodes — dim unconnected nodes when a node is selected
  for (const node of nodes.values()) {
    const isSelected = selectedIds.has(node.id)
    const isHovered = hoveredNodeId.value === node.id
    const isConnected = connectedIds.has(node.id)
    const isDimmed = hasSelection && !isSelected && !isConnected
    const radius = node.isRoot ? 12 : 6

    // Node dot
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)

    if (isSelected) {
      ctx.fillStyle = '#00D2BE'
      // Glow ring
      ctx.save()
      ctx.shadowColor = '#00D2BE'
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
    } else if (isConnected && hasSelection) {
      ctx.fillStyle = 'rgba(0, 210, 190, 0.5)'
    } else if (isHovered) {
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'
    } else if (isDimmed) {
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'
    } else {
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)'
    }
    ctx.fill()

    // Label — hide dimmed labels for cleaner look
    if (isDimmed && !isHovered) continue

    const fontSize = node.isRoot ? 15 : 13
    ctx.font = `${node.isRoot ? '600' : '400'} ${fontSize}px Inter, system-ui, sans-serif`
    ctx.textBaseline = 'middle'

    if (isSelected) {
      ctx.fillStyle = '#00D2BE'
    } else if (isConnected && hasSelection) {
      ctx.fillStyle = 'rgba(0, 210, 190, 0.7)'
    } else if (isHovered) {
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'
    } else {
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.45)'
    }

    const labelOffset = radius + 8
    ctx.fillText(node.label, node.x + labelOffset, node.y)
  }

  ctx.restore()
}

// --- Interaction ---

function onPointerDown(e: PointerEvent) {
  const world = screenToWorld(e.clientX, e.clientY)
  const hitId = forceGraph.findNodeAt(world.x, world.y)

  if (hitId) {
    // Start dragging a node
    draggingNodeId.value = hitId
    forceGraph.pinNode(hitId, world.x, world.y)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  } else {
    // Start panning
    isPanning.value = true
    panStart.x = e.clientX
    panStart.y = e.clientY
    panStart.camX = camera.x
    panStart.camY = camera.y
    mapStore.clearSelection()
    emit('deselect')
  }
}

function onPointerMove(e: PointerEvent) {
  if (draggingNodeId.value) {
    const world = screenToWorld(e.clientX, e.clientY)
    forceGraph.moveNode(draggingNodeId.value, world.x, world.y)
    return
  }

  if (isPanning.value) {
    camera.x = panStart.camX + (e.clientX - panStart.x)
    camera.y = panStart.camY + (e.clientY - panStart.y)
    return
  }

  // Hover detection
  const world = screenToWorld(e.clientX, e.clientY)
  const hitId = forceGraph.findNodeAt(world.x, world.y)
  hoveredNodeId.value = hitId
  const el = canvasRef.value
  if (el) el.style.cursor = hitId ? 'pointer' : 'grab'
}

function onPointerUp(e: PointerEvent) {
  if (draggingNodeId.value) {
    // If barely moved, treat as click → select
    forceGraph.unpinNode(draggingNodeId.value)

    const world = screenToWorld(e.clientX, e.clientY)
    const hitId = forceGraph.findNodeAt(world.x, world.y)
    if (hitId) {
      mapStore.select([hitId])
      emit('select-node', hitId)
    }

    draggingNodeId.value = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    return
  }

  isPanning.value = false
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(5, Math.max(0.1, camera.zoom * factor))

  // Zoom toward cursor
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mx = e.clientX - rect.left - rect.width / 2
  const my = e.clientY - rect.top - rect.height / 2

  camera.x = mx - (mx - camera.x) * (newZoom / camera.zoom)
  camera.y = my - (my - camera.y) * (newZoom / camera.zoom)
  camera.zoom = newZoom
}
</script>

<template>
  <div ref="containerRef" class="force-graph-container">
    <canvas
      ref="canvasRef"
      class="force-graph-canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @wheel.passive="onWheel"
    />
  </div>
</template>

<style scoped>
.force-graph-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--nc-bg, #09090B);
}

.force-graph-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.force-graph-canvas:active {
  cursor: grabbing;
}
</style>
