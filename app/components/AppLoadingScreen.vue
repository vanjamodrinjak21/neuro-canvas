<script setup lang="ts">
import type { TopoScene } from '~/lib/topo-scene/topo-scene'

/**
 * Native boot screen (Tauri desktop + Capacitor mobile).
 * The smallest possible mind map — three white thought-nodes — waking up
 * on the survey map: the landing's topographic terrain breathes behind it
 * (static camera, no pointer deformation), signals pulse between the
 * nodes, a hairline gauge tracks progress. SVG contour rings paint
 * instantly and stay as the no-WebGL fallback.
 *
 * API consumed by app.vue: props { status, progress }, exposed leave().
 */
interface Props {
  status?: string
  progress?: number
}

const props = withDefaults(defineProps<Props>(), {
  status: 'Loading...',
  progress: -1,
})

const mounted = ref(false)
const leaving = ref(false)
const root = ref<HTMLElement | null>(null)

// --- topographic backdrop (no mouse interaction) -------------------------
const bgCanvas = ref<HTMLCanvasElement | null>(null)
const webglOk = ref(false)

let scene: TopoScene | null = null
let ro: ResizeObserver | null = null
let raf = 0
let last = 0
let intro = 0
// event-driven flag, not visibilityState: rAF already pauses when hidden,
// and polling the live state skips frames in occluded-but-woken windows
let visible = true
const onVisibility = () => {
  visible = document.visibilityState === 'visible'
}

async function bootTopo() {
  if (!bgCanvas.value) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    // three stays out of the critical boot path — the SVG contours paint first
    const { TopoScene } = await import('~/lib/topo-scene/topo-scene')
    scene = new TopoScene(bgCanvas.value, { reducedMotion: reduced })
  } catch {
    return // no WebGL — the contour rings remain
  }
  scene.pointerLeave() // static map: the terrain never follows a cursor
  ro = new ResizeObserver(() => scene?.resize())
  ro.observe(bgCanvas.value)
  document.addEventListener('visibilitychange', onVisibility)
  webglOk.value = true
  last = performance.now()
  const loop = (t: number) => {
    const dt = Math.min((t - last) / 1000, 0.1)
    last = t
    if (visible && scene) {
      // surface the first cluster like the landing intro (0 → 0.14 in ~2.6s)
      if (intro < 0.14) {
        intro = Math.min(0.14, intro + dt * 0.055)
        scene.setIntroReveal(intro)
      }
      scene.update(dt)
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
}

// progress rides one CSS custom property — no inline style bindings
watch(
  () => props.progress,
  (v) => {
    root.value?.style.setProperty('--load-p', String(Math.max(v, 0) / 100))
  },
  { immediate: false },
)

const readout = computed(() =>
  props.progress >= 0 ? String(Math.round(props.progress)).padStart(3, '0') : '···',
)

onMounted(() => {
  requestAnimationFrame(() => {
    mounted.value = true
    root.value?.style.setProperty('--load-p', String(Math.max(props.progress, 0) / 100))
  })
  bootTopo()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  document.removeEventListener('visibilitychange', onVisibility)
  ro?.disconnect()
  scene?.dispose()
  scene = null
})

function leave(): Promise<void> {
  return new Promise((resolve) => {
    leaving.value = true
    setTimeout(resolve, 300)
  })
}

defineExpose({ leave })
</script>

<template>
  <div
    ref="root"
    class="app-loading"
    :class="{ 'is-mounted': mounted, 'is-leaving': leaving }"
  >
    <!-- faint contour field behind everything -->
    <svg class="app-loading__contours" viewBox="0 0 800 800" fill="none" aria-hidden="true">
      <g class="app-loading__contours-a">
        <path d="M480 140C610 120 700 210 690 330C682 430 610 520 480 540C355 559 250 470 245 355C240 235 355 159 480 140Z" />
        <path d="M478 200C570 186 640 250 634 336C628 412 570 476 482 472C394 468 330 402 336 320C342 244 390 213 478 200Z" />
        <path d="M474 260C532 251 582 294 578 350C574 400 532 442 478 439C422 436 384 392 388 338C392 288 422 268 474 260Z" />
      </g>
      <g class="app-loading__contours-b">
        <path d="M170 560C260 545 330 600 325 680C321 750 260 810 170 800C85 790 30 730 35 650C40 575 85 574 170 560Z" />
        <path d="M172 615C227 606 272 640 269 690C266 734 227 770 174 767C120 764 88 728 91 680C94 636 120 624 172 615Z" />
      </g>
      <circle class="app-loading__spot" cx="640" cy="620" r="3" />
      <circle class="app-loading__spot" cx="130" cy="200" r="2.4" />
      <path class="app-loading__cross" d="M700 180h16M708 172v16" />
      <path class="app-loading__cross" d="M110 700h14M117 693v14" />
    </svg>

    <!-- the real terrain fades in over the rings once WebGL is up -->
    <canvas
      ref="bgCanvas"
      class="app-loading__topo"
      :class="{ 'is-on': webglOk }"
      aria-hidden="true"
    />

    <!-- survey corners -->
    <span class="app-loading__corner app-loading__corner--tl" aria-hidden="true">+</span>
    <span class="app-loading__corner app-loading__corner--br" aria-hidden="true">+</span>

    <!-- the mark: three thought-nodes, signals pulsing between them -->
    <div class="app-loading__logo">
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="app-loading__link app-loading__link--a"
          d="M19.5 42.5 42.5 21"
          stroke-width="3.2"
          stroke-linecap="round"
        />
        <path
          class="app-loading__link app-loading__link--b"
          d="M20.5 46l24.5 1.6"
          stroke-width="3.2"
          stroke-linecap="round"
        />
        <circle class="app-loading__node app-loading__node--1" cx="14.5" cy="46.5" r="7" />
        <circle class="app-loading__node app-loading__node--2" cx="47.5" cy="16" r="8.4" />
        <circle class="app-loading__node app-loading__node--3" cx="49.5" cy="48" r="4.9" />
      </svg>
    </div>

    <!-- Wordmark -->
    <div class="app-loading__wordmark">NeuroCanvas</div>

    <!-- Status -->
    <div class="app-loading__status">{{ props.status }}</div>

    <!-- Depth gauge -->
    <div class="app-loading__gauge">
      <div class="app-loading__progress" role="progressbar" :aria-valuenow="Math.max(props.progress, 0)" aria-valuemin="0" aria-valuemax="100">
        <div
          class="app-loading__progress-fill"
          :class="{ 'is-indeterminate': props.progress < 0 }"
        />
      </div>
      <span class="app-loading__readout" aria-hidden="true">{{ readout }}</span>
    </div>

    <!-- Version -->
    <div class="app-loading__version">v1.0.0</div>
  </div>
</template>

<style scoped>
.app-loading {
  /* --al-* aliases now consume the global tokens (AER-76) — the values
     used to be a hardcoded landing-palette copy with slight drift
     (ink-faint 0.3, hair 0.1); normalized to the spec tiers. */
  --al-bg: var(--nc-bg);
  --al-ink: var(--nc-text);
  --al-ink-dim: var(--nc-text-secondary);
  --al-ink-faint: var(--nc-text-dim);
  --al-hair: var(--nc-border-subtle);
  --al-cyan: var(--nc-accent);
  --al-coral: var(--nc-coral);
  --al-ease: var(--nc-ease);

  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--al-bg);
  overflow: hidden;
  transition: opacity 300ms var(--al-ease), transform 300ms var(--al-ease);
}

.app-loading.is-leaving {
  opacity: 0;
  transform: scale(1.02);
  pointer-events: none;
}

/* --- topographic terrain (WebGL, pointer-less) --- */
.app-loading__topo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 900ms ease;
}

.app-loading__topo.is-on {
  opacity: 1;
}

/* --- contour field --- */
.app-loading__contours {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  opacity: 0;
  transition: opacity 1200ms ease 200ms;
}

.is-mounted .app-loading__contours {
  opacity: 1;
}

.app-loading__contours path {
  stroke: var(--al-hair);
  stroke-width: 1.5;
}

.app-loading__contours-a,
.app-loading__contours-b {
  transform-origin: center;
  animation: contourBreathe 9s ease-in-out infinite;
}

.app-loading__contours-b {
  animation-delay: -4.5s;
}

.app-loading__spot {
  fill: rgba(244, 244, 248, 0.18);
  stroke: none;
}

.app-loading__cross {
  stroke: var(--nc-border) !important;
  stroke-width: 1.5;
}

/* --- survey corners --- */
.app-loading__corner {
  position: absolute;
  z-index: 1;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 15px;
  color: var(--al-coral);
  opacity: 0;
  transition: opacity 800ms ease 600ms;
}

.is-mounted .app-loading__corner {
  opacity: 0.85;
}

.app-loading__corner--tl {
  top: calc(18px + env(safe-area-inset-top, 0px));
  left: calc(20px + env(safe-area-inset-left, 0px));
}

.app-loading__corner--br {
  bottom: calc(18px + env(safe-area-inset-bottom, 0px));
  right: calc(20px + env(safe-area-inset-right, 0px));
}

/* --- the mark --- */
.app-loading__logo {
  position: relative;
  z-index: 1;
  width: clamp(72px, 18vw, 96px);
  height: clamp(72px, 18vw, 96px);
  opacity: 0;
  transform: scale(0.92);
  transition: opacity 600ms var(--al-ease), transform 600ms var(--al-ease);
}

.is-mounted .app-loading__logo {
  opacity: 1;
  transform: scale(1);
}

.app-loading__logo svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.app-loading__link {
  stroke: rgba(244, 244, 248, 0.55);
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
}

.is-mounted .app-loading__link--a {
  animation: linkDraw 700ms var(--al-ease) 350ms forwards;
}

.is-mounted .app-loading__link--b {
  animation: linkDraw 700ms var(--al-ease) 550ms forwards;
}

.app-loading__node {
  fill: var(--al-ink);
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
}

.is-mounted .app-loading__node {
  animation:
    nodePop 500ms var(--al-ease) forwards,
    nodePulse 2.4s ease-in-out 1.4s infinite;
}

.is-mounted .app-loading__node--1 { animation-delay: 150ms, 1.4s; }
.is-mounted .app-loading__node--2 { animation-delay: 350ms, 2.2s; }
.is-mounted .app-loading__node--3 { animation-delay: 550ms, 3s; }

/* --- wordmark --- */
.app-loading__wordmark {
  position: relative;
  z-index: 1;
  margin-top: 26px;
  font-family: 'Cabinet Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
  font-size: calc(24px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--al-ink);
  letter-spacing: 0.01em;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 500ms var(--al-ease) 150ms, transform 500ms var(--al-ease) 150ms;
}

.is-mounted .app-loading__wordmark {
  opacity: 1;
  transform: translateY(0);
}

/* --- status --- */
.app-loading__status {
  position: relative;
  z-index: 1;
  margin-top: 14px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--al-ink-dim);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 500ms var(--al-ease) 250ms, transform 500ms var(--al-ease) 250ms;
}

.is-mounted .app-loading__status {
  opacity: 1;
  transform: translateY(0);
}

/* --- depth gauge --- */
.app-loading__gauge {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 30px;
  opacity: 0;
  transition: opacity 400ms ease 350ms;
}

.is-mounted .app-loading__gauge {
  opacity: 1;
}

.app-loading__progress {
  width: min(220px, 56vw);
  height: 2px;
  background: var(--al-hair);
  overflow: hidden;
}

.app-loading__progress-fill {
  height: 100%;
  background: var(--al-cyan);
  transform: scaleX(var(--load-p, 0));
  transform-origin: left;
  transition: transform 400ms var(--al-ease);
}

.app-loading__progress-fill.is-indeterminate {
  transform: scaleX(0.4);
  animation: progressSweep 1.6s cubic-bezier(0.77, 0, 0.175, 1) infinite;
}

.app-loading__readout {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
  letter-spacing: 0.14em;
  color: var(--al-cyan);
  min-width: 3ch;
}

/* --- version --- */
.app-loading__version {
  position: absolute;
  z-index: 1;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(10px * var(--nc-text-scale, 1));
  letter-spacing: 0.14em;
  color: var(--al-ink-faint);
  opacity: 0;
  transition: opacity 400ms ease 500ms;
}

.is-mounted .app-loading__version {
  opacity: 1;
}

/* --- keyframes --- */
@keyframes linkDraw {
  to { stroke-dashoffset: 0; }
}

@keyframes nodePop {
  0% { transform: scale(0); }
  70% { transform: scale(1.18); }
  100% { transform: scale(1); }
}

@keyframes nodePulse {
  0%, 100% { fill: var(--al-ink); transform: scale(1); }
  12% { fill: var(--al-cyan); transform: scale(1.14); }
  30% { fill: var(--al-ink); transform: scale(1); }
}

@keyframes contourBreathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.035); }
}

@keyframes progressSweep {
  0% { translate: -110% 0; }
  100% { translate: 280% 0; }
}

/* --- reduced motion --- */
@media (prefers-reduced-motion: reduce) {
  .app-loading__logo,
  .app-loading__wordmark,
  .app-loading__status,
  .app-loading__gauge,
  .app-loading__version,
  .app-loading__corner,
  .app-loading__contours {
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }

  .app-loading__contours-a,
  .app-loading__contours-b {
    animation: none;
  }

  .is-mounted .app-loading__node {
    animation: none;
    transform: scale(1);
  }

  .is-mounted .app-loading__link--a,
  .is-mounted .app-loading__link--b {
    animation: none;
    stroke-dashoffset: 0;
  }

  .app-loading__progress-fill.is-indeterminate {
    animation: none;
    transform: scaleX(0.6);
  }

  .app-loading.is-leaving {
    transition-duration: 0.01ms !important;
  }
}
</style>
