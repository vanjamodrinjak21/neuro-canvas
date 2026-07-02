// Lenis smooth-scroll singleton bridged to GSAP ScrollTrigger.
//
// One Lenis instance drives the whole page; GSAP's ticker drives Lenis
// (single rAF loop) and Lenis feeds ScrollTrigger on every scroll — the
// canonical bridge so scroll-linked animation stays perfectly in sync.
//
// The singleton no-ops (init() returns null, `lenis` stays null) when:
//   - the user prefers reduced motion,
//   - the viewport is narrower than 768px,
//   - running inside a native shell (Tauri / Capacitor) — reuses the
//     platform detection from usePlatform().
import { shallowRef } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { usePlatform } from '~/composables/usePlatform'
import { useReducedMotion } from '~/composables/useReducedMotion'

// Module-level singleton state — shared across all callers.
const lenisRef = shallowRef<Lenis | null>(null)
let tickerCallback: ((time: number) => void) | null = null
let pluginRegistered = false

function registerScrollTrigger(): void {
  if (pluginRegistered) return
  gsap.registerPlugin(ScrollTrigger)
  pluginRegistered = true
}

/** Recompute ScrollTrigger positions (after fonts load, rail mount, etc.). */
export function refreshScrollTriggers(): void {
  if (typeof window === 'undefined') return
  registerScrollTrigger()
  ScrollTrigger.refresh()
}

export function useLenis() {
  const { isNative } = usePlatform()
  const { isReduced } = useReducedMotion()

  function shouldEnable(): boolean {
    if (typeof window === 'undefined') return false
    if (isReduced.value) return false
    if (window.innerWidth < 768) return false
    if (isNative.value) return false
    return true
  }

  /**
   * Initialize the singleton. Returns the shared Lenis instance, or null
   * when smooth scroll is gated off (reduced motion / narrow / native).
   * Guarded against double init — subsequent calls return the existing
   * instance without re-wiring the ticker.
   */
  function init(): Lenis | null {
    if (lenisRef.value) return lenisRef.value
    if (!shouldEnable()) return null

    registerScrollTrigger()

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
    })

    lenis.on('scroll', () => ScrollTrigger.update())
    tickerCallback = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tickerCallback)
    gsap.ticker.lagSmoothing(0)

    lenisRef.value = lenis
    return lenis
  }

  /** Tear the singleton down and detach it from GSAP's ticker. */
  function destroy(): void {
    const lenis = lenisRef.value
    if (!lenis) return
    if (tickerCallback) {
      gsap.ticker.remove(tickerCallback)
      tickerCallback = null
    }
    // lagSmoothing(0) is a global GSAP side effect — restore the library
    // defaults so animations elsewhere in the SPA regain frame-skip
    // protection after leaving the landing page.
    gsap.ticker.lagSmoothing(500, 33)
    lenis.destroy()
    lenisRef.value = null
  }

  return {
    /** Shared Lenis instance — null until init(), or always null when gated. */
    lenis: lenisRef,
    init,
    destroy,
    shouldEnable,
  }
}
