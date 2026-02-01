<script setup lang="ts">
import type { Camera, Node } from '~/types/canvas'
import type { FieldLine, FieldParticle, ResonancePulse } from '~/types/semantic'
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

// Colors (teal theme)
const colors = {
  fieldLine: '#00D2BE',
  fieldLineGlow: 'rgba(0, 210, 190, 0.3)',
  particle: '#00D2BE',
  particleGlow: 'rgba(0, 210, 190, 0.6)',
  pulse: 'rgba(0, 210, 190, 0.4)'
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
  if (!canvasRef.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const { width, height } = canvasRef.value

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  if (!semanticStore.shouldRenderField) {
    requestAnimationFrame(render)
    return
  }

  // Apply camera transform
  ctx.save()
  ctx.scale(dpr.value, dpr.value)
  ctx.translate(props.camera.x, props.camera.y)
  ctx.scale(props.camera.zoom, props.camera.zoom)

  const intensity = semanticStore.fieldSettings.intensity

  // Draw field lines
  for (const line of semanticField.fieldLines.value) {
    drawFieldLine(ctx, line, intensity)
  }

  // Draw particles
  if (semanticStore.fieldSettings.showParticles) {
    for (const particle of semanticField.particles.value) {
      drawParticle(ctx, particle, intensity)
    }
  }

  // Draw pulses
  if (semanticStore.fieldSettings.showPulses) {
    for (const pulse of semanticField.pulses.value) {
      drawPulse(ctx, pulse, intensity)
    }
  }

  ctx.restore()

  requestAnimationFrame(render)
}

// Draw a single field line with gradient
function drawFieldLine(ctx: CanvasRenderingContext2D, line: FieldLine, intensity: number) {
  const opacity = line.similarity * intensity * 0.5

  // Glow effect
  ctx.shadowColor = colors.fieldLineGlow
  ctx.shadowBlur = 8 * line.similarity

  // Create gradient along line
  const gradient = ctx.createLinearGradient(
    line.sourcePoint.x, line.sourcePoint.y,
    line.targetPoint.x, line.targetPoint.y
  )
  gradient.addColorStop(0, `rgba(0, 210, 190, ${opacity * 0.3})`)
  gradient.addColorStop(0.5, `rgba(0, 210, 190, ${opacity})`)
  gradient.addColorStop(1, `rgba(0, 210, 190, ${opacity * 0.3})`)

  ctx.strokeStyle = gradient
  ctx.lineWidth = 1 + line.similarity
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

// Draw a particle along a field line
function drawParticle(ctx: CanvasRenderingContext2D, particle: FieldParticle, intensity: number) {
  // Find the line this particle belongs to
  const line = semanticField.fieldLines.value.find(l => l.id === particle.lineId)
  if (!line) return

  // Get position on curve
  const pos = semanticField.getPointOnCurve(line, particle.progress)

  const opacity = particle.opacity * intensity

  // Glow
  ctx.shadowColor = colors.particleGlow
  ctx.shadowBlur = 6

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
</style>
