import { ref, computed } from 'vue'
import type { Anchor } from '~/types'

/**
 * Animation state management for connection creation
 * Handles line draw, pulse travel, and anchor pop animations
 */

// Animation timing constants — tuned for smooth, premium feel
const LINE_DRAW_DURATION = 500    // ms — slower line draw for elegance
const PULSE_DELAY = 100           // ms — tight follow after line starts
const PULSE_DURATION = 600        // ms — leisurely pulse travel with trail
const ANCHOR_POP_DURATION = 400   // ms — gentle anchor settle

export interface ConnectionAnimation {
  id: string
  edgeId: string
  startTime: number
  sourceNodeId: string
  targetNodeId: string
  sourceAnchor: Anchor
  targetAnchor: Anchor
}

export interface AnchorAnimation {
  nodeId: string
  anchor: Anchor
  type: 'appear' | 'pop'
  startTime: number
}

// Global animation state
const activeConnectionAnimations = ref<ConnectionAnimation[]>([])
const activeAnchorAnimations = ref<AnchorAnimation[]>([])
let animationFrameId: number | null = null

/**
 * Easing: ease out quart — smooth deceleration, more gradual than cubic
 */
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

/**
 * Easing: ease in-out sine — gentle start and end for pulse travel
 */
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2
}

/**
 * Easing: ease out back — slight overshoot then settle (for anchor pop)
 */
function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/**
 * Get line draw progress (0-1) for a connection animation
 */
export function getLineDrawProgress(animation: ConnectionAnimation, currentTime: number): number {
  const elapsed = currentTime - animation.startTime
  const progress = Math.min(1, elapsed / LINE_DRAW_DURATION)
  return easeOutQuart(progress)
}

/**
 * Get pulse progress (0-1, or -1 if not started yet)
 * Uses ease-in-out for smooth acceleration and deceleration along the path
 */
export function getPulseProgress(animation: ConnectionAnimation, currentTime: number): number {
  const elapsed = currentTime - animation.startTime

  if (elapsed < PULSE_DELAY) {
    return -1
  }

  const pulseElapsed = elapsed - PULSE_DELAY
  const progress = Math.min(1, pulseElapsed / PULSE_DURATION)
  return easeInOutSine(progress)
}

/**
 * Get anchor animation scale (1 = normal, >1 = popped)
 */
export function getAnchorScale(nodeId: string, anchor: Anchor, currentTime: number): number {
  const animation = activeAnchorAnimations.value.find(
    a => a.nodeId === nodeId && a.anchor === anchor
  )

  if (!animation) return 1

  const elapsed = currentTime - animation.startTime
  const progress = Math.min(1, elapsed / ANCHOR_POP_DURATION)

  if (animation.type === 'appear') {
    // Scale from 0 to 1 with gentle overshoot via easeOutBack
    return easeOutBack(progress)
  } else {
    // Pop: scale 1 → 1.3 → 1 with smooth sine curve
    const popT = easeInOutSine(progress)
    return 1 + 0.3 * Math.sin(popT * Math.PI)
  }
}

/**
 * Start a connection creation animation
 */
export function startConnectionAnimation(
  edgeId: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceAnchor: Anchor,
  targetAnchor: Anchor
): string {
  const id = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const animation: ConnectionAnimation = {
    id,
    edgeId,
    startTime: performance.now(),
    sourceNodeId,
    targetNodeId,
    sourceAnchor,
    targetAnchor
  }

  activeConnectionAnimations.value.push(animation)

  // Also trigger anchor pop animations
  triggerAnchorPop(sourceNodeId, sourceAnchor)
  triggerAnchorPop(targetNodeId, targetAnchor)

  // Start animation loop if not running
  startAnimationLoop()

  return id
}

/**
 * Trigger an anchor appear animation
 */
export function triggerAnchorAppear(nodeId: string, anchor: Anchor): void {
  // Remove any existing animation for this anchor
  activeAnchorAnimations.value = activeAnchorAnimations.value.filter(
    a => !(a.nodeId === nodeId && a.anchor === anchor)
  )

  activeAnchorAnimations.value.push({
    nodeId,
    anchor,
    type: 'appear',
    startTime: performance.now()
  })

  startAnimationLoop()
}

/**
 * Trigger anchor appear animations for multiple anchors
 */
export function triggerAnchorsAppear(nodeId: string, anchors: Anchor[]): void {
  for (const anchor of anchors) {
    triggerAnchorAppear(nodeId, anchor)
  }
}

/**
 * Trigger an anchor pop animation (on connection)
 */
export function triggerAnchorPop(nodeId: string, anchor: Anchor): void {
  // Remove any existing animation for this anchor
  activeAnchorAnimations.value = activeAnchorAnimations.value.filter(
    a => !(a.nodeId === nodeId && a.anchor === anchor)
  )

  activeAnchorAnimations.value.push({
    nodeId,
    anchor,
    type: 'pop',
    startTime: performance.now()
  })

  startAnimationLoop()
}

/**
 * Check if an edge is currently animating
 */
export function isEdgeAnimating(edgeId: string): boolean {
  return activeConnectionAnimations.value.some(a => a.edgeId === edgeId)
}

/**
 * Get the active animation for an edge
 */
export function getEdgeAnimation(edgeId: string): ConnectionAnimation | undefined {
  return activeConnectionAnimations.value.find(a => a.edgeId === edgeId)
}

/**
 * Clean up completed animations
 */
function cleanupAnimations(currentTime: number): void {
  const totalConnectionDuration = PULSE_DELAY + PULSE_DURATION + 100 // Extra buffer
  const totalAnchorDuration = ANCHOR_POP_DURATION + 100

  activeConnectionAnimations.value = activeConnectionAnimations.value.filter(
    a => currentTime - a.startTime < totalConnectionDuration
  )

  activeAnchorAnimations.value = activeAnchorAnimations.value.filter(
    a => currentTime - a.startTime < totalAnchorDuration
  )
}

/**
 * Animation loop
 */
let onFrameCallbacks: Array<(time: number) => void> = []

function animationLoop(): void {
  const currentTime = performance.now()

  // Clean up completed animations
  cleanupAnimations(currentTime)

  // Call frame callbacks
  for (const callback of onFrameCallbacks) {
    callback(currentTime)
  }

  // Continue loop if there are active animations
  if (activeConnectionAnimations.value.length > 0 || activeAnchorAnimations.value.length > 0) {
    animationFrameId = requestAnimationFrame(animationLoop)
  } else {
    animationFrameId = null
  }
}

function startAnimationLoop(): void {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(animationLoop)
  }
}

/**
 * Register a callback to be called on each animation frame
 */
export function onAnimationFrame(callback: (time: number) => void): () => void {
  onFrameCallbacks.push(callback)

  // Return cleanup function
  return () => {
    onFrameCallbacks = onFrameCallbacks.filter(cb => cb !== callback)
  }
}

/**
 * Composable hook for connection animations
 */
export function useConnectionAnimation() {
  const hasActiveAnimations = computed(() =>
    activeConnectionAnimations.value.length > 0 ||
    activeAnchorAnimations.value.length > 0
  )

  return {
    // State
    activeConnectionAnimations,
    activeAnchorAnimations,
    hasActiveAnimations,

    // Functions
    startConnectionAnimation,
    triggerAnchorAppear,
    triggerAnchorsAppear,
    triggerAnchorPop,
    isEdgeAnimating,
    getEdgeAnimation,
    getLineDrawProgress,
    getPulseProgress,
    getAnchorScale,
    onAnimationFrame
  }
}
