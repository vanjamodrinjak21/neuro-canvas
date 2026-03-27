<script setup lang="ts">
import type { Camera, Node } from '~/types/canvas'
import type { AnimatedFieldLine, FieldParticle, ResonancePulse, SemanticCluster } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'
import { useSemanticField } from '~/composables/useSemanticField'
import { useMapStore } from '~/stores/mapStore'

const props = defineProps<{
  camera: Camera
}>()

const mapStore = useMapStore()
const semanticStore = useSemanticStore()
const semanticField = useSemanticField()

// Canvas refs
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Device pixel ratio
const dpr = computed(() => typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)

// Reduced motion
const reducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

// Colors (teal theme)
const colors = {
  fieldLine: '#00D2BE',
  fieldLineGlow: 'rgba(0, 210, 190, 0.3)',
  particle: '#00D2BE',
  particleGlow: 'rgba(0, 210, 190, 0.6)',
  pulse: 'rgba(0, 210, 190, 0.4)'
}

// Category color map for cluster glow
const categoryColors: Record<string, string> = {
  concept: '#00D2BE',
  task: '#60A5FA',
  question: '#F472B6',
  resource: '#4ADE80',
  person: '#A78BFA'
}

// Viewport calculation
function getViewport() {
  const canvas = canvasRef.value
  if (!canvas) {
    return { minX: 0, maxX: 1000, minY: 0, maxY: 1000 }
  }

  const width = canvas.width / dpr.value
  const height = canvas.height / dpr.value

  return {
    minX: -props.camera.x / props.camera.zoom,
    maxX: (-props.camera.x + width) / props.camera.zoom,
    minY: -props.camera.y / props.camera.zoom,
    maxY: (-props.camera.y + height) / props.camera.zoom
  }
}

// Initialize and start animation
onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  // Initial sizing
  resizeCanvas()

  // Set up resize observer
  const resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(containerRef.value)

  // Start animation
  semanticField.startAnimation(
    mapStore.nodes,
    getViewport,
    () => props.camera
  )

  // Start render loop
  requestAnimationFrame(render)

  onUnmounted(() => {
    resizeObserver.disconnect()
    semanticField.stopAnimation()
  })
})

// Resize canvas to match container
function resizeCanvas() {
  if (!canvasRef.value || !containerRef.value) return

  const rect = containerRef.value.getBoundingClientRect()
  canvasRef.value.width = rect.width * dpr.value
  canvasRef.value.height = rect.height * dpr.value
  canvasRef.value.style.width = `${rect.width}px`
  canvasRef.value.style.height = `${rect.height}px`
}

// Main render loop
function render() {
  try {
    renderFrame()
  } catch (e) {
    if (import.meta.dev) console.warn('[SemanticField] render error:', e)
  }
  requestAnimationFrame(render)
}

function renderFrame() {
  if (!canvasRef.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const { width, height } = canvasRef.value

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  if (!semanticStore.shouldRenderField) return

  // Apply camera transform
  ctx.save()
  ctx.scale(dpr.value, dpr.value)
  ctx.translate(props.camera.x, props.camera.y)
  ctx.scale(props.camera.zoom, props.camera.zoom)

  const intensity = semanticStore.fieldSettings.intensity
  const interaction = semanticStore.fieldInteraction

  // ── Cluster glow (z-25, rendered first) ──
  if (semanticStore.fieldSettings.showClusterGlow && semanticStore.clusters.length > 0) {
    for (const cluster of semanticStore.clusters) {
      drawClusterGlow(ctx, cluster, intensity)
    }
  }

  // ── Field lines (z-35) ──
  for (const line of semanticField.fieldLines.value) {
    const isHighlighted = interaction.highlightedLineIds.has(line.id)
    const isDimmed = interaction.dimmedLineIds.has(line.id)
    drawFieldLine(ctx, line, intensity, isHighlighted, isDimmed)
  }

  // ── Similarity labels (z-37) ──
  if (interaction.showSimilarityLabels && interaction.hoveredNodeId) {
    for (const line of semanticField.fieldLines.value) {
      if (interaction.highlightedLineIds.has(line.id)) {
        drawSimilarityLabel(ctx, line)
      }
    }
  }

  // ── Cluster labels ──
  if (semanticStore.fieldSettings.showClusterLabels && props.camera.zoom < 0.4) {
    for (const cluster of semanticStore.clusters) {
      drawClusterLabel(ctx, cluster)
    }
  }

  // ── Particles (z-40) ──
  if (semanticStore.fieldSettings.showParticles) {
    for (const particle of semanticField.particles.value) {
      drawParticle(ctx, particle, intensity)
    }
  }

  // ── Pulses (z-45) ──
  if (semanticStore.fieldSettings.showPulses) {
    for (const pulse of semanticField.pulses.value) {
      drawPulse(ctx, pulse, intensity)
    }
  }

  ctx.restore()
}

// ═══════════════ DRAWING FUNCTIONS ═══════════════

function drawClusterGlow(ctx: CanvasRenderingContext2D, cluster: SemanticCluster, intensity: number) {
  if (cluster.radius <= 0) return

  const color = cluster.dominantCategory
    ? categoryColors[cluster.dominantCategory] ?? colors.fieldLine
    : colors.fieldLine

  // Parse color to get RGB components
  const alpha = cluster.averageSimilarity * intensity * 0.15
  const gradient = ctx.createRadialGradient(
    cluster.centroid.x, cluster.centroid.y, 0,
    cluster.centroid.x, cluster.centroid.y, cluster.radius
  )
  gradient.addColorStop(0, colorWithAlpha(color, alpha))
  gradient.addColorStop(0.7, colorWithAlpha(color, alpha * 0.3))
  gradient.addColorStop(1, colorWithAlpha(color, 0))

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(cluster.centroid.x, cluster.centroid.y, cluster.radius, 0, Math.PI * 2)
  ctx.fill()
}

function drawFieldLine(
  ctx: CanvasRenderingContext2D,
  line: AnimatedFieldLine,
  intensity: number,
  isHighlighted: boolean,
  isDimmed: boolean
) {
  let lineOpacity = line.opacity * line.similarity * intensity * 0.5
  let lineWidth = line.lineWidth

  if (isHighlighted) {
    lineOpacity = Math.min(line.opacity * intensity, 1)
    lineWidth *= 2
  } else if (isDimmed) {
    lineOpacity *= 0.15
  }

  if (lineOpacity < 0.01) return

  // Glow effect (skip in reduced motion for perf)
  if (!reducedMotion && !isDimmed) {
    ctx.shadowColor = isHighlighted
      ? 'rgba(0, 210, 190, 0.6)'
      : colors.fieldLineGlow
    ctx.shadowBlur = isHighlighted ? 12 : 8 * line.similarity
  }

  // Create gradient along line
  const gradient = ctx.createLinearGradient(
    line.sourcePoint.x, line.sourcePoint.y,
    line.targetPoint.x, line.targetPoint.y
  )
  gradient.addColorStop(0, `rgba(0, 210, 190, ${lineOpacity * 0.3})`)
  gradient.addColorStop(0.5, `rgba(0, 210, 190, ${lineOpacity})`)
  gradient.addColorStop(1, `rgba(0, 210, 190, ${lineOpacity * 0.3})`)

  ctx.strokeStyle = gradient
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(line.sourcePoint.x, line.sourcePoint.y)

  if (line.controlPoint1 && line.controlPoint2) {
    // Draw bezier curve
    ctx.bezierCurveTo(
      line.controlPoint1.x, line.controlPoint1.y,
      line.controlPoint2.x, line.controlPoint2.y,
      line.targetPoint.x, line.targetPoint.y
    )
  } else {
    // Straight line fallback
    ctx.lineTo(line.targetPoint.x, line.targetPoint.y)
  }

  ctx.stroke()

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

function drawSimilarityLabel(ctx: CanvasRenderingContext2D, line: AnimatedFieldLine) {
  // Draw similarity % at midpoint of line
  const midpoint = semanticField.getPointOnCurve(line, 0.5)
  const pct = `${Math.round(line.similarity * 100)}%`

  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Background pill
  const metrics = ctx.measureText(pct)
  const padding = 4
  const bgWidth = metrics.width + padding * 2
  const bgHeight = 16

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.beginPath()
  const x = midpoint.x - bgWidth / 2
  const y = midpoint.y - bgHeight / 2
  const r = 4
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + bgWidth - r, y)
  ctx.quadraticCurveTo(x + bgWidth, y, x + bgWidth, y + r)
  ctx.lineTo(x + bgWidth, y + bgHeight - r)
  ctx.quadraticCurveTo(x + bgWidth, y + bgHeight, x + bgWidth - r, y + bgHeight)
  ctx.lineTo(x + r, y + bgHeight)
  ctx.quadraticCurveTo(x, y + bgHeight, x, y + bgHeight - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.fill()

  // Text
  ctx.fillStyle = '#00D2BE'
  ctx.fillText(pct, midpoint.x, midpoint.y)
}

function drawClusterLabel(ctx: CanvasRenderingContext2D, cluster: SemanticCluster) {
  if (cluster.keywords.length === 0) return

  // Get node content for keywords (keywords are node IDs)
  const labelParts: string[] = []
  for (const nodeId of cluster.keywords) {
    const node = mapStore.nodes.get(nodeId)
    if (node) {
      labelParts.push(node.content.slice(0, 20))
    }
  }

  if (labelParts.length === 0) return

  const label = labelParts.join(' · ')
  const fontSize = Math.max(10, 14 / props.camera.zoom)

  ctx.font = `500 ${fontSize}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillText(label, cluster.centroid.x, cluster.centroid.y - cluster.radius - 10)
}

// Draw a particle along a field line
function drawParticle(ctx: CanvasRenderingContext2D, particle: FieldParticle, intensity: number) {
  // Find the line this particle belongs to
  const line = semanticField.fieldLines.value.find(l => l.id === particle.lineId)
  if (!line) return

  // Skip particles on dimmed lines
  const interaction = semanticStore.fieldInteraction
  if (interaction.dimmedLineIds.has(particle.lineId)) return

  // Get position on curve
  const pos = semanticField.getPointOnCurve(line, particle.progress)

  const opacity = particle.opacity * intensity

  // Glow
  if (!reducedMotion) {
    ctx.shadowColor = colors.particleGlow
    ctx.shadowBlur = 6
  }

  // Draw particle
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, particle.size, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(0, 210, 190, ${opacity})`
  ctx.fill()

  // Inner bright core
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, particle.size * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.8})`
  ctx.fill()

  // Reset shadow
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

// Draw a resonance pulse
function drawPulse(ctx: CanvasRenderingContext2D, pulse: ResonancePulse, intensity: number) {
  const opacity = pulse.opacity * intensity

  // Draw expanding ring
  ctx.beginPath()
  ctx.arc(pulse.center.x, pulse.center.y, pulse.radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(0, 210, 190, ${opacity})`
  ctx.lineWidth = 2
  ctx.stroke()

  // Inner glow ring
  ctx.beginPath()
  ctx.arc(pulse.center.x, pulse.center.y, pulse.radius * 0.8, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(0, 210, 190, ${opacity * 0.5})`
  ctx.lineWidth = 1
  ctx.stroke()
}

// ═══════════════ HELPERS ═══════════════

function colorWithAlpha(hexOrName: string, alpha: number): string {
  // Convert hex to rgba
  if (hexOrName.startsWith('#')) {
    const hex = hexOrName.slice(1)
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return hexOrName
}
</script>

<template>
  <div
    ref="containerRef"
    class="semantic-field-layer"
  >
    <canvas
      ref="canvasRef"
      class="semantic-field-canvas"
    />
  </div>
</template>

<style scoped>
.semantic-field-layer {
  position: absolute;
  inset: 0;
  z-index: 35; /* Between edges and nodes */
  pointer-events: none;
  overflow: hidden;
}

.semantic-field-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .semantic-field-layer {
    /* Disable animations — render static lines only */
    will-change: auto;
  }
}
</style>
