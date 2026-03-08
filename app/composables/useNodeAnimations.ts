// Node lifecycle animation system
// Manages enter, exit, move, hover, selection, and pulse animations

import type { Node, Point } from '~/types/canvas'
import { easeOutCubic, easeOutBack, easeOutQuart, lerp, clamp } from '~/utils/easings'

export interface AnimatedProps {
  opacity: number
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
  hoverProgress: number
  selectionProgress: number
}

interface EnterAnimation {
  nodeId: string
  startTime: number
  duration: number
  source: 'user' | 'ai'
}

interface ExitAnimation {
  nodeId: string
  startTime: number
  duration: number
  snapshot: { position: Point; size: { width: number; height: number }; content: string; style: Node['style'] }
}

interface MoveAnimation {
  nodeId: string
  startTime: number
  duration: number
  fromX: number
  fromY: number
  toX: number
  toY: number
}

interface PulseEffect {
  nodeId: string
  startTime: number
  duration: number
  ringCount: number
}

export function useNodeAnimations() {
  const enterAnimations = new Map<string, EnterAnimation>()
  const exitAnimations = new Map<string, ExitAnimation>()
  const moveAnimations = new Map<string, MoveAnimation>()
  const pulseEffects = new Map<string, PulseEffect>()

  // Hover progress per node (interpolated 0→1)
  const hoverProgress = new Map<string, number>()

  // Selection progress per node (interpolated 0→1)
  const selectionProgress = new Map<string, number>()

  // Whether reduced motion is active
  let reducedMotion = false

  function setReducedMotion(value: boolean) {
    reducedMotion = value
  }

  /**
   * Trigger enter animation for a single node
   */
  function enterNode(nodeId: string, source: 'user' | 'ai' = 'user') {
    if (reducedMotion) return

    enterAnimations.set(nodeId, {
      nodeId,
      startTime: performance.now(),
      duration: source === 'ai' ? 400 : 250,
      source
    })
  }

  /**
   * Trigger enter animation for a batch of nodes with stagger
   */
  function enterNodesBatch(nodeIds: string[], staggerMs: number = 60, source: 'user' | 'ai' = 'ai') {
    if (reducedMotion) return

    const baseTime = performance.now()
    nodeIds.forEach((id, index) => {
      enterAnimations.set(id, {
        nodeId: id,
        startTime: baseTime + index * staggerMs,
        duration: source === 'ai' ? 400 : 250,
        source
      })
    })
  }

  /**
   * Trigger exit animation — stores a snapshot of the node for ghost rendering
   */
  function exitNode(nodeId: string, snapshot: ExitAnimation['snapshot']) {
    if (reducedMotion) return

    exitAnimations.set(nodeId, {
      nodeId,
      startTime: performance.now(),
      duration: 200,
      snapshot
    })

    // Clean up other animation state
    enterAnimations.delete(nodeId)
    moveAnimations.delete(nodeId)
    hoverProgress.delete(nodeId)
    selectionProgress.delete(nodeId)
  }

  /**
   * Trigger move animation (e.g., layout change)
   */
  function moveNode(nodeId: string, fromX: number, fromY: number, toX: number, toY: number) {
    if (reducedMotion) return

    moveAnimations.set(nodeId, {
      nodeId,
      startTime: performance.now(),
      duration: 350,
      fromX, fromY, toX, toY
    })
  }

  /**
   * Trigger pulse effect on a node (attention-grabbing rings)
   */
  function pulseNode(nodeId: string) {
    if (reducedMotion) return

    pulseEffects.set(nodeId, {
      nodeId,
      startTime: performance.now(),
      duration: 600,
      ringCount: 2
    })
  }

  /**
   * Update all animation states — call once per frame with delta time
   */
  function update(dt: number, hoveredNodeId: string | null, selectedNodeIds: Set<string>) {
    const now = performance.now()

    // Clean up completed enter animations
    for (const [id, anim] of enterAnimations) {
      if (now - anim.startTime > anim.duration) {
        enterAnimations.delete(id)
      }
    }

    // Clean up completed exit animations
    for (const [id, anim] of exitAnimations) {
      if (now - anim.startTime > anim.duration) {
        exitAnimations.delete(id)
      }
    }

    // Clean up completed move animations
    for (const [id, anim] of moveAnimations) {
      if (now - anim.startTime > anim.duration) {
        moveAnimations.delete(id)
      }
    }

    // Clean up completed pulses
    for (const [id, pulse] of pulseEffects) {
      if (now - pulse.startTime > pulse.duration) {
        pulseEffects.delete(id)
      }
    }

    // Interpolate hover progress
    const lerpSpeed = 8 * dt
    // Update existing hover states
    for (const [nodeId, progress] of hoverProgress) {
      const isHovered = nodeId === hoveredNodeId
      const target = isHovered ? 1 : 0
      const newProgress = lerp(progress, target, clamp(lerpSpeed, 0, 1))
      if (newProgress < 0.01 && !isHovered) {
        hoverProgress.delete(nodeId)
      } else {
        hoverProgress.set(nodeId, newProgress)
      }
    }
    // Start hover for newly hovered node
    if (hoveredNodeId && !hoverProgress.has(hoveredNodeId)) {
      hoverProgress.set(hoveredNodeId, 0)
    }

    // Interpolate selection progress
    for (const [nodeId, progress] of selectionProgress) {
      const isSelected = selectedNodeIds.has(nodeId)
      const target = isSelected ? 1 : 0
      const newProgress = lerp(progress, target, clamp(lerpSpeed, 0, 1))
      if (newProgress < 0.01 && !isSelected) {
        selectionProgress.delete(nodeId)
      } else {
        selectionProgress.set(nodeId, newProgress)
      }
    }
    // Start selection for newly selected nodes
    for (const nodeId of selectedNodeIds) {
      if (!selectionProgress.has(nodeId)) {
        selectionProgress.set(nodeId, 0)
      }
    }
  }

  /**
   * Get animated properties for a node (query during render)
   */
  function getAnimatedProps(nodeId: string): AnimatedProps {
    const now = performance.now()

    let opacity = 1
    let scaleX = 1
    let scaleY = 1
    let offsetX = 0
    let offsetY = 0

    // Enter animation
    const enter = enterAnimations.get(nodeId)
    if (enter) {
      const elapsed = now - enter.startTime
      if (elapsed < 0) {
        // Not started yet (staggered)
        opacity = 0
        scaleX = 0.8
        scaleY = 0.8
        offsetY = 8
      } else {
        const t = clamp(elapsed / enter.duration, 0, 1)
        const eased = enter.source === 'ai' ? easeOutBack(t) : easeOutCubic(t)
        opacity = eased
        scaleX = lerp(0.8, 1.0, eased)
        scaleY = lerp(0.8, 1.0, eased)
        offsetY = lerp(8, 0, easeOutCubic(t))
      }
    }

    // Move animation (additive offset)
    const move = moveAnimations.get(nodeId)
    if (move) {
      const t = clamp((now - move.startTime) / move.duration, 0, 1)
      const eased = easeOutQuart(t)
      offsetX += lerp(move.fromX - move.toX, 0, eased)
      offsetY += lerp(move.fromY - move.toY, 0, eased)
    }

    return {
      opacity,
      scaleX,
      scaleY,
      offsetX,
      offsetY,
      hoverProgress: hoverProgress.get(nodeId) ?? 0,
      selectionProgress: selectionProgress.get(nodeId) ?? 0
    }
  }

  /**
   * Get exiting nodes (ghosts) for rendering after deletion
   */
  function getExitingNodes(): Array<{
    nodeId: string
    opacity: number
    scale: number
    offsetY: number
    snapshot: ExitAnimation['snapshot']
  }> {
    const now = performance.now()
    const ghosts: Array<{
      nodeId: string
      opacity: number
      scale: number
      offsetY: number
      snapshot: ExitAnimation['snapshot']
    }> = []

    for (const [, anim] of exitAnimations) {
      const t = clamp((now - anim.startTime) / anim.duration, 0, 1)
      const eased = easeOutCubic(t)
      ghosts.push({
        nodeId: anim.nodeId,
        opacity: 1 - eased,
        scale: lerp(1.0, 0.85, eased),
        offsetY: lerp(0, 12, eased),
        snapshot: anim.snapshot
      })
    }

    return ghosts
  }

  /**
   * Get active pulse effects for rendering
   */
  function getActivePulses(): Array<{
    nodeId: string
    rings: Array<{ radius: number; opacity: number }>
  }> {
    const now = performance.now()
    const pulses: Array<{
      nodeId: string
      rings: Array<{ radius: number; opacity: number }>
    }> = []

    for (const [, pulse] of pulseEffects) {
      const t = clamp((now - pulse.startTime) / pulse.duration, 0, 1)
      const rings: Array<{ radius: number; opacity: number }> = []

      for (let i = 0; i < pulse.ringCount; i++) {
        const ringDelay = i * 0.15
        const ringT = clamp((t - ringDelay) / (1 - ringDelay), 0, 1)
        if (ringT > 0) {
          rings.push({
            radius: lerp(0, 40, easeOutCubic(ringT)),
            opacity: 1 - easeOutCubic(ringT)
          })
        }
      }

      if (rings.length > 0) {
        pulses.push({ nodeId: pulse.nodeId, rings })
      }
    }

    return pulses
  }

  /**
   * Check if any animations are currently active
   */
  function hasActiveAnimations(): boolean {
    return enterAnimations.size > 0 ||
           exitAnimations.size > 0 ||
           moveAnimations.size > 0 ||
           pulseEffects.size > 0 ||
           hoverProgress.size > 0 ||
           selectionProgress.size > 0
  }

  return {
    enterNode,
    enterNodesBatch,
    exitNode,
    moveNode,
    pulseNode,
    update,
    getAnimatedProps,
    getExitingNodes,
    getActivePulses,
    hasActiveAnimations,
    setReducedMotion
  }
}

export type NodeAnimationsAPI = ReturnType<typeof useNodeAnimations>
