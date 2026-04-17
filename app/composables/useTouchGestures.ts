import { ref, type Ref } from 'vue'
import type { Camera, Node } from '~/types/canvas'

interface LongPressEvent {
  node: Node | null
  worldPos: { x: number; y: number }
  screenPos: { x: number; y: number }
}

interface DoubleTapEvent {
  node: Node | null
  worldPos: { x: number; y: number }
}

interface TouchDeps {
  camera: Camera
  emitCamera: (camera: Camera) => void
  pendingDrag: Ref<boolean>
  isDragging: Ref<boolean>
  isPanning: Ref<boolean>
  // Optional callbacks for advanced gestures
  onLongPress?: (event: LongPressEvent) => void
  onDoubleTap?: (event: DoubleTapEvent) => void
  // Helper to find node at screen position (provided by canvas)
  hitTest?: (screenX: number, screenY: number) => Node | null
  // Helper to convert screen coords to world coords
  screenToWorld?: (screenX: number, screenY: number) => { x: number; y: number }
}

/** Euclidean distance between two touch points */
function getDistance(t0: Touch, t1: Touch): number {
  const dx = t0.clientX - t1.clientX
  const dy = t0.clientY - t1.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/** Midpoint between two touch points */
function getMidpoint(t0: Touch, t1: Touch): { x: number; y: number } {
  return {
    x: (t0.clientX + t1.clientX) / 2,
    y: (t0.clientY + t1.clientY) / 2,
  }
}

export function useTouchGestures(deps: TouchDeps) {
  // ── Pinch-zoom state ──
  const touchStartDistance = ref(0)
  const touchStartZoom = ref(1)

  // ── Two-finger pan state ──
  const touchStartMidpoint = ref<{ x: number; y: number } | null>(null)
  const touchStartCameraX = ref(0)
  const touchStartCameraY = ref(0)

  // ── Long-press state ──
  const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const longPressOrigin = ref<{ x: number; y: number } | null>(null)
  const LONG_PRESS_DELAY = 500
  const LONG_PRESS_MOVE_TOLERANCE = 10

  // ── Double-tap state ──
  const lastTapTime = ref(0)
  const lastTapPos = ref<{ x: number; y: number } | null>(null)
  const DOUBLE_TAP_WINDOW = 300
  const DOUBLE_TAP_RADIUS = 30

  function cancelLongPress() {
    if (longPressTimer.value !== null) {
      clearTimeout(longPressTimer.value)
      longPressTimer.value = null
    }
    longPressOrigin.value = null
  }

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      // Two-finger gesture — cancel single-finger state
      cancelLongPress()
      deps.pendingDrag.value = false
      deps.isDragging.value = false
      deps.isPanning.value = false

      const touch0 = event.touches[0]
      const touch1 = event.touches[1]
      if (!touch0 || !touch1) return

      touchStartDistance.value = getDistance(touch0, touch1)
      touchStartZoom.value = deps.camera.zoom
      touchStartMidpoint.value = getMidpoint(touch0, touch1)
      touchStartCameraX.value = deps.camera.x
      touchStartCameraY.value = deps.camera.y

      event.preventDefault()
      return
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0]
      if (!touch) return

      const screenX = touch.clientX
      const screenY = touch.clientY

      // ── Long-press detection ──
      if (deps.onLongPress) {
        longPressOrigin.value = { x: screenX, y: screenY }
        longPressTimer.value = setTimeout(() => {
          longPressTimer.value = null
          const worldPos = deps.screenToWorld
            ? deps.screenToWorld(screenX, screenY)
            : { x: screenX, y: screenY }
          const node = deps.hitTest
            ? deps.hitTest(screenX, screenY)
            : null
          deps.onLongPress!({
            node,
            worldPos,
            screenPos: { x: screenX, y: screenY },
          })
        }, LONG_PRESS_DELAY)
      }

      // ── Double-tap detection ──
      if (deps.onDoubleTap) {
        const now = Date.now()
        const prev = lastTapPos.value
        if (
          prev
          && now - lastTapTime.value < DOUBLE_TAP_WINDOW
          && Math.hypot(screenX - prev.x, screenY - prev.y) < DOUBLE_TAP_RADIUS
        ) {
          // Double-tap confirmed
          const worldPos = deps.screenToWorld
            ? deps.screenToWorld(screenX, screenY)
            : { x: screenX, y: screenY }
          const node = deps.hitTest
            ? deps.hitTest(screenX, screenY)
            : null
          deps.onDoubleTap({ node, worldPos })

          // Reset so a third tap doesn't re-trigger
          lastTapTime.value = 0
          lastTapPos.value = null
          cancelLongPress()
        }
        // Record this tap as potential first tap of a double-tap
        // (actual recording happens in handleTouchEnd for clean taps)
      }
    }
  }

  function handleTouchMove(event: TouchEvent) {
    // ── Cancel long-press if finger moved too far ──
    if (event.touches.length === 1 && longPressOrigin.value) {
      const touch = event.touches[0]
      if (touch) {
        const dx = touch.clientX - longPressOrigin.value.x
        const dy = touch.clientY - longPressOrigin.value.y
        if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
          cancelLongPress()
        }
      }
    }

    // ── Two-finger gesture: zoom and/or pan ──
    if (event.touches.length === 2 && touchStartDistance.value > 0) {
      event.preventDefault()
      const touch0 = event.touches[0]
      const touch1 = event.touches[1]
      if (!touch0 || !touch1) return

      const currentDistance = getDistance(touch0, touch1)
      const currentMidpoint = getMidpoint(touch0, touch1)
      const distanceRatio = currentDistance / touchStartDistance.value

      // Determine what kind of gesture this is
      const isZoom = distanceRatio < 0.85 || distanceRatio > 1.15
      const startMid = touchStartMidpoint.value

      let newZoom = deps.camera.zoom
      let newX = deps.camera.x
      let newY = deps.camera.y

      // Apply zoom if fingers are spreading/pinching
      if (isZoom) {
        newZoom = Math.max(0.1, Math.min(5, touchStartZoom.value * distanceRatio))
      }

      // Apply pan from midpoint translation (always, so combined gestures work)
      if (startMid) {
        const midDx = currentMidpoint.x - startMid.x
        const midDy = currentMidpoint.y - startMid.y
        newX = touchStartCameraX.value + midDx
        newY = touchStartCameraY.value + midDy
      }

      deps.emitCamera({
        ...deps.camera,
        x: newX,
        y: newY,
        zoom: newZoom,
      })
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    // ── Record tap for double-tap detection ──
    // Only record when all fingers are lifted (a clean single-finger lift)
    if (event.touches.length === 0 && deps.onDoubleTap) {
      const changedTouch = event.changedTouches[0]
      if (changedTouch) {
        lastTapTime.value = Date.now()
        lastTapPos.value = { x: changedTouch.clientX, y: changedTouch.clientY }
      }
    }

    cancelLongPress()

    // Reset two-finger state when all fingers are lifted
    if (event.touches.length === 0) {
      touchStartDistance.value = 0
      touchStartMidpoint.value = null
    }
  }

  return { handleTouchStart, handleTouchMove, handleTouchEnd }
}
