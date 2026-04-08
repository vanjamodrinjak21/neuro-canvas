import { ref, type Ref } from 'vue'
import type { Camera } from '~/types/canvas'

interface TouchDeps {
  camera: Camera
  emitCamera: (camera: Camera) => void
  pendingDrag: Ref<boolean>
  isDragging: Ref<boolean>
  isPanning: Ref<boolean>
}

export function useTouchGestures(deps: TouchDeps) {
  const touchStartDistance = ref(0)
  const touchStartZoom = ref(1)

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      // Pinch zoom start — cancel any single-finger drag in progress
      deps.pendingDrag.value = false
      deps.isDragging.value = false
      deps.isPanning.value = false

      const touch0 = event.touches[0]
      const touch1 = event.touches[1]
      if (!touch0 || !touch1) return
      const dx = touch0.clientX - touch1.clientX
      const dy = touch0.clientY - touch1.clientY
      touchStartDistance.value = Math.sqrt(dx * dx + dy * dy)
      touchStartZoom.value = deps.camera.zoom
      event.preventDefault()
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (event.touches.length === 2 && touchStartDistance.value > 0) {
      // Pinch zoom
      event.preventDefault()
      const touch0 = event.touches[0]
      const touch1 = event.touches[1]
      if (!touch0 || !touch1) return
      const dx = touch0.clientX - touch1.clientX
      const dy = touch0.clientY - touch1.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)

      const scale = distance / touchStartDistance.value
      const newZoom = Math.max(0.1, Math.min(5, touchStartZoom.value * scale))

      deps.emitCamera({
        ...deps.camera,
        zoom: newZoom,
      })
    }
  }

  function handleTouchEnd() {
    touchStartDistance.value = 0
  }

  return { handleTouchStart, handleTouchMove, handleTouchEnd }
}
