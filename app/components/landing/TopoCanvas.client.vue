<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TopoScene } from '~/lib/topo-scene/topo-scene'

/**
 * Client-only bridge to the topographic neural map: one ScrollTrigger
 * spanning the document drives the journey pan/reveal, gsap's ticker
 * drives rendering, pointer moves deform the terrain.
 */
const canvas = ref<HTMLCanvasElement>()
const failed = ref(false)

let scene: TopoScene | null = null
let trigger: ScrollTrigger | null = null
let intro: gsap.core.Tween | null = null
let visible = true

const tick = (_time: number, deltaTime: number) => {
  if (visible) scene?.update(deltaTime / 1000)
}

const onPointerMove = (e: PointerEvent) => scene?.setPointer(e.clientX, e.clientY)
const onPointerLeave = () => scene?.pointerLeave()
const onResize = () => scene?.resize()
const onVisibility = () => {
  visible = document.visibilityState === 'visible'
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  // .client components mount before their template is rendered — wait a tick
  await nextTick()
  if (!canvas.value) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  try {
    scene = new TopoScene(canvas.value, { reducedMotion })
  } catch {
    // No WebGL — the page stays a readable dark landing.
    failed.value = true
    return
  }

  // page transitions can mount this at zero size — track the real box
  resizeObserver = new ResizeObserver(() => scene?.resize())
  resizeObserver.observe(canvas.value)

  gsap.registerPlugin(ScrollTrigger)
  trigger = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => scene?.setTargetProgress(self.progress),
  })

  // the first cluster surfaces on load, before any scrolling
  const proxy = { v: 0 }
  intro = gsap.to(proxy, {
    v: 0.14,
    duration: reducedMotion ? 0 : 2.6,
    delay: reducedMotion ? 0 : 0.3,
    ease: 'power2.out',
    onUpdate: () => scene?.setIntroReveal(proxy.v),
  })

  gsap.ticker.add(tick)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  gsap.ticker.remove(tick)
  window.removeEventListener('pointermove', onPointerMove)
  document.documentElement.removeEventListener('pointerleave', onPointerLeave)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibility)
  trigger?.kill()
  intro?.kill()
  scene?.dispose()
  scene = null
})
</script>

<template>
  <div v-show="!failed" class="webgl-layer" aria-hidden="true">
    <canvas ref="canvas" />
  </div>
</template>
