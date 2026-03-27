import type { Point, Camera, Node } from '~/types/canvas'
import type { FieldLine, FieldParticle, ResonancePulse, AnimatedFieldLine } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'

// ── Performance: device & accessibility detection ──
const isMobile = typeof window !== 'undefined'
  ? window.matchMedia('(max-width: 767px)').matches
  : false

const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

// Performance limits (defaults; adaptive overrides these)
const MAX_PARTICLES = prefersReducedMotion ? 0 : isMobile ? 50 : 200
const MAX_FIELD_LINES_CAP = isMobile ? 20 : 50
const PULSE_DURATION = 1500 // ms
const HIGH_SIMILARITY_THRESHOLD = 0.7
const FADE_DURATION = 300 // ms
const FIELD_RECALC_INTERVAL = isMobile ? 100 : 32 // ms throttle for field recalculation

/**
 * Compute adaptive max field lines based on viewport, node count, and zoom.
 */
function computeAdaptiveMaxLines(
  viewportArea: number,
  nodeCount: number,
  zoom: number
): number {
  // Base 30, scale with node density, cap at 100
  const density = nodeCount / Math.max(viewportArea / 1e6, 0.1)
  const base = 30
  const scaled = base + density * 10
  const zoomFactor = Math.min(zoom, 1.5)
  return Math.min(Math.round(scaled * zoomFactor), 100)
}

/**
 * Compute line width proportional to similarity.
 */
function computeLineWidth(similarity: number, intensity: number): number {
  // 0.5px at threshold → 3px at 1.0
  return 0.5 + (similarity * 2.5) * intensity
}

/**
 * Compute particle speed proportional to similarity.
 */
function computeParticleSpeed(similarity: number): number {
  // 0.008 at low → 0.04 at high
  return 0.008 + similarity * 0.032
}

/**
 * Easing function for fade animations.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Semantic Field Visualization composable
 *
 * Manages field lines, particles, and resonance pulses
 * for visualizing semantic relationships between nodes.
 *
 * v2: similarity-proportional widths/speeds, curvature, fade animations,
 *     adaptive line count, cluster glow, interactive exploration.
 */
export function useSemanticField() {
  const semanticStore = useSemanticStore()

  // Animation state
  const fieldLines = ref<AnimatedFieldLine[]>([])
  const particles = ref<FieldParticle[]>([])
  const pulses = ref<ResonancePulse[]>([])

  // Animation frame reference
  let animationFrameId: number | null = null
  let lastFrameTime = 0
  let lastFieldRecalcTime = 0 // throttle field recalculation
  let frameCount = 0 // frame counter for mobile frame skipping

  // Previous line IDs for fade tracking
  const previousLineMap = new Map<string, AnimatedFieldLine>()

  /**
   * Compute field lines from similarity pairs
   */
  function computeFieldLines(
    nodes: Map<string, Node>,
    viewport: { minX: number; maxX: number; minY: number; maxY: number },
    camera: Camera
  ): AnimatedFieldLine[] {
    if (!semanticStore.shouldRenderField) return []

    const similarityPairs = semanticStore.visibleSimilarityPairs
    const intensity = semanticStore.fieldSettings.intensity

    // Determine max lines
    let maxLines = semanticStore.fieldSettings.maxFieldLines
    if (semanticStore.fieldSettings.adaptiveLineCount) {
      const viewportArea = (viewport.maxX - viewport.minX) * (viewport.maxY - viewport.minY)
      maxLines = computeAdaptiveMaxLines(viewportArea, nodes.size, camera.zoom)
    }
    // Apply mobile / reduced-motion cap
    maxLines = Math.min(maxLines, MAX_FIELD_LINES_CAP)

    const lines: AnimatedFieldLine[] = []
    const currentTime = performance.now()
    const newLineIds = new Set<string>()

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

      // Curvature based on similarity — high similarity = more direct path
      const curveIntensity = (1 - pair.similarity) * 0.4 * distance

      // Perpendicular offset for control points
      const perpX = distance > 0 ? -dy / distance : 0
      const perpY = distance > 0 ? dx / distance : 0

      const midX = (sourceCenter.x + targetCenter.x) / 2
      const midY = (sourceCenter.y + targetCenter.y) / 2

      const lineId = `${pair.sourceId}-${pair.targetId}`
      newLineIds.add(lineId)

      // Check if line existed before for fade animation
      const prev = previousLineMap.get(lineId)
      const lineWidth = computeLineWidth(pair.similarity, intensity)

      let opacity: number
      let targetOpacity: number
      let fadeStartTime: number

      if (prev) {
        // Existing line — keep opacity
        opacity = prev.opacity
        targetOpacity = 1
        fadeStartTime = prev.fadeStartTime
      } else {
        // New line — fade in
        opacity = 0
        targetOpacity = 1
        fadeStartTime = currentTime
      }

      lines.push({
        id: lineId,
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
        },
        opacity,
        targetOpacity,
        fadeStartTime,
        lineWidth
      })

      if (lines.length >= maxLines) break
    }

    // Add fading-out lines (lines that existed before but not in current set)
    for (const [lineId, prevLine] of previousLineMap) {
      if (!newLineIds.has(lineId)) {
        // Start fading out
        const fadeLine = { ...prevLine, targetOpacity: 0 }
        if (prevLine.targetOpacity !== 0) {
          fadeLine.fadeStartTime = currentTime
        }
        // Only keep if still visible
        if (fadeLine.opacity > 0.01) {
          lines.push(fadeLine)
        }
      }
    }

    // Update previous line map
    previousLineMap.clear()
    for (const line of lines) {
      previousLineMap.set(line.id, line)
    }

    return lines
  }

  /**
   * Update opacity fade animations on field lines.
   */
  function updateLineOpacities(lines: AnimatedFieldLine[], currentTime: number) {
    for (const line of lines) {
      const elapsed = currentTime - line.fadeStartTime
      const progress = Math.min(elapsed / FADE_DURATION, 1)
      const eased = easeOutCubic(progress)

      if (line.targetOpacity > line.opacity) {
        // Fading in
        line.opacity = eased
      } else if (line.targetOpacity < line.opacity) {
        // Fading out
        line.opacity = 1 - eased
      }
    }
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
  function updateParticles(lines: AnimatedFieldLine[], deltaTime: number) {
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

    // Remove particles for lines that no longer exist or are fading out
    const activeLineIds = new Set(lines.filter(l => l.targetOpacity > 0).map(l => l.id))
    particles.value = particles.value.filter(p => activeLineIds.has(p.lineId))

    // Add new particles for active lines (up to limit)
    const particlesPerLine = Math.min(3, Math.floor(MAX_PARTICLES / Math.max(lines.length, 1)))

    for (const line of lines) {
      if (line.targetOpacity <= 0) continue
      const existingCount = particles.value.filter(p => p.lineId === line.id).length

      for (let i = existingCount; i < particlesPerLine && particles.value.length < MAX_PARTICLES; i++) {
        particles.value.push({
          id: `${line.id}-${Date.now()}-${i}`,
          lineId: line.id,
          progress: Math.random(), // Random starting position
          speed: computeParticleSpeed(line.similarity) * (0.8 + Math.random() * 0.4),
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
   * Set interactive exploration state for a hovered node.
   * Highlights connected lines and dims others.
   */
  function setInteractionHover(nodeId: string | null) {
    if (!semanticStore.fieldSettings.interactiveExploration) {
      semanticStore.setFieldInteraction({
        hoveredNodeId: null,
        highlightedLineIds: new Set(),
        dimmedLineIds: new Set(),
        showSimilarityLabels: false
      })
      return
    }

    if (!nodeId) {
      semanticStore.setFieldInteraction({
        hoveredNodeId: null,
        highlightedLineIds: new Set(),
        dimmedLineIds: new Set(),
        showSimilarityLabels: false
      })
      return
    }

    const highlighted = new Set<string>()
    const dimmed = new Set<string>()

    for (const line of fieldLines.value) {
      if (line.sourceId === nodeId || line.targetId === nodeId) {
        highlighted.add(line.id)
      } else {
        dimmed.add(line.id)
      }
    }

    semanticStore.setFieldInteraction({
      hoveredNodeId: nodeId,
      highlightedLineIds: highlighted,
      dimmedLineIds: dimmed,
      showSimilarityLabels: true
    })
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
      frameCount++

      // Mobile frame skipping: process every other frame
      if (isMobile && frameCount % 2 !== 0) {
        animationFrameId = requestAnimationFrame(animate)
        return
      }

      if (semanticStore.fieldSettings.enabled) {
        // Throttle field recalculation to FIELD_RECALC_INTERVAL
        const shouldRecalcField = currentTime - lastFieldRecalcTime >= FIELD_RECALC_INTERVAL

        if (shouldRecalcField) {
          lastFieldRecalcTime = currentTime
          const viewport = getViewport()
          const camera = getCamera()

          // Update field lines
          fieldLines.value = computeFieldLines(nodes, viewport, camera)
        }

        // Update line fade animations (always, for smooth fades)
        updateLineOpacities(fieldLines.value, currentTime)

        // Update particles (skip entirely if reduced-motion)
        if (semanticStore.fieldSettings.showParticles && MAX_PARTICLES > 0) {
          updateParticles(fieldLines.value, deltaTime)
        } else if (prefersReducedMotion) {
          particles.value = []
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
    lastFieldRecalcTime = 0
    frameCount = 0
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
    previousLineMap.clear()
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
    fieldLines: readonly(fieldLines) as Readonly<Ref<readonly AnimatedFieldLine[]>>,
    particles: readonly(particles),
    pulses: readonly(pulses),

    // Methods
    computeFieldLines,
    getPointOnCurve,
    startAnimation,
    stopAnimation,
    triggerPulse,
    setInteractionHover
  }
}
