<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

/**
 * Chrome for landing-styled subpages: nav, footer, reticle cursor and the
 * Lenis smooth-scroll bus — mirrors the standalone landing's default layout.
 * Used as a wrapper component because the app renders <NuxtPage> without
 * <NuxtLayout>.
 */
const router = useRouter()

let lenis: Lenis | null = null
let lenisTick: ((time: number) => void) | null = null

/** Single scroll bus for nav and footer — with a cross-page fallback:
 * anchors that don't exist here navigate home and scroll there. */
const scrollToTarget = (target: string) => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
  if (target === '#top') {
    if (lenis) lenis.scrollTo(0, { duration: 1.6 })
    else window.scrollTo({ top: 0, behavior })
    return
  }
  const el = document.querySelector<HTMLElement>(target)
  if (el) {
    if (lenis) lenis.scrollTo(el, { duration: 1.6 })
    else el.scrollIntoView({ behavior })
    return
  }
  // section lives on the landing — go there and carry the hash
  router.push({ path: '/', hash: target })
}
provide('journey-scroll', scrollToTarget)
provide('journey-lock', (locked: boolean) => {
  if (!lenis) return
  if (locked) lenis.stop()
  else lenis.start()
})

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  gsap.registerPlugin(ScrollTrigger)

  if (!reducedMotion) {
    // Lenis drives ScrollTrigger; gsap's ticker drives Lenis — one RAF loop.
    lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenis.on('scroll', ScrollTrigger.update)
    lenisTick = (time: number) => lenis?.raf(time * 1000)
    gsap.ticker.add(lenisTick)
    gsap.ticker.lagSmoothing(0)
  }
})

onBeforeUnmount(() => {
  if (lenisTick) gsap.ticker.remove(lenisTick)
  lenis?.destroy()
  lenis = null
})
</script>

<template>
  <div class="lp">
    <LandingCursorReticle />
    <LandingSiteNav />
    <slot />
    <LandingSiteFooter />
  </div>
</template>
