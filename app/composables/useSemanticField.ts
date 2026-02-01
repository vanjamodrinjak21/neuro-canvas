import type { Point, Camera, Node } from '~/types/canvas'
import type { FieldLine, FieldParticle, ResonancePulse } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'

// Performance limits
const MAX_FIELD_LINES = 50
const MAX_PARTICLES = 200
const PARTICLE_SPEED = 0.002
const PULSE_DURATION = 1500 // ms
const HIGH_SIMILARITY_THRESHOLD = 0.7

/**
 * Semantic Field Visualization composable
 *
 * Manages field lines, particles, and resonance pulses
 * for visualizing semantic relationships between nodes.
 */
export function useSemanticField() {
  const semanticStore = useSemanticStore()

  // Animation state
  const fieldLines = ref<FieldLine[]>([])
  const particles = ref<FieldParticle[]>([])
  const pulses = ref<ResonancePulse[]>([])

  // Animation frame reference
  let animationFrameId: number | null = null
  let lastFrameTime = 0

  /**
   * Compute field lines from similarity pairs
   */
  function computeFieldLines(
    nodes: Map<string, Node>,
    viewport: { minX: number; maxX: number; minY: number; maxY: number },
    camera: Camera
  ): FieldLine[] {
    if (!semanticStore.shouldRenderField) return []

    const similarityPairs = semanticStore.visibleSimilarityPairs
    const lines: FieldLine[] = []

    for (const pair of similarityPairs) {
      const sourceNode = nodes.get(pair.sourceId)
      const targetNode = nodes.get(pair.targetId)

      if (!sourceNode || !targetNode) continue

      // Get node centers
      const sourceCenter: Point = {
        x: sourceNode.position.x + sourceNode.size.width / 2,
        y: sourceNode.position.y + sourceNode.size.height / 2
      }
      const targetCenter: Point = {
        x: targetNode.position.x + targetNode.size.width / 2,
        y: targetNode.position.y + targetNode.size.height / 2
      }

      // Viewport culling - skip if both nodes are outside viewport
      const sourceInView = isPointInViewport(sourceCenter, viewport)
      const targetInView = isPointInViewport(targetCenter, viewport)
      if (!sourceInView && !targetInView) continue

      // Calculate control points for curved line
      const dx = targetCenter.x - sourceCenter.x
      const dy = targetCenter.y - sourceCenter.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Curve intensity based on distance and similarity
      const curveIntensity = Math.min(distance * 0.3, 100) * pair.similarity

      // Perpendicular offset for control points
      const perpX = -dy / distance
      const perpY = dx / distance

      const midX = (sourceCenter.x + targetCenter.x) / 2
      const midY = (sourceCenter.y + targetCenter.y) / 2

      lines.push({
        id: `${pair.sourceId}-${pair.targetId}`,
        sourceId: pair.sourceId,
        targetId: pair.targetId,
        sourcePoint: sourceCenter,
        targetPoint: targetCenter,
        similarity: pair.similarity,
        controlPoint1: {
          x: midX + perpX * curveIntensity * 0.5,
          y: midY + perpY * curveIntensity * 0.5
        },
        controlPoint2: {
          x: midX - perpX * curveIntensity * 0.5,
          y: midY - perpY * curveIntensity * 0.5
        }
      })

      if (lines.length >= MAX_FIELD_LINES) break
    }

    return lines
  }

  /**
   * Check if a point is within the viewport (with margin)
   */
  function isPointInViewport(
    point: Point,
    viewport: { minX: number; maxX: number; minY: number; maxY: number },
    margin: number = 100
  ): boolean {
    return (
      point.x >= viewport.minX - margin &&
      point.x <= viewport.maxX + margin &&
      point.y >= viewport.minY - margin &&
      point.y <= viewport.maxY + margin
    )
  }

  /**
   * Initialize or update particles along field lines
   */
  function updateParticles(lines: FieldLine[], deltaTime: number) {
    // Move existing particles
    for (const particle of particles.value) {
      particle.progress += particle.speed * deltaTime
      if (particle.progress > 1) {
        particle.progress = 0
      }

      // Fade in/out at ends
      const fadeZone = 0.15
      if (particle.progress < fadeZone) {
        particle.opacity = particle.progress / fadeZone
      } else if (particle.progress > 1 - fadeZone) {
        particle.opacity = (1 - particle.progress) / fadeZone
      } else {
        particle.opacity = 1
      }
    }

    // Remove particles for lines that no longer exist
    const lineIds = new Set(lines.map(l => l.id))
    particles.value = particles.value.filter(p => lineIds.has(p.lineId))

    // Add new particles for new lines (up to limit)
    const particlesPerLine = Math.min(3, Math.floor(MAX_PARTICLES / Math.max(lines.length, 1)))

    for (const line of lines) {
      const existingCount = particles.value.filter(p => p.lineId === line.id).length

      for (let i = existingCount; i < particlesPerLine && particles.value.length < MAX_PARTICLES; i++) {
        particles.value.push({
          id: `${line.id}-${Date.now()}-${i}`,
          lineId: line.id,
          progress: Math.random(), // Random starting position
          speed: PARTICLE_SPEED * (0.8 + Math.random() * 0.4) * line.similarity,
          size: 2 + line.similarity * 2,
          opacity: 0
        })
      }
    }
  }

  /**
   * Create resonance pulse for high-similarity pairs
   */
  function createPulse(nodeId: string, center: Point) {
    // Remove old pulse for this node if exists
    pulses.value = pulses.value.filter(p => p.nodeId !== nodeId)

    pulses.value.push({
      id: `pulse-${nodeId}-${Date.now()}`,
      nodeId,
      center,
      radius: 0,
      maxRadius: 60,
      opacity: 0.6,
      startTime: performance.now()
    })
  }

  /**
   * Update pulse animations
   */
  function updatePulses(currentTime: number) {
    pulses.value = pulses.value.filter(pulse => {
      const elapsed = currentTime - pulse.startTime
      const progress = elapsed / PULSE_DURATION

      if (progress >= 1) return false

      // Ease out expansion
      pulse.radius = pulse.maxRadius * easeOutQuad(progress)
      pulse.opacity = 0.6 * (1 - progress)

      return true
    })
  }

  /**
   * Ease out quadratic
   */
  function easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t)
  }

  /**
   * Get point on bezier curve at t (0-1)
   */
  function getPointOnCurve(line: FieldLine, t: number): Point {
    if (!line.controlPoint1 || !line.controlPoint2) {
      // Linear interpolation if no control points
      return {
        x: line.sourcePoint.x + (line.targetPoint.x - line.sourcePoint.x) * t,
        y: line.sourcePoint.y + (line.targetPoint.y - line.sourcePoint.y) * t
      }
    }

    // Cubic bezier
    const t1 = 1 - t
    const t2 = t1 * t1
    const t3 = t2 * t1
    const tt = t * t
    const ttt = tt * t

    return {
      x: t3 * line.sourcePoint.x +
         3 * t2 * t * line.controlPoint1.x +
         3 * t1 * tt * line.controlPoint2.x +
         ttt * line.targetPoint.x,
      y: t3 * line.sourcePoint.y +
         3 * t2 * t * line.controlPoint1.y +
         3 * t1 * tt * line.controlPoint2.y +
         ttt * line.targetPoint.y
    }
  }

  /**
   * Start animation loop
   */
  function startAnimation(
    nodes: Map<string, Node>,
    getViewport: () => { minX: number; maxX: number; minY: number; maxY: number },
    getCamera: () => Camera
  ) {
    if (animationFrameId !== null) return

    function animate(currentTime: number) {
      const deltaTime = currentTime - lastFrameTime
      lastFrameTime = currentTime

      if (semanticStore.fieldSettings.enabled) {
        const viewport = getViewport()
        const camera = getCamera()

        // Update field lines
        fieldLines.value = computeFieldLines(nodes, viewport, camera)

        // Update particles
        if (semanticStore.fieldSettings.showParticles) {
          updateParticles(fieldLines.value, deltaTime)
        }

        // Update pulses
        if (semanticStore.fieldSettings.showPulses) {
          updatePulses(currentTime)
        }

        // Check for high-similarity pairs to trigger pulses
        for (const line of fieldLines.value) {
          if (line.similarity >= HIGH_SIMILARITY_THRESHOLD) {
            const existingPulse = pulses.value.find(
              p => p.nodeId === line.sourceId || p.nodeId === line.targetId
            )
            if (!existingPulse && Math.random() < 0.001) { // Rare pulse trigger
              const targetNode = nodes.get(line.targetId)
              if (targetNode) {
                createPulse(line.targetId, {
                  x: targetNode.position.x + targetNode.size.width / 2,
                  y: targetNode.position.y + targetNode.size.height / 2
                })
              }
            }
          }
        }
      } else {
        // Clear when disabled
        fieldLines.value = []
        particles.value = []
        pulses.value = []
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    lastFrameTime = performance.now()
    animationFrameId = requestAnimationFrame(animate)
  }

  /**
   * Stop animation loop
   */
  function stopAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    fieldLines.value = []
    particles.value = []
    pulses.value = []
  }

  /**
   * Trigger a pulse on a specific node
   */
  function triggerPulse(nodeId: string, nodes: Map<string, Node>) {
    const node = nodes.get(nodeId)
    if (node) {
      createPulse(nodeId, {
        x: node.position.x + node.size.width / 2,
        y: node.position.y + node.size.height / 2
      })
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopAnimation()
  })

  return {
    // State
    fieldLines: readonly(fieldLines),
    particles: readonly(particles),
    pulses: readonly(pulses),

    // Methods
    computeFieldLines,
    getPointOnCurve,
    startAnimation,
    stopAnimation,
    triggerPulse
  }
}
