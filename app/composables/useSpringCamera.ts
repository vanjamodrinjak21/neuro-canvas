// Core spring physics camera composable
// Provides smooth, physically-based camera transitions with multiple presets

import type { Camera } from '~/types/canvas'
import { clamp } from '~/utils/easings'

export interface SpringConfig {
  stiffness: number   // Spring force (higher = snappier)
  damping: number     // Friction (higher = less oscillation)
  mass: number        // Inertia (higher = slower response)
  restThreshold: number // Velocity threshold to consider "at rest"
}

export interface SpringPresets {
  navigation: SpringConfig
  snappy: SpringConfig
  momentum: SpringConfig
  elastic: SpringConfig
  instant: SpringConfig
}

const presets: SpringPresets = {
  navigation: { stiffness: 180, damping: 24, mass: 1, restThreshold: 0.01 },
  snappy: { stiffness: 300, damping: 30, mass: 1, restThreshold: 0.01 },
  momentum:   { stiffness: 80,  damping: 17, mass: 1, restThreshold: 0.5  },
  elastic: { stiffness: 120, damping: 14, mass: 1, restThreshold: 0.01 },
  instant: { stiffness: 1000, damping: 100, mass: 1, restThreshold: 0.01 }
}

interface SpringAxis {
  current: number
  target: number
  velocity: number
}

export function useSpringCamera(initial: Camera = { x: 0, y: 0, zoom: 1 }) {
  const camera = ref<Camera>({ ...initial })

  const springX: SpringAxis = { current: initial.x, target: initial.x, velocity: 0 }
  const springY: SpringAxis = { current: initial.y, target: initial.y, velocity: 0 }
  const springZoom: SpringAxis = { current: initial.zoom, target: initial.zoom, velocity: 0 }

  let activeConfig: SpringConfig = presets.navigation
  let animating = false
  let rafId: number | null = null
  let lastTime = 0

  // Whether reduced motion is active (set externally)
  let reducedMotion = false

  function setReducedMotion(value: boolean) {
    reducedMotion = value
  }

  function stepSpring(spring: SpringAxis, config: SpringConfig, dt: number): boolean {
    const displacement = spring.current - spring.target
    const springForce = -config.stiffness * displacement
    const dampingForce = -config.damping * spring.velocity
    const acceleration = (springForce + dampingForce) / config.mass

    spring.velocity += acceleration * dt
    spring.current += spring.velocity * dt

    // Check if at rest
    return Math.abs(spring.velocity) > config.restThreshold ||
           Math.abs(displacement) > config.restThreshold
  }

  function tick(time: number) {
    if (!animating) return

    if (lastTime === 0) lastTime = time
    const dt = Math.min((time - lastTime) / 1000, 0.064) // Cap at ~16fps minimum
    lastTime = time

    const movingX = stepSpring(springX, activeConfig, dt)
    const movingY = stepSpring(springY, activeConfig, dt)
    const movingZoom = stepSpring(springZoom, activeConfig, dt)

    camera.value = {
      x: springX.current,
      y: springY.current,
      zoom: clamp(springZoom.current, 0.1, 5.0)
    }

    if (movingX || movingY || movingZoom) {
      rafId = requestAnimationFrame(tick)
    } else {
      // Snap to target at rest
      springX.current = springX.target
      springY.current = springY.target
      springZoom.current = springZoom.target
      springX.velocity = 0
      springY.velocity = 0
      springZoom.velocity = 0
      camera.value = {
        x: springX.target,
        y: springY.target,
        zoom: clamp(springZoom.target, 0.1, 5.0)
      }
      animating = false
      rafId = null
      lastTime = 0
    }
  }

  function startAnimation() {
    if (!animating) {
      animating = true
      lastTime = 0
      rafId = requestAnimationFrame(tick)
    }
  }

  /**
   * Animate toward a target position using spring physics.
   * Used for: navigation commands, flyTo, keyboard nav
   */
  function setTarget(target: Partial<Camera>, preset: keyof SpringPresets = 'navigation') {
    activeConfig = reducedMotion ? presets.instant : presets[preset]

    if (target.x !== undefined) springX.target = target.x
    if (target.y !== undefined) springY.target = target.y
    if (target.zoom !== undefined) springZoom.target = target.zoom

    startAnimation()
  }

  /**
   * Instantly set camera position — no animation.
   * Used for: direct manipulation (dragging/panning)
   */
  function setCurrent(value: Camera) {
    springX.current = value.x
    springX.target = value.x
    springX.velocity = 0
    springY.current = value.y
    springY.target = value.y
    springY.velocity = 0
    springZoom.current = value.zoom
    springZoom.target = value.zoom
    springZoom.velocity = 0

    camera.value = {
      x: value.x,
      y: value.y,
      zoom: clamp(value.zoom, 0.1, 5.0)
    }
  }

  /**
   * Add velocity for momentum (e.g., on pan release).
   * The spring will decelerate naturally.
   */
  function addVelocity(vx: number, vy: number) {
    if (reducedMotion) return

    activeConfig = presets.momentum

    // Scale down velocity to reasonable levels for screen-space
    const scale = 0.3
    springX.velocity = vx * scale
    springY.velocity = vy * scale

    // Set target to current (momentum will carry past, spring will pull back)
    springX.target = springX.current
    springY.target = springY.current

    startAnimation()
  }

  /**
   * Stop all animation immediately.
   */
  function stop() {
    animating = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastTime = 0

    springX.velocity = 0
    springY.velocity = 0
    springZoom.velocity = 0
    springX.target = springX.current
    springY.target = springY.current
    springZoom.target = springZoom.current
  }

  /**
   * Get current spring state (for external inspection)
   */
  function isAnimating() {
    return animating
  }

  // Cleanup on unmount
  if (getCurrentInstance()) {
    onUnmounted(() => {
      stop()
    })
  }

  return {
    camera: camera as Ref<Camera>,
    setTarget,
    setCurrent,
    addVelocity,
    stop,
    isAnimating,
    setReducedMotion,
    presets
  }
}
