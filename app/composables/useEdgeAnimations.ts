// Edge entrance and hover animations
// - Entrance: staggered line-draw from center on map load
// - Hover: interpolated stroke width/color/glow

import type { Edge } from '~/types/canvas'
import { easeOutCubic, lerp, clamp } from '~/utils/easings'

interface EdgeEntranceState {
  edgeId: string
  startTime: number
  duration: number
  delay: number
}

export function useEdgeAnimations() {
  const entranceStates = new Map<string, EdgeEntranceState>()
  const hoverProgress = new Map<string, number>()
  let hoveredEdgeId: string | null = null
  let reducedMotion = false

  function setReducedMotion(value: boolean) {
    reducedMotion = value
  }

  /**
   * Trigger entrance animations for all edges (staggered)
   */
  function triggerEntranceAll(edges: Map<string, Edge>, staggerMs: number = 30) {
    if (reducedMotion) return

    const now = performance.now()
    let index = 0
    for (const edge of edges.values()) {
      entranceStates.set(edge.id, {
        edgeId: edge.id,
        startTime: now,
        duration: 400,
        delay: index * staggerMs
      })
      index++
    }
  }

  /**
   * Get entrance draw progress for an edge (0 to 1, or -1 if no animation)
   */
  function getEntranceProgress(edgeId: string): number {
    const state = entranceStates.get(edgeId)
    if (!state) return -1

    const now = performance.now()
    const elapsed = now - state.startTime - state.delay
    if (elapsed < 0) return 0

    const t = clamp(elapsed / state.duration, 0, 1)
    if (t >= 1) {
      entranceStates.delete(edgeId)
      return -1 // Animation complete
    }

    return easeOutCubic(t)
  }

  /**
   * Set the currently hovered edge
   */
  function setHoveredEdge(edgeId: string | null) {
    hoveredEdgeId = edgeId
    if (edgeId && !hoverProgress.has(edgeId)) {
      hoverProgress.set(edgeId, 0)
    }
  }

  /**
   * Update hover interpolation — call once per frame
   */
  function update(dt: number) {
    const speed = 10 * dt

    for (const [edgeId, progress] of hoverProgress) {
      const target = edgeId === hoveredEdgeId ? 1 : 0
      const newProgress = lerp(progress, target, clamp(speed, 0, 1))
      if (newProgress < 0.01 && target === 0) {
        hoverProgress.delete(edgeId)
      } else {
        hoverProgress.set(edgeId, newProgress)
      }
    }
  }

  /**
   * Get hover highlight properties for an edge
   */
  function getHoverProps(edgeId: string): { strokeWidth: number; glowOpacity: number; progress: number } {
    const progress = hoverProgress.get(edgeId) ?? 0
    return {
      strokeWidth: lerp(1.5, 3, progress),
      glowOpacity: progress * 0.3,
      progress
    }
  }

  function hasActiveAnimations(): boolean {
    return entranceStates.size > 0 || hoverProgress.size > 0
  }

  return {
    triggerEntranceAll,
    getEntranceProgress,
    setHoveredEdge,
    update,
    getHoverProps,
    hasActiveAnimations,
    setReducedMotion
  }
}
