/**
 * Circular clip-path "theme swipe" reveal animation.
 *
 * Returns an `overlayRef` to bind to a full-screen overlay `<div>`, plus a
 * `reveal(btn, onSwap)` that grows a colored circle out of the clicked button,
 * runs `onSwap` (the actual theme change) at the apex, then fades the overlay
 * out. Re-entrancy is guarded internally.
 *
 * Extracted from the byte-for-byte-identical copies in AppSidebar.vue and
 * settings.vue. The overlay element and its CSS stay in each component; this
 * only drives the inline animation styles.
 */
export function useThemeReveal() {
  const overlayRef = ref<HTMLDivElement | null>(null)
  const animating = ref(false)

  function reveal(btn: HTMLElement | null, onSwap: () => void) {
    if (animating.value) return
    animating.value = true

    if (!btn || typeof window === 'undefined') {
      onSwap()
      animating.value = false
      return
    }

    const rect = btn.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const maxX = Math.max(cx, window.innerWidth - cx)
    const maxY = Math.max(cy, window.innerHeight - cy)
    const maxRadius = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY))

    const overlay = overlayRef.value
    if (!overlay) {
      onSwap()
      animating.value = false
      return
    }

    overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`
    overlay.style.display = 'block'
    overlay.style.opacity = '1'

    // Force reflow so the 0px clip-path is committed before transitioning.
    void overlay.offsetHeight

    overlay.style.transition = 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)'
    overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`

    setTimeout(() => {
      onSwap()
      setTimeout(() => {
        overlay.style.transition = 'opacity 300ms ease'
        overlay.style.opacity = '0'
        setTimeout(() => {
          overlay.style.display = 'none'
          overlay.style.transition = ''
          overlay.style.clipPath = ''
          animating.value = false
        }, 300)
      }, 60)
    }, 480)
  }

  return { overlayRef, reveal }
}
