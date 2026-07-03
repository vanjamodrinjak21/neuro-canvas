<script setup lang="ts">
import { gsap } from 'gsap'

/**
 * Survey-reticle cursor: a dot that sticks to the pointer and a ring that
 * trails it, expanding over interactive elements ([data-cursor="link"]).
 * Skipped entirely on touch devices and under prefers-reduced-motion.
 */
const enabled = ref(false)
const dot = ref<HTMLElement>()
const ring = ref<HTMLElement>()

const pos = { x: -100, y: -100 }
const ringPos = { x: -100, y: -100 }
let hovering = false
let raf = 0

const onMove = (e: PointerEvent) => {
  pos.x = e.clientX
  pos.y = e.clientY
  hovering = !!(e.target as Element | null)?.closest?.('[data-cursor="link"], a, button')
}

const tick = () => {
  const k = 0.22
  ringPos.x += (pos.x - ringPos.x) * k
  ringPos.y += (pos.y - ringPos.y) * k
  if (dot.value) dot.value.style.transform = `translate(${pos.x}px, ${pos.y}px)`
  if (ring.value) {
    const s = hovering ? 1.8 : 1
    ring.value.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) scale(${s})`
  }
}

onMounted(() => {
  const fine = window.matchMedia('(pointer: fine)').matches
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!fine || reduced) return
  enabled.value = true
  document.documentElement.classList.add('has-reticle') // hides the OS cursor
  window.addEventListener('pointermove', onMove, { passive: true })
  gsap.ticker.add(tick)
  raf = 1
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('has-reticle')
  window.removeEventListener('pointermove', onMove)
  if (raf) gsap.ticker.remove(tick)
})
</script>

<template>
  <div v-if="enabled" class="reticle" aria-hidden="true">
    <div ref="ring" class="reticle__ring" />
    <div ref="dot" class="reticle__dot" />
  </div>
</template>
