// Smooth zoom composable — accumulates wheel deltas, applies via spring camera
// Rubber-band effect at soft limits, hard clamp at absolute limits

import type { Camera } from '~/types/canvas'
import { clamp } from '~/utils/easings'

interface SmoothZoomOptions {
  softMin: number     // Soft zoom limit (rubber-band starts)
  softMax: number
  hardMin: number     // Hard zoom limit (absolute clamp)
  hardMax: number
  sensitivity: number // Wheel delta multiplier
}

const defaultOptions: SmoothZoomOptions = {
  softMin: 0.15,
  softMax: 4.0,
  hardMin: 0.1,
  hardMax: 5.0,
  sensitivity: 0.002
}

export function useSmoothZoom(
  springCamera: {
    camera: Ref<Camera>
    setTarget: (target: Partial<Camera>, preset?: string) => void
    setCurrent: (value: Camera) => void
  },
  opts: Partial<SmoothZoomOptions> = {}
) {
  const options = { ...defaultOptions, ...opts }

  let accumulatedDelta = 0
  let rafPending = false
  let lastMouseX = 0
  let lastMouseY = 0
  let containerRect: DOMRect | null = null

  // Whether reduced motion is active
  let reducedMotion = false

  function setReducedMotion(value: boolean) {
    reducedMotion = value
  }

  function setContainerRect(rect: DOMRect) {
    containerRect = rect
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault()

    lastMouseX = event.clientX
    lastMouseY = event.clientY

    // Accumulate delta (normalize across browsers)
    const delta = event.deltaY * options.sensitivity
    accumulatedDelta += delta

    if (!rafPending) {
      rafPending = true
      requestAnimationFrame(applyZoom)
    }
  }

  function applyZoom() {
    rafPending = false

    if (Math.abs(accumulatedDelta) < 0.0001) return

    const cam = springCamera.camera.value
    const rect = containerRect

    // Mouse position relative to container
    const mouseX = rect ? lastMouseX - rect.left : lastMouseX
    const mouseY = rect ? lastMouseY - rect.top : lastMouseY

    // Calculate new zoom
    let newZoom = cam.zoom * Math.exp(-accumulatedDelta)

    // Rubber-band at soft limits
    if (newZoom < options.softMin) {
      // Rubber-band: the further past soft limit, the more resistance
      const overshoot = options.softMin - newZoom
      newZoom = options.softMin - overshoot * 0.3
    } else if (newZoom > options.softMax) {
      const overshoot = newZoom - options.softMax
      newZoom = options.softMax + overshoot * 0.3
    }

    // Hard clamp
    newZoom = clamp(newZoom, options.hardMin, options.hardMax)

    // Zoom towards mouse position
    const zoomRatio = newZoom / cam.zoom
    const newX = mouseX - (mouseX - cam.x) * zoomRatio
    const newY = mouseY - (mouseY - cam.y) * zoomRatio

    // Reset accumulated delta
    accumulatedDelta = 0

    if (reducedMotion) {
      springCamera.setCurrent({ x: newX, y: newY, zoom: newZoom })
    } else {
      // Apply instantly during continuous scrolling for responsiveness
      springCamera.setCurrent({ x: newX, y: newY, zoom: newZoom })
    }

    // If zoom is past soft limits, spring back
    if (newZoom < options.softMin || newZoom > options.softMax) {
      const clampedZoom = clamp(newZoom, options.softMin, options.softMax)
      const snapRatio = clampedZoom / newZoom
      springCamera.setTarget({
        x: mouseX - (mouseX - newX) * snapRatio,
        y: mouseY - (mouseY - newY) * snapRatio,
        zoom: clampedZoom
      }, 'elastic')
    }
  }

  return {
    handleWheel,
    setContainerRect,
    setReducedMotion
  }
}
