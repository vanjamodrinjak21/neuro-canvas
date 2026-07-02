<script setup lang="ts">
// Scroll-scrubbed frame-sequence renderer.
//
// Layers a <canvas> over an eagerly-loaded poster <picture> (the LCP
// element). The poster stays visible until the first bitmap is drawn,
// then fades out. Frames are blitted with object-fit:cover math; the
// canvas backing store is container-size × min(devicePixelRatio, 2).
//
// Deliberately no continuous rAF loop: the canvas redraws only when the
// resolved frame index or the container size changes. No shadowBlur, no
// canvas filters — both are WKWebView performance killers.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { coverSourceRect, useFrameSequence } from '~/composables/useFrameSequence'

const props = withDefaults(defineProps<{
  /** Scroll progress through the sequence, 0..1. */
  progress: number
  manifestUrl?: string
  posterAvif?: string
  posterJpg?: string
  /** Meaningful alt for the poster (the sequence's LCP element). */
  posterAlt?: string
}>(), {
  manifestUrl: '/landing/seq/manifest.json',
  posterAvif: '/landing/poster.avif',
  posterJpg: '/landing/poster.jpg',
  posterAlt: '',
})

const emit = defineEmits<{
  ready: []
  unsupported: []
}>()

const rootEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const sequence = useFrameSequence({ manifestUrl: props.manifestUrl })
const { ready, unsupported, currentIndex, currentBitmap } = sequence

/** True once the first frame has actually been blitted to the canvas. */
const hasDrawn = ref(false)

let ctx: CanvasRenderingContext2D | null = null
let resizeObserver: ResizeObserver | null = null
let cssWidth = 0
let cssHeight = 0
let lastDrawnIndex = -1
let lastDrawnWidth = 0
let lastDrawnHeight = 0

function syncCanvasSize(): void {
  const canvas = canvasEl.value
  const root = rootEl.value
  if (!canvas || !root) return
  const rect = root.getBoundingClientRect()
  cssWidth = rect.width
  cssHeight = rect.height
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
  const width = Math.max(1, Math.round(cssWidth * dpr))
  const height = Math.max(1, Math.round(cssHeight * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

function draw(): void {
  const canvas = canvasEl.value
  const bitmap = currentBitmap.value
  if (!canvas || !bitmap) return
  if (!ctx) {
    ctx = canvas.getContext('2d', { alpha: false })
  }
  if (!ctx) return

  const { width, height } = canvas
  if (width === 0 || height === 0) return

  // Skip redundant blits — redraw only on frame or size change.
  const index = currentIndex.value
  if (index === lastDrawnIndex && width === lastDrawnWidth && height === lastDrawnHeight) return

  // Re-assert per blit: mutating canvas.width/height resets context state,
  // and the default 'low' quality visibly softens the resample.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const { sx, sy, sw, sh } = coverSourceRect(bitmap.width, bitmap.height, width, height)
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)

  lastDrawnIndex = index
  lastDrawnWidth = width
  lastDrawnHeight = height
  if (!hasDrawn.value) {
    hasDrawn.value = true
    emit('ready')
  }
}

watch(() => props.progress, (progress) => {
  sequence.setProgress(progress)
})

watch([currentBitmap, currentIndex], () => {
  draw()
})

watch(unsupported, (value) => {
  if (value) emit('unsupported')
})

// ── Idle warmup ──
// After the window load event (and only when the main thread is idle),
// decode the first frames into the cache so the scrub start is instant.
// requestIdleCallback where available; small timeout fallback for WebKit.
const WARMUP_FRAMES = 24

function runWarmup(): void {
  if (typeof window === 'undefined') return
  const kick = (): void => {
    void sequence.warmup(WARMUP_FRAMES)
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(kick, { timeout: 4000 })
  } else {
    window.setTimeout(kick, 350)
  }
}

function scheduleWarmup(): void {
  if (typeof window === 'undefined') return
  if (document.readyState === 'complete') {
    runWarmup()
    return
  }
  window.addEventListener('load', runWarmup, { once: true })
}

onMounted(() => {
  syncCanvasSize()
  if (rootEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncCanvasSize()
      draw()
    })
    resizeObserver.observe(rootEl.value)
  }
  void sequence.load().then((ok) => {
    if (ok) {
      sequence.setProgress(props.progress)
      scheduleWarmup()
    }
  })
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('load', runWarmup)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  ctx = null
})

defineExpose({ ready, hasDrawn, unsupported })
</script>

<template>
  <div ref="rootEl" class="scrub-seq">
    <canvas ref="canvasEl" class="scrub-seq-canvas" aria-hidden="true" />
    <picture class="scrub-seq-poster" :class="{ 'is-hidden': hasDrawn }">
      <source :srcset="posterAvif" type="image/avif">
      <img
        :src="posterJpg"
        :alt="posterAlt"
        loading="eager"
        fetchpriority="high"
        decoding="async"
        class="scrub-seq-poster-img"
      >
    </picture>
  </div>
</template>

<style scoped>
.scrub-seq {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #0A0A0C;
}

.scrub-seq-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.scrub-seq-poster {
  position: absolute;
  inset: 0;
  display: block;
  opacity: 1;
  transition: opacity 250ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  pointer-events: none;
}

.scrub-seq-poster.is-hidden {
  opacity: 0;
}

.scrub-seq-poster-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (prefers-reduced-motion: reduce) {
  .scrub-seq-poster {
    transition: none;
  }
}
</style>
