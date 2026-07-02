<script setup lang="ts">
import { nextTick, onBeforeUnmount } from 'vue'
import { useGuestMode } from '~/composables/useGuestMode'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { clamp01, probeAvifDecode } from '~/composables/useFrameSequence'
import { refreshScrollTriggers, useLenis } from '~/composables/useLenis'

definePageMeta({ layout: false })

// The hero poster (LCP element) is preloaded via a Link response header on
// the `/` route rule (nuxt.config) — a client-injected <link> would fire
// long after the SPA mounts and never beat the <img> request itself.
useHead({
  // Landing-only override of the app-shell viewport: marketing pages must
  // allow pinch zoom (WCAG 1.4.4); the app surfaces keep their own meta.
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
})

const _isNative = typeof window !== 'undefined' && (
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
  || ('Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.())
)
const { status } = _isNative ? { status: ref('authenticated') } : useAuth()
const isAuthenticated = computed(() => _isNative || status.value === 'authenticated')
const guest = useGuestMode()

function handleTryFree() {
  if (isAuthenticated.value) {
    navigateTo('/dashboard')
    return
  }
  guest.enterGuestMode()
  navigateTo('/map/new')
}

const lpRoot = ref<HTMLElement | null>(null)

// ═══════════════════════════════════════════════════════════
// SCRUB HERO — gate, progress, chapters (AER-73)
// ═══════════════════════════════════════════════════════════

const { isReduced } = useReducedMotion()
const { lenis, init: initLenis, destroy: destroyLenis } = useLenis()

const isNarrow = ref(false)
/** null = probe pending (optimistic), false = AVIF undecodable. */
const avifOk = ref<boolean | null>(null)

/**
 * Single gate for the scroll-scrubbed hero. When false we render the
 * static 100vh hero (poster or mobile video) instead of the 400vh rail.
 */
const scrubEnabled = computed(() =>
  !isReduced.value
  && !isNarrow.value
  && !_isNative
  && avifOk.value !== false,
)

/** Mobile fallback video only below 768px and only when motion is allowed. */
const showMobileVideo = computed(() => isNarrow.value && !isReduced.value)

const railEl = ref<HTMLElement | null>(null)
const scrubProgress = ref(0)

function updateScrubProgress(): void {
  const rail = railEl.value
  if (!rail) return
  const total = rail.offsetHeight - window.innerHeight
  if (total <= 0) {
    scrubProgress.value = 0
    return
  }
  scrubProgress.value = clamp01(-rail.getBoundingClientRect().top / total)
}

/**
 * Chapter visible at the current progress:
 * 0 -> [0, 0.3], 1 -> [0.35, 0.65], 2 -> [0.7, 1]; -1 in the gaps
 * (previous chapter exits with the fast compact fade).
 */
const activeChapter = computed<number>(() => {
  const p = scrubProgress.value
  if (p <= 0.3) return 0
  if (p >= 0.35 && p <= 0.65) return 1
  if (p >= 0.7) return 2
  return -1
})

let offLenisScrub: (() => void) | null = null

function attachScrub(): void {
  // Lenis's smoothed scroll drives per-frame updates when active; the
  // passive native listener stays bound as well so programmatic and
  // rAF-throttled scrolls (background tabs) still resolve the frame.
  const activeLenis = lenis.value
  if (activeLenis) {
    offLenisScrub = activeLenis.on('scroll', updateScrubProgress)
  }
  window.addEventListener('scroll', updateScrubProgress, { passive: true })
  window.addEventListener('resize', updateScrubProgress, { passive: true })
  updateScrubProgress()
}

function detachScrub(): void {
  if (offLenisScrub) {
    offLenisScrub()
    offLenisScrub = null
  }
  window.removeEventListener('scroll', updateScrubProgress)
  window.removeEventListener('resize', updateScrubProgress)
}

/** (Re)wire Lenis + the progress listener after any gate flip. */
function syncMotionEngines(): void {
  detachScrub()
  destroyLenis()
  initLenis() // self-gated: reduced motion / <768px / native shell -> null
  if (scrubEnabled.value) attachScrub()
}

function scrollToId(id: string): void {
  const el = document.getElementById(id)
  if (!el) return
  const activeLenis = lenis.value
  if (activeLenis) {
    activeLenis.scrollTo(el, { offset: -76 })
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

let narrowMql: MediaQueryList | null = null
const onNarrowChange = (e: MediaQueryListEvent): void => {
  isNarrow.value = e.matches
}

let revealObserver: IntersectionObserver | null = null

// ═══════════════════════════════════════════════════════════
// NAV OVERLAY — transparent over the hero video, solid past it
// ═══════════════════════════════════════════════════════════
// Two IntersectionObserver conditions, both required:
//   1. the hero's 1px top probe has left through the viewport top
//      (the video is fully behind the nav band), and
//   2. the hero still reaches below the nav's bottom edge.
// The nav therefore resolidifies BEFORE any below-fold content can
// slide underneath it — the transparent state only ever sits over the
// dark video, whose top scrim guarantees >= 4.5:1 for the light links.
const navEl = ref<HTMLElement | null>(null)
const staticHeroEl = ref<HTMLElement | null>(null)
const navProbeEl = ref<HTMLElement | null>(null)

const heroCoversNavTop = ref(false)
const heroUnderNav = ref(false)
const navOverlay = computed(() => heroCoversNavTop.value && heroUnderNav.value)

let navTopObserver: IntersectionObserver | null = null
let navBottomObserver: IntersectionObserver | null = null
let navResizeTimer: number | undefined

function teardownNavObservers(): void {
  navTopObserver?.disconnect()
  navTopObserver = null
  navBottomObserver?.disconnect()
  navBottomObserver = null
}

function setupNavObservers(): void {
  teardownNavObservers()
  const hero = railEl.value ?? staticHeroEl.value
  const probe = navProbeEl.value
  if (!hero || !probe) {
    heroCoversNavTop.value = false
    heroUnderNav.value = false
    return
  }
  const navHeight = navEl.value?.offsetHeight ?? 76

  navTopObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      heroCoversNavTop.value = !entry.isIntersecting && entry.boundingClientRect.top < 0
    }
  }, { threshold: 0 })
  navTopObserver.observe(probe)

  // Root shrunk by the nav height: the hero intersects it exactly while
  // its bottom edge is still below the nav's bottom edge.
  navBottomObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      heroUnderNav.value = entry.isIntersecting
    }
  }, { threshold: 0, rootMargin: `-${navHeight}px 0px 0px 0px` })
  navBottomObserver.observe(hero)
}

/** Nav height changes at breakpoints — rebuild the margin-bound observer. */
function onNavResize(): void {
  window.clearTimeout(navResizeTimer)
  navResizeTimer = window.setTimeout(setupNavObservers, 160)
}

onMounted(() => {
  if (typeof window === 'undefined') return
  // Trigger hero entrance choreography
  requestAnimationFrame(() => lpRoot.value?.classList.add('is-loaded'))

  narrowMql = window.matchMedia('(max-width: 767px)')
  isNarrow.value = narrowMql.matches
  narrowMql.addEventListener('change', onNarrowChange)

  void probeAvifDecode().then((ok) => {
    avifOk.value = ok
  })

  syncMotionEngines()
  setupNavObservers()
  window.addEventListener('resize', onNavResize, { passive: true })

  // Recompute scroll-linked positions once the rail has mounted and
  // again once the webfonts have settled (layout shifts move triggers).
  void nextTick(() => refreshScrollTriggers())
  if ('fonts' in document) {
    void document.fonts.ready.then(() => refreshScrollTriggers())
  }

  // Scroll-reveal observer for [data-reveal] elements
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    lpRoot.value?.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible')
    })
    return
  }
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver?.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  )
  lpRoot.value?.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el => revealObserver?.observe(el))
})

watch([scrubEnabled, isReduced, isNarrow], async () => {
  if (typeof window === 'undefined') return
  await nextTick()
  syncMotionEngines()
  setupNavObservers()
  refreshScrollTriggers()
})

onBeforeUnmount(() => {
  detachScrub()
  destroyLenis()
  narrowMql?.removeEventListener('change', onNarrowChange)
  window.removeEventListener('resize', onNavResize)
  window.clearTimeout(navResizeTimer)
  teardownNavObservers()
  revealObserver?.disconnect()
  revealObserver = null
})
</script>

<template>
  <div ref="lpRoot" class="lp">
    <!-- ══════ TOP NAV ══════ -->
    <nav ref="navEl" class="nav" :class="{ 'nav--overlay': navOverlay }">
      <div class="nav-left">
        <NuxtLink to="/" class="brand">
          <NcLogo :size="14" :container-size="24" :radius="6" />
          <span class="brand-name">NeuroCanvas</span>
        </NuxtLink>
        <div class="nav-links">
          <a href="#how-it-works" @click.prevent="scrollToId('how-it-works')">{{ $t('landing.nav.product') }}</a>
          <a href="#templates" @click.prevent="scrollToId('templates')">{{ $t('landing.nav.templates') }}</a>
          <NuxtLink to="/docs">{{ $t('landing.nav.docs') }}</NuxtLink>
          <NuxtLink to="/download">{{ $t('landing.nav.download') }}</NuxtLink>
        </div>
      </div>
      <div class="nav-right">
        <NuxtLink v-if="!isAuthenticated" to="/auth/signin" class="nav-signin">{{ $t('landing.nav.signin') }}</NuxtLink>
        <NuxtLink v-else to="/dashboard" class="nav-dash">
          {{ $t('landing.nav.open_dashboard') }}
        </NuxtLink>
      </div>
    </nav>

    <!-- ══════ HERO — SCRUB RAIL ══════ -->
    <section v-if="scrubEnabled" ref="railEl" class="rail" aria-label="NeuroCanvas">
      <div ref="navProbeEl" class="nav-probe" aria-hidden="true" />
      <div class="rail-stage">
        <LandingScrubSequence
          :progress="scrubProgress"
          :poster-alt="$t('landing.hero.poster_alt')"
          @unsupported="avifOk = false"
        />
        <div class="rail-scrim" aria-hidden="true" />

        <div class="rail-chapters">
          <!-- Chapter 1 — headline + CTAs (0 to 0.3) -->
          <div class="ch" :class="{ 'is-active': activeChapter === 0 }" :inert="activeChapter !== 0">
            <h1 class="ch-head">
              <span class="ch-line"><span class="ch-line-inner ch-t1">{{ $t('landing.hero.title_a') }}</span></span>
              <span class="ch-line"><span class="ch-line-inner ch-t2 chd-1">{{ $t('landing.hero.title_b') }}</span></span>
            </h1>
            <p class="ch-sub ch-soft chd-2">{{ $t('landing.hero.subtitle_v2') }}</p>
            <div class="ch-cta ch-soft chd-3">
              <button type="button" class="btn-primary" @click="handleTryFree">
                <span>{{ $t('landing.hero.cta_primary_short') }}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <NuxtLink :to="isAuthenticated ? '/dashboard' : '/auth/signup'" class="btn-outline">
                {{ $t('landing.hero.cta_secondary') }}
              </NuxtLink>
            </div>
            <p class="ch-receipt ch-soft chd-4">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M13.333 4.667L6 12l-3.333-3.333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ $t('landing.hero.receipt') }}</span>
            </p>
          </div>

          <!-- Chapter 2 — value statement (0.35 to 0.65) -->
          <div class="ch ch--minor" :class="{ 'is-active': activeChapter === 1 }" :inert="activeChapter !== 1">
            <h2 class="ch-head">
              <span class="ch-line"><span class="ch-line-inner ch-t1">{{ $t('landing.scrub_chapters.ch2.line_1') }}</span></span>
              <span class="ch-line"><span class="ch-line-inner ch-t2 chd-1">{{ $t('landing.scrub_chapters.ch2.line_2') }}</span></span>
            </h2>
            <p class="ch-sub ch-soft chd-2">{{ $t('landing.scrub_chapters.ch2.body') }}</p>
          </div>

          <!-- Chapter 3 — value statement (0.7 to 1) -->
          <div class="ch ch--minor" :class="{ 'is-active': activeChapter === 2 }" :inert="activeChapter !== 2">
            <h2 class="ch-head">
              <span class="ch-line"><span class="ch-line-inner ch-t1">{{ $t('landing.scrub_chapters.ch3.line_1') }}</span></span>
              <span class="ch-line"><span class="ch-line-inner ch-t2 chd-1">{{ $t('landing.scrub_chapters.ch3.line_2') }}</span></span>
            </h2>
            <p class="ch-sub ch-soft chd-2">{{ $t('landing.scrub_chapters.ch3.body') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════ HERO — STATIC FALLBACK (reduced motion / narrow / native / no AVIF) ══════ -->
    <section v-else ref="staticHeroEl" class="hero-static" aria-label="NeuroCanvas">
      <div ref="navProbeEl" class="nav-probe" aria-hidden="true" />
      <video
        v-if="showMobileVideo"
        class="hero-static-media"
        src="/landing/hero-mobile.mp4"
        poster="/landing/poster.jpg"
        autoplay
        muted
        loop
        playsinline
        aria-hidden="true"
      />
      <picture v-else class="hero-static-media">
        <source srcset="/landing/poster.avif" type="image/avif">
        <img src="/landing/poster.jpg" :alt="$t('landing.hero.poster_alt')" loading="eager" fetchpriority="high" decoding="async" class="hero-static-img">
      </picture>
      <div class="rail-scrim" aria-hidden="true" />

      <div class="hero-static-copy">
        <h1 class="ch-head">
          <span class="ch-t1 hs-rise">{{ $t('landing.hero.title_a') }}</span>
          <span class="ch-t2 hs-rise hrd-1">{{ $t('landing.hero.title_b') }}</span>
        </h1>
        <p class="ch-sub hs-rise hrd-2">{{ $t('landing.hero.subtitle_v2') }}</p>
        <div class="ch-cta hs-rise hrd-3">
          <button type="button" class="btn-primary" @click="handleTryFree">
            <span>{{ $t('landing.hero.cta_primary_short') }}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <NuxtLink :to="isAuthenticated ? '/dashboard' : '/auth/signup'" class="btn-outline">
            {{ $t('landing.hero.cta_secondary') }}
          </NuxtLink>
        </div>
        <p class="ch-receipt hs-rise hrd-4">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13.333 4.667L6 12l-3.333-3.333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ $t('landing.hero.receipt') }}</span>
        </p>
      </div>
    </section>

    <!-- ══════ 01 — WHY THIS EXISTS ══════ -->
    <section class="sec sec-01">
      <div class="sec-grid">
        <div class="sec-eyebrow" data-reveal>{{ $t('landing.section_01.eyebrow') }}</div>
        <div class="sec-body">
          <h2 class="sec-h rv-d1" data-reveal>{{ $t('landing.section_01.heading') }}</h2>
          <p class="sec-p rv-d2" data-reveal>
            {{ $t('landing.section_01.paragraph') }}
          </p>
        </div>
      </div>
    </section>

    <!-- ══════ 02 — SEE IT WORK ══════ -->
    <section class="sec sec-02">
      <div class="sec-grid sec-grid--head">
        <div class="sec-eyebrow" data-reveal>{{ $t('landing.section_02.eyebrow') }}</div>
        <div class="sec-body">
          <h2 class="sec-h2 rv-d1" data-reveal>{{ $t('landing.section_02.heading') }}</h2>
        </div>
      </div>

      <div class="demo-frame rv-d2" data-reveal>
        <div class="demo-input">
          <span class="demo-input-label">{{ $t('landing.section_02.prompt_label') }}</span>
          <p class="demo-input-text">
            {{ $t('landing.section_02.prompt_text') }}<span class="demo-caret">|</span>
          </p>
          <div class="demo-input-rows">
            <div class="demo-row">
              <span class="demo-row-dot" />
              <span class="demo-row-name">Anthropic Claude</span>
              <span class="demo-row-meta">opus 4.8</span>
            </div>
            <div class="demo-row">
              <span class="demo-row-text">{{ $t('landing.section_02.generating_status') }}</span>
              <span class="demo-row-meta">1.4s</span>
            </div>
          </div>
        </div>

        <div class="demo-output" data-reveal-stage>
          <div class="demo-output-glow" />
          <svg class="demo-edges" viewBox="0 0 920 520" preserveAspectRatio="none">
            <path class="demo-line de-1" pathLength="1" d="M460 100 Q 280 140 200 240" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-2" pathLength="1" d="M460 100 Q 460 180 460 240" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-3" pathLength="1" d="M460 100 Q 640 140 720 240" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-4" pathLength="1" d="M200 280 Q 160 360 140 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-5" pathLength="1" d="M200 280 Q 240 360 280 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-6" pathLength="1" d="M460 280 Q 460 360 420 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-7" pathLength="1" d="M720 280 Q 720 360 700 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line de-8" pathLength="1" d="M720 280 Q 760 360 800 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
          </svg>
          <div class="demo-node demo-node--root demo-pop dn-root">{{ $t('landing.section_02.node_root') }}</div>
          <div class="demo-node demo-node--mid demo-pop dn-m1">{{ $t('landing.section_02.node_engineering') }}</div>
          <div class="demo-node demo-node--mid demo-pop dn-m2">{{ $t('landing.section_02.node_content') }}</div>
          <div class="demo-node demo-node--mid demo-pop dn-m3">{{ $t('landing.section_02.node_rollout') }}</div>
          <div class="demo-node demo-node--leaf demo-pop dn-l1">{{ $t('landing.section_02.node_leaf_1') }}</div>
          <div class="demo-node demo-node--leaf demo-pop dn-l2">{{ $t('landing.section_02.node_leaf_2') }}</div>
          <div class="demo-node demo-node--leaf demo-pop dn-l3">{{ $t('landing.section_02.node_leaf_3') }}</div>
          <div class="demo-node demo-node--leaf demo-pop dn-l4">{{ $t('landing.section_02.node_leaf_4') }}</div>
          <div class="demo-node demo-node--leaf demo-pop dn-l5">{{ $t('landing.section_02.node_leaf_5') }}</div>
        </div>
      </div>
    </section>

    <!-- ══════ 03 — HOW IT WORKS ══════ -->
    <section id="how-it-works" class="sec sec-03">
      <div class="sec-grid sec-grid--head">
        <div class="sec-eyebrow" data-reveal>{{ $t('landing.section_03.eyebrow') }}</div>
        <div class="sec-body">
          <h2 class="sec-h2 rv-d1" data-reveal>{{ $t('landing.section_03.heading') }}</h2>
        </div>
      </div>

      <div class="steps">
        <article class="step" data-reveal>
          <div class="step-num">
            <span class="step-numeral">01</span>
            <span class="step-label">{{ $t('landing.section_03.step_1.label') }}</span>
          </div>
          <div class="step-body">
            <h3>{{ $t('landing.section_03.step_1.title') }}</h3>
            <p>{{ $t('landing.section_03.step_1.body') }}</p>
          </div>
          <div class="step-chip">
            <span class="chip">{{ $t('landing.section_03.step_1.chip') }}</span>
          </div>
        </article>

        <article class="step rv-d1" data-reveal>
          <div class="step-num">
            <span class="step-numeral">02</span>
            <span class="step-label">{{ $t('landing.section_03.step_2.label') }}</span>
          </div>
          <div class="step-body">
            <h3>{{ $t('landing.section_03.step_2.title') }}</h3>
            <p>{{ $t('landing.section_03.step_2.body') }}</p>
          </div>
          <div class="step-chip">
            <span class="chip chip-sm">{{ $t('landing.section_03.step_2.chip_cause') }}</span>
            <svg width="32" height="12" viewBox="0 0 32 12" fill="none">
              <path d="M2 6h26M22 2l6 4-6 4" stroke="#52525B" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span class="chip chip-sm">{{ $t('landing.section_03.step_2.chip_effect') }}</span>
          </div>
        </article>

        <article class="step step--last rv-d2" data-reveal>
          <div class="step-num">
            <span class="step-numeral">03</span>
            <span class="step-label">{{ $t('landing.section_03.step_3.label') }}</span>
          </div>
          <div class="step-body">
            <h3>{{ $t('landing.section_03.step_3.title') }}</h3>
            <p>{{ $t('landing.section_03.step_3.body') }}</p>
          </div>
          <div class="step-chip">
            <span class="chip chip-kbd">
              <span class="kbd-key">⌘</span>
              <span class="kbd-key">K</span>
              <span class="kbd-sep">·</span>
              <span class="kbd-text">{{ $t('landing.section_03.step_3.kbd_text') }}</span>
            </span>
          </div>
        </article>
      </div>
    </section>

    <!-- ══════ 04 — TEMPLATES ══════ -->
    <section id="templates" class="sec sec-04">
      <div class="sec-grid sec-grid--head">
        <div class="sec-aside" data-reveal>
          <div class="sec-eyebrow">{{ $t('landing.section_04.eyebrow') }}</div>
          <NuxtLink to="/templates" class="browse-all">
            <span>{{ $t('landing.templates_section.browse_all') }}</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </NuxtLink>
        </div>
        <div class="sec-body">
          <h2 class="sec-h rv-d1" data-reveal>{{ $t('landing.section_04.heading') }}</h2>
        </div>
      </div>

      <div class="tpl-rail">
        <NuxtLink to="/templates" class="tpl" data-reveal>
          <div class="tpl-preview">
            <svg viewBox="0 0 280 208" preserveAspectRatio="none">
              <path d="M140 38 L50 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L140 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L230 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M50 108 L50 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 108 L140 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M230 108 L230 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
            </svg>
            <span class="tpl-node tpl-node--root">{{ $t('landing.section_04.template_decision.node_root') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-l">{{ $t('landing.section_04.template_decision.node_option_a') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-c">{{ $t('landing.section_04.template_decision.node_risks') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-r">{{ $t('landing.section_04.template_decision.node_option_b') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-l">{{ $t('landing.section_04.template_decision.node_pro') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-c">{{ $t('landing.section_04.template_decision.node_mixed') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-r">{{ $t('landing.section_04.template_decision.node_con') }}</span>
          </div>
          <div class="tpl-meta">
            <h3>{{ $t('landing.section_04.template_decision.title') }}</h3>
            <p>{{ $t('landing.section_04.template_decision.description') }}</p>
          </div>
        </NuxtLink>

        <NuxtLink to="/templates" class="tpl rv-d1" data-reveal>
          <div class="tpl-preview">
            <svg viewBox="0 0 280 208" preserveAspectRatio="none">
              <path d="M140 38 L50 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L140 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L230 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M50 108 L50 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 108 L140 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M230 108 L230 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
            </svg>
            <span class="tpl-node tpl-node--root">{{ $t('landing.section_04.template_project.node_root') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-l">{{ $t('landing.section_04.template_project.node_spec') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-c">{{ $t('landing.section_04.template_project.node_build') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-r">{{ $t('landing.section_04.template_project.node_ship') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-l">{{ $t('landing.section_04.template_project.node_today') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-c">{{ $t('landing.section_04.template_project.node_wk2') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-r">{{ $t('landing.section_04.template_project.node_wk4') }}</span>
          </div>
          <div class="tpl-meta">
            <h3>{{ $t('landing.section_04.template_project.title') }}</h3>
            <p>{{ $t('landing.section_04.template_project.description') }}</p>
          </div>
        </NuxtLink>

        <NuxtLink to="/templates" class="tpl rv-d2" data-reveal>
          <div class="tpl-preview">
            <svg viewBox="0 0 280 208" preserveAspectRatio="none">
              <path d="M140 38 L50 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L140 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L230 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M50 108 L140 156" stroke="#00D2BE" stroke-width="1.4" fill="none" stroke-dasharray="3 3" />
              <path d="M140 108 L140 156" stroke="#00D2BE" stroke-width="1.4" fill="none" stroke-dasharray="3 3" />
              <path d="M230 108 L140 156" stroke="#00D2BE" stroke-width="1.4" fill="none" stroke-dasharray="3 3" />
            </svg>
            <span class="tpl-node tpl-node--root">{{ $t('landing.section_04.template_research.node_root') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-l">{{ $t('landing.section_04.template_research.node_source_1') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-c">{{ $t('landing.section_04.template_research.node_source_2') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-r">{{ $t('landing.section_04.template_research.node_source_3') }}</span>
            <span class="tpl-node tpl-node--ai tpl-node--leaf tpl-node--col-c">{{ $t('landing.section_04.template_research.node_ai') }}</span>
          </div>
          <div class="tpl-meta">
            <h3>{{ $t('landing.section_04.template_research.title') }}</h3>
            <p>{{ $t('landing.section_04.template_research.description') }}</p>
          </div>
        </NuxtLink>

        <NuxtLink to="/templates" class="tpl rv-d3" data-reveal>
          <div class="tpl-preview">
            <svg viewBox="0 0 280 208" preserveAspectRatio="none">
              <path d="M140 38 L50 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L140 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 38 L230 78" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M50 108 L50 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M140 108 L140 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
              <path d="M230 108 L230 156" stroke="#3F3F46" stroke-width="1.4" fill="none" />
            </svg>
            <span class="tpl-node tpl-node--root">{{ $t('landing.section_04.template_brainstorm.node_root') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-l">{{ $t('landing.section_04.template_brainstorm.node_idea_1') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-c">{{ $t('landing.section_04.template_brainstorm.node_idea_2') }}</span>
            <span class="tpl-node tpl-node--mid tpl-node--col-r">{{ $t('landing.section_04.template_brainstorm.node_idea_3') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-l">{{ $t('landing.section_04.template_brainstorm.node_sub_a') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-c">{{ $t('landing.section_04.template_brainstorm.node_sub_b') }}</span>
            <span class="tpl-node tpl-node--leaf tpl-node--col-r">{{ $t('landing.section_04.template_brainstorm.node_sub_c') }}</span>
          </div>
          <div class="tpl-meta">
            <h3>{{ $t('landing.section_04.template_brainstorm.title') }}</h3>
            <p>{{ $t('landing.section_04.template_brainstorm.description') }}</p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- ══════ 05 — YOUR DATA ══════ -->
    <section class="sec sec-05">
      <div class="sec-grid">
        <div class="sec-eyebrow" data-reveal>{{ $t('landing.section_05.eyebrow') }}</div>
        <div class="sec-body">
          <h2 class="sec-h rv-d1" data-reveal>{{ $t('landing.section_05.heading') }}</h2>
          <div class="privacy-cols">
            <div class="privacy-col rv-d2" data-reveal>
              <h3>{{ $t('landing.section_05.col_local.title') }}</h3>
              <p>{{ $t('landing.section_05.col_local.body') }}</p>
            </div>
            <div class="privacy-col rv-d3" data-reveal>
              <h3>{{ $t('landing.section_05.col_byok.title') }}</h3>
              <p>{{ $t('landing.section_05.col_byok.body') }}</p>
            </div>
            <div class="privacy-col rv-d4" data-reveal>
              <h3>{{ $t('landing.section_05.col_export.title') }}</h3>
              <p>{{ $t('landing.section_05.col_export.body') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════ FINAL CTA ══════ -->
    <section class="cta">
      <h2 class="cta-h" data-reveal>{{ $t('landing.final_cta.heading') }}</h2>
      <div class="cta-row rv-d1" data-reveal>
        <button type="button" class="btn-primary btn-lg" @click="handleTryFree">
          <span>{{ $t('landing.final_cta.primary') }}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <a href="https://github.com/vanjamodrinjak21/neuro-canvas" target="_blank" rel="noopener" class="btn-outline btn-lg">{{ $t('landing.final_cta.github') }}</a>
      </div>
      <p class="cta-receipt rv-d2" data-reveal>{{ $t('landing.final_cta.receipt') }}</p>
    </section>

    <!-- ══════ FOOTER ══════ -->
    <footer class="footer">
      <div class="footer-brand">
        <div class="footer-brand-row">
          <NcLogo :size="11" :container-size="18" :radius="5" />
          <span class="footer-brand-name">NeuroCanvas</span>
        </div>
        <span class="footer-meta">{{ $t('landing.footer.version_meta') }}</span>
        <span class="footer-meta footer-meta--credit">{{ $t('landing.footer.made_by') }}</span>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <span class="footer-col-head">{{ $t('landing.footer.product_head') }}</span>
          <NuxtLink to="/templates">{{ $t('landing.footer.templates_link') }}</NuxtLink>
          <NuxtLink to="/download">{{ $t('landing.footer.download_link') }}</NuxtLink>
          <NuxtLink to="/roadmap">{{ $t('landing.footer.roadmap_link') }}</NuxtLink>
        </div>
        <div class="footer-col">
          <span class="footer-col-head">{{ $t('landing.footer.resources_head') }}</span>
          <NuxtLink to="/docs">{{ $t('landing.footer.docs_link') }}</NuxtLink>
          <a href="https://github.com/vanjamodrinjak21/neuro-canvas" target="_blank" rel="noopener">{{ $t('landing.footer.github_link') }}</a>
        </div>
        <div class="footer-col">
          <span class="footer-col-head">{{ $t('landing.footer.company_head') }}</span>
          <NuxtLink to="/privacy">{{ $t('landing.footer.privacy_link') }}</NuxtLink>
          <NuxtLink to="/terms">{{ $t('landing.footer.terms_link') }}</NuxtLink>
          <a href="mailto:hello@neurocanvas.app">{{ $t('landing.footer.contact_link') }}</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   NEUROCANVAS — Landing with scroll-scrubbed hero (AER-73)
   ═══════════════════════════════════════════════════════ */
.lp {
  --bg: #09090B;
  --bg-2: #0C0C10;
  --bg-3: #121216;
  --surface: #1E1E22;
  --border: #16161A;
  --border-2: #1E1E22;
  --border-3: #252529;
  --border-4: #3F3F46;
  --text: #FAFAFA;
  --text-2: #A1A1AA;
  /* Smallest text tier — #52525B measured 2.4:1 on --bg; #83838C holds
     >= 4.5:1 on every landing surface (bg, bg-2, bg-3). Hierarchy still
     reads through weight + the --text/--text-2/--text-3 value steps. */
  --text-3: #83838C;
  --accent: #00D2BE;
  --accent-soft: rgba(0, 210, 190, 0.08);
  --sans: 'Inter', system-ui, -apple-system, sans-serif;
  --serif: 'Instrument Serif', Georgia, serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;

  /* ── Layout rhythm (Phase 4) ──
     One max-width container and one horizontal gutter for every band:
     the gutter grows past --lp-max so content stays centered on ultrawide
     while full-bleed borders/backgrounds keep spanning the viewport. */
  --lp-max: 1360px;
  --lp-pad-x: 56px;
  --lp-gutter: max(var(--lp-pad-x), calc((100% - var(--lp-max)) / 2));
  --lp-sec-y: 128px;

  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  /* clip, not hidden: overflow-x:hidden would make .lp a scroll container
     and silently break every position:sticky descendant (nav, rail stage). */
  overflow-x: clip;
}

:root.light .lp {
  --bg: #FAFAF9;
  --bg-2: #F5F5F3;
  --bg-3: #FFFFFF;
  --surface: #F0F0EE;
  --border: #E8E8E6;
  --border-2: #E0E0DE;
  --border-3: #D4D4D0;
  --border-4: #999999;
  --text: #111111;
  --text-2: #555555;
  /* #777777 measured 4.3:1 on #FAFAF9 — #6B6B6B clears 4.5:1. */
  --text-3: #6B6B6B;
}

/* ═══════════════════════ NAV ═══════════════════════ */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px var(--lp-gutter);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  z-index: 100;
  transition:
    background-color 200ms var(--ease-out),
    border-color 200ms var(--ease-out);
}

:root.light .nav { background: rgba(250, 250, 249, 0.85); }

/* Overlay state — only ever active while the dark hero video is fully
   behind the nav band (IntersectionObserver-gated in script). The rail's
   top scrim (>= 0.88 backing) keeps every link >= 4.5:1 in both themes. */
.nav--overlay {
  background: transparent;
  border-bottom-color: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

:root.light .nav--overlay { background: transparent; }

.nav--overlay .brand,
.nav--overlay .brand-name { color: #FAFAFA; }
.nav--overlay .nav-links a,
.nav--overlay .nav-signin { color: #D4D4D8; }
.nav--overlay .nav-links a:hover,
.nav--overlay .nav-signin:hover { color: #FAFAFA; }
.nav--overlay .nav-dash {
  color: #FAFAFA;
  border-color: rgba(250, 250, 250, 0.4);
}
.nav--overlay .nav-dash:hover {
  border-color: rgba(250, 250, 250, 0.75);
  background: rgba(250, 250, 250, 0.06);
}

/* 1px marker at the hero's top edge — drives the nav overlay observer. */
.nav-probe {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 40px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}

.brand-name {
  font-family: var(--sans);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 18px;
  color: var(--text);
}

.nav-links {
  display: flex;
  gap: 28px;
}

.nav-links a {
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text-2);
  text-decoration: none;
  transition: color var(--micro);
}

.nav-links a:hover { color: var(--text); }

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-signin {
  padding: 8px 12px;
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text-2);
  text-decoration: none;
  transition: color var(--micro);
}

.nav-signin:hover { color: var(--text); }

.nav-dash {
  padding: 8px 16px;
  border: 1px solid var(--border-3);
  border-radius: 10px;
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text);
  text-decoration: none;
  transition:
    border-color var(--micro),
    background var(--micro),
    color var(--micro);
}

.nav-dash:hover { border-color: var(--border-4); background: var(--bg-2); }

/* ═══════════════════════ MOTION ═══════════════════════ */
/* One vocabulary below the rail: every transition rides the shared token
   curve — reveals at 500-700ms, micro-interactions at 150-250ms. */
.lp {
  --ease-out: var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  --micro: 200ms var(--ease-out);
}

/* Scroll reveals — one-shot rise (observer unobserves after entry),
   unified 60ms sibling stagger for grouped elements */
[data-reveal] {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity 600ms var(--ease-out) var(--reveal-delay, 0ms),
    transform 600ms var(--ease-out) var(--reveal-delay, 0ms);
}
[data-reveal].is-visible {
  opacity: 1;
  transform: translateY(0);
}
.rv-d1 { --reveal-delay: 60ms; }
.rv-d2 { --reveal-delay: 120ms; }
.rv-d3 { --reveal-delay: 180ms; }
.rv-d4 { --reveal-delay: 240ms; }

/* Demo output: build-up triggered when demo-frame enters viewport */
.demo-line {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
.demo-pop {
  opacity: 0;
}
.demo-frame.is-visible .demo-line {
  animation: mc-draw 520ms var(--ease-out) var(--mc-delay, 0ms) forwards;
}
/* demo-pop nodes carry positioning transforms — animate opacity only */
.demo-frame.is-visible .demo-pop {
  animation: mc-fade 500ms var(--ease-out) var(--mc-delay, 0ms) forwards;
}

@keyframes lp-rise {
  to { opacity: 1; transform: translateY(0); }
}
@keyframes mc-fade {
  to { opacity: 1; }
}
@keyframes mc-draw {
  to { stroke-dashoffset: 0; }
}

/* ═══════════════════════ FOCUS ═══════════════════════ */
/* Visible teal focus ring on every interactive element — including the
   CTAs over the video, where the scrim keeps the ring legible. Rings are
   never clipped: masked spans (.ch-line) contain no focusables. */
.lp :is(a, button):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* ═══════════════════════ BUTTONS ═══════════════════════ */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 22px;
  background: var(--accent);
  color: #09090B;
  font-family: var(--sans);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 18px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  transition: background var(--micro), transform 150ms var(--ease-out);
}

.btn-primary:hover { background: #00BFAB; }
.btn-primary:active { transform: scale(0.97); }

.btn-outline {
  display: inline-flex;
  align-items: center;
  padding: 14px 22px;
  background: transparent;
  color: var(--text);
  font-family: var(--sans);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  border: 1px solid var(--border-4);
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  transition:
    border-color var(--micro),
    color var(--micro),
    transform 150ms var(--ease-out);
}

.btn-outline:hover { border-color: var(--text-2); }
.btn-outline:active { transform: scale(0.97); }

.btn-lg { padding: 16px 24px; font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 20px; }
.btn-lg.btn-primary { font-weight: 600; }
.btn-lg.btn-outline { font-weight: 500; }

/* ═══════════════════════ HERO — SCRUB RAIL ═══════════════════════ */
/* Outer rail provides the scroll runway; the stage stays pinned for the
   full 400vh while the frame sequence scrubs underneath the chapters. */
.rail {
  position: relative;
  height: 400vh;
  background: #0A0A0C;
}

.rail-stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  color: #FAFAFA;
}

/* Readability scrim — text never sits on raw video.
   Top band: >= 0.88 backing under the (transparent) nav so its light links
   hold >= 4.5:1 even against the brightest possible frame.
   Bottom ramp: >= 0.82 behind the subtitle/CTA/receipt zone (small text),
   >= 0.55 behind the headline zone (large-scale text still clears 4.5:1
   worst-case); the middle stays clear so the video reads through. */
.rail-scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(10, 10, 12, 0.88) 0%,
    rgba(10, 10, 12, 0.88) 7%,
    rgba(10, 10, 12, 0) 20%,
    rgba(10, 10, 12, 0) 34%,
    rgba(10, 10, 12, 0.55) 52%,
    rgba(10, 10, 12, 0.82) 66%,
    rgba(10, 10, 12, 0.94) 100%
  );
}

.rail-chapters {
  position: absolute;
  inset: 0;
  z-index: 3;
}

/* ── Chapters — swap at progress breakpoints ── */
.ch {
  position: absolute;
  left: var(--lp-gutter);
  right: var(--lp-gutter);
  bottom: clamp(56px, 10vh, 128px);
  max-width: 720px;
  opacity: 0;
  pointer-events: none;
  /* Exit: fast compact fade */
  transition: opacity 250ms var(--ease-out);
}

.ch.is-active {
  opacity: 1;
  pointer-events: auto;
}

/* Masked line-rise: each line clips its riser in an overflow:hidden span */
.ch-head {
  margin: 0 0 28px;
}

.ch-line {
  display: block;
  overflow: hidden;
}

.ch-line-inner {
  display: block;
  transform: translateY(110%);
  transition: transform 900ms var(--ease-out);
}

.lp.is-loaded .ch.is-active .ch-line-inner {
  transform: translateY(0);
}

/* Softer rise for subtitle / CTAs / receipt — opacity + transform only,
   never masked (clipping would cut button focus rings). */
.ch-soft {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 600ms var(--ease-out), transform 600ms var(--ease-out);
}

.lp.is-loaded .ch.is-active .ch-soft {
  opacity: 1;
  transform: translateY(0);
}

/* 70ms stagger scale shared by lines and soft risers */
.chd-1 { transition-delay: 70ms; }
.chd-2 { transition-delay: 140ms; }
.chd-3 { transition-delay: 210ms; }
.chd-4 { transition-delay: 280ms; }

/* ── Chapter typography — hard-coded light: this copy always sits on the
      dark video, in BOTH themes. Never inherit theme text tokens here. ── */
.ch-t1 {
  font-family: var(--sans);
  font-size: clamp(44px, 5.2vw, 78px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.02;
  color: #FAFAFA;
}

.ch-t2 {
  font-family: var(--serif);
  font-size: clamp(48px, 5.8vw, 88px);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--accent);
}

.ch--minor .ch-t1 { font-size: clamp(36px, 4.2vw, 60px); }
.ch--minor .ch-t2 { font-size: clamp(40px, 4.8vw, 68px); }

.ch-sub {
  font-family: var(--sans);
  font-size: calc(18px * var(--nc-text-scale, 1));
  line-height: 30px;
  color: #D4D4D8;
  max-width: 560px;
  margin: 0 0 36px;
}

.ch--minor .ch-sub { margin-bottom: 0; }

.ch-cta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.ch-receipt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 16px;
  color: #A1A1AA;
  margin: 0;
}

.ch-receipt svg { color: #A1A1AA; flex-shrink: 0; }

/* Buttons over the video keep light-on-dark styling in both themes */
.rail-stage .btn-outline,
.hero-static .btn-outline {
  color: #FAFAFA;
  border-color: rgba(250, 250, 250, 0.4);
}

@media (hover: hover) {
  .rail-stage .btn-outline:hover,
  .hero-static .btn-outline:hover {
    border-color: rgba(250, 250, 250, 0.75);
  }
}

/* ═══════════════════════ HERO — STATIC FALLBACK ═══════════════════════ */
.hero-static {
  position: relative;
  height: 100vh;
  height: 100dvh;
  min-height: 560px;
  overflow: hidden;
  background: #0A0A0C;
  color: #FAFAFA;
}

.hero-static-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-static-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-static-copy {
  position: absolute;
  left: var(--lp-gutter);
  right: var(--lp-gutter);
  bottom: clamp(56px, 10vh, 128px);
  z-index: 3;
  max-width: 720px;
}

.hero-static-copy .ch-t1,
.hero-static-copy .ch-t2 {
  display: block;
}

/* One-time entrance for the static hero copy */
.hs-rise {
  opacity: 0;
  transform: translateY(8px);
}
.lp.is-loaded .hs-rise {
  animation: lp-rise 420ms var(--ease-out) both;
}
.hrd-1 { animation-delay: 60ms; }
.hrd-2 { animation-delay: 140ms; }
.hrd-3 { animation-delay: 200ms; }
.hrd-4 { animation-delay: 260ms; }

/* ═══════════════════════ SECTIONS ═══════════════════════ */
/* One vertical beat (--lp-sec-y) and one gutter (--lp-gutter) for every
   band; borders/backgrounds stay full-bleed, content stays centered. */
.sec {
  padding: var(--lp-sec-y) var(--lp-gutter);
  border-top: 1px solid var(--border);
}

.sec-02 { background: var(--bg-2); }
.sec-03 { padding-inline: 0; }
.sec-03 .sec-grid--head { padding: 0 var(--lp-gutter); }
/* 03/04 zero their own inline padding so children's --lp-gutter %
   resolves against the full viewport width (keeps content centered). */
.sec-04 { background: var(--bg-2); padding-inline: 0; border-top: none; }

.sec-grid {
  display: flex;
  align-items: flex-start;
  gap: 64px;
}

.sec-grid--head { margin-bottom: 64px; }

.sec-eyebrow {
  flex-basis: 280px;
  flex-grow: 0;
  flex-shrink: 0;
  padding-top: 6px;
  font-family: var(--mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text-3);
}

.sec-aside {
  flex-basis: 280px;
  flex-grow: 0;
  flex-shrink: 0;
  padding-top: 6px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 32px;
}

.sec-aside .sec-eyebrow { flex-basis: auto; padding-top: 0; }

.browse-all {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--border-3);
  border-radius: 10px;
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text);
  text-decoration: none;
  transition: border-color var(--micro), background var(--micro);
}

.browse-all:hover { border-color: var(--border-4); background: var(--bg-3); }

.sec-body {
  flex: 1;
  min-width: 0;
}

.sec-h {
  font-family: var(--sans);
  font-size: clamp(32px, 3.4vw, 48px);
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.25;
  color: var(--text);
  margin: 0 0 32px;
  max-width: 880px;
}

.sec-h2 {
  font-family: var(--sans);
  font-size: clamp(28px, 2.8vw, 40px);
  font-weight: 600;
  letter-spacing: -0.022em;
  line-height: 1.3;
  color: var(--text);
  margin: 0;
  max-width: 760px;
}

.sec-p {
  font-family: var(--sans);
  font-size: calc(17px * var(--nc-text-scale, 1));
  line-height: 1.7;
  color: var(--text-2);
  margin: 0;
  max-width: 68ch;
}

/* ── 02 Demo Frame ── */
.demo-frame {
  display: flex;
  border: 1px solid var(--border-2);
  border-radius: 16px;
  overflow: hidden;
  min-height: 520px;
}

.demo-input {
  flex: 0 0 420px;
  background: var(--bg);
  border-right: 1px solid var(--border-2);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.demo-input-label {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 14px;
  color: var(--text-3);
}

.demo-input-text {
  font-family: var(--sans);
  font-size: calc(17px * var(--nc-text-scale, 1));
  line-height: 28px;
  color: var(--text);
  margin: 0;
}

.demo-caret {
  display: inline-block;
  width: 1px;
  background: var(--accent);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.demo-input-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}

.demo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-3);
  border: 1px solid var(--border-3);
  border-radius: 8px;
}

.demo-row-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  flex-shrink: 0;
}

.demo-row-name,
.demo-row-text {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text);
}

.demo-row-text { color: var(--text-2); }

.demo-row-meta {
  margin-left: auto;
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 14px;
  color: var(--text-3);
}

.demo-output {
  flex: 1;
  background: var(--bg-2);
  position: relative;
  overflow: hidden;
  min-height: 520px;
}

.demo-output-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(63, 63, 70, 0.3) 0%, transparent 70%);
  opacity: 0.5;
  pointer-events: none;
}

.demo-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.demo-node {
  position: absolute;
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text);
  background: var(--bg-3);
  border: 1px solid var(--border-3);
  border-radius: 10px;
  padding: 9px 13px;
  z-index: 2;
}

.demo-node--root {
  background: var(--surface);
  border-color: var(--accent);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 18px;
  padding: 11px 14px;
}

.demo-node--leaf {
  background: var(--bg-2);
  border-color: var(--border-3);
  border-radius: 9px;
  padding: 8px 12px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--text-2);
}

/* Demo graph — edge draw delays */
.de-1 { --mc-delay: 200ms; }
.de-2 { --mc-delay: 240ms; }
.de-3 { --mc-delay: 280ms; }
.de-4 { --mc-delay: 480ms; }
.de-5 { --mc-delay: 520ms; }
.de-6 { --mc-delay: 560ms; }
.de-7 { --mc-delay: 600ms; }
.de-8 { --mc-delay: 640ms; }

/* Demo graph — node positions + pop delays (was inline, now classed) */
.dn-root { left: 50%; bottom: 81%; transform: translateX(-50%); width: 170px; --mc-delay: 120ms; }
.dn-m1 { left: 22%; top: 50%; transform: translate(-50%, -50%); width: 154px; --mc-delay: 360ms; }
.dn-m2 { left: 50%; top: 50%; transform: translate(-50%, -50%); width: 154px; --mc-delay: 400ms; }
.dn-m3 { left: 78%; top: 50%; transform: translate(-50%, -50%); width: 154px; --mc-delay: 440ms; }
.dn-l1 { left: 15%; top: 81%; transform: translateX(-50%); width: 150px; --mc-delay: 680ms; }
.dn-l2 { left: 30%; top: 81%; transform: translateX(-50%); width: 150px; --mc-delay: 720ms; }
.dn-l3 { left: 46%; top: 81%; transform: translateX(-50%); width: 150px; --mc-delay: 760ms; }
.dn-l4 { left: 76%; top: 81%; transform: translateX(-50%); width: 150px; --mc-delay: 800ms; }
.dn-l5 { left: 87%; top: 81%; transform: translateX(-50%); width: 150px; --mc-delay: 840ms; }

/* ── 03 Steps ── */
.steps {
  display: flex;
  flex-direction: column;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 64px;
  padding: 48px var(--lp-gutter);
  border-top: 1px solid var(--border);
}

.step--last { border-bottom: 1px solid var(--border); }

.step-num {
  flex-basis: 280px;
  flex-grow: 0;
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  gap: 18px;
}

.step-numeral {
  font-family: var(--serif);
  font-style: italic;
  font-size: calc(64px * var(--nc-text-scale, 1));
  line-height: 1;
  color: var(--accent);
}

:root.light .step-numeral { color: #00A898; }

.step-label {
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text-2);
}

.step-body {
  flex: 1;
  min-width: 0;
  max-width: 640px;
}

.step-body h3 {
  font-family: var(--sans);
  font-size: clamp(22px, 2vw, 28px);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.28;
  color: var(--text);
  margin: 0 0 12px;
}

.step-body p {
  font-family: var(--sans);
  font-size: calc(16px * var(--nc-text-scale, 1));
  line-height: 1.7;
  color: var(--text-2);
  margin: 0;
  max-width: 68ch;
}

.step-chip {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 11px 14px;
  background: var(--surface);
  border: 1px solid var(--border-4);
  border-radius: 10px;
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text);
  white-space: nowrap;
}

.chip-sm {
  padding: 8px 12px;
  background: var(--bg-3);
  border-color: var(--border-3);
  border-radius: 8px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--text-2);
}

.chip-kbd {
  padding: 11px 14px;
  background: var(--bg-3);
  border-color: var(--border-3);
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.kbd-key {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 14px;
  color: var(--text-2);
}

.kbd-sep {
  font-family: var(--sans);
  font-size: calc(12px * var(--nc-text-scale, 1));
  line-height: 16px;
  color: var(--text-3);
  margin: 0 4px;
}

.kbd-text {
  font-family: var(--sans);
  font-size: calc(12px * var(--nc-text-scale, 1));
  line-height: 16px;
  color: var(--text);
}

/* ── 04 Templates ── */
.sec-04 .sec-grid--head {
  padding-inline: var(--lp-gutter);
}

.tpl-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  padding-inline: var(--lp-gutter);
}

.tpl {
  height: 360px;
  background: var(--bg-3);
  border: 1px solid var(--border-2);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color var(--micro), background var(--micro);
  text-decoration: none;
  color: inherit;
}

@media (hover: hover) {
  .tpl:hover { border-color: var(--border-4); }
}

.tpl-preview {
  /* Lock the tree to its design aspect (280×208) and cap its width so it stays
     compact and centered instead of stretching flat across wide cards. Because
     the box aspect now equals the viewBox aspect, preserveAspectRatio:none
     scales uniformly — no distorted strokes — and every node/line maps 1:1. */
  position: relative;
  width: 280px;
  max-width: 100%;
  aspect-ratio: 280 / 208;
  margin: 0 auto;
  flex-shrink: 0;
}

.tpl-preview svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.tpl-node {
  position: absolute;
  padding: 4px 8px;
  background: var(--bg-2);
  border: 1px solid var(--border-3);
  border-radius: 6px;
  font-family: var(--sans);
  font-size: calc(10px * var(--nc-text-scale, 1));
  line-height: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.tpl-node--root {
  left: 50%;
  top: 6.7%;
  transform: translateX(-50%);
  background: var(--surface);
  border-color: var(--border-4);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 14px;
  color: var(--text);
}

/* Tree rows — vertical positions as a % of the preview height (= SVG viewBox
   height 208), so they track the box even when it scales down on narrow cards. */
.tpl-node--mid { top: 40.4%; color: var(--text-2); }
.tpl-node--leaf { top: 77.9%; color: var(--text-3); }

/* Tree columns — percentages mirror the SVG connector endpoints (x = 50/140/230 of the 280
   viewBox). The preview width is fluid and the SVG stretches with it (preserveAspectRatio:none),
   so anchoring nodes proportionally keeps every label glued to its line at any card width. */
.tpl-node--col-l { left: 17.857%; transform: translateX(-50%); }
.tpl-node--col-c { left: 50%; transform: translateX(-50%); }
.tpl-node--col-r { left: 82.143%; transform: translateX(-50%); }

.tpl-node--ai {
  background: var(--accent-soft);
  border: 1px dashed var(--accent);
  color: var(--accent);
}

.tpl-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--border-2);
}

.tpl-meta h3 {
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 18px;
  color: var(--text);
  margin: 0;
}

.tpl-meta p {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.5;
  color: var(--text-3);
  margin: 0;
}

/* ── 05 Privacy cols ── */
.privacy-cols {
  display: flex;
  border-top: 1px solid var(--border-2);
  margin-top: 40px;
}

.privacy-col {
  flex: 1;
  padding: 28px 32px 28px 0;
  border-right: 1px solid var(--border-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.privacy-col:not(:first-child) { padding-left: 32px; }
.privacy-col:last-child {
  border-right: none;
  padding-right: 0;
}

.privacy-col h3 {
  font-family: var(--sans);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 18px;
  color: var(--text);
  margin: 0;
}

.privacy-col p {
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  line-height: 1.6;
  color: var(--text-2);
  margin: 0;
  max-width: 60ch;
}

/* ═══════════════════════ FINAL CTA ═══════════════════════ */
.cta {
  padding: calc(var(--lp-sec-y) * 1.5) var(--lp-gutter) calc(var(--lp-sec-y) * 1.25);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.cta-h {
  font-family: var(--serif);
  font-size: clamp(64px, 9vw, 128px);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 0.92;
  color: var(--text);
  margin: 0 0 48px;
  max-width: 1100px;
}

.cta-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.cta-receipt {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.5;
  color: var(--text-3);
  margin: 0;
}

/* ═══════════════════════ FOOTER ═══════════════════════ */
.footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 48px var(--lp-gutter) 36px;
  border-top: 1px solid var(--border);
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-brand-name {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text-2);
}

.footer-meta {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 14px;
  color: var(--text-3);
}

.footer-meta--credit {
  font-weight: 500;
  letter-spacing: 0.04em;
  margin-top: 6px;
}

.footer-cols {
  display: flex;
  align-items: flex-start;
  gap: 32px;
}

.footer-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: flex-start;
}

.footer-col-head {
  font-family: var(--sans);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 16px;
  color: var(--text-3);
}

.footer-col a {
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 1.5;
  color: var(--text-2);
  text-decoration: none;
  transition: color var(--micro);
}

.footer-col a:hover { color: var(--text); }

/* ═══════════════════════ RESPONSIVE ═══════════════════════ */
/* Gutters and vertical rhythm cascade from the .lp variables — the
   breakpoints only retune the scale, never re-list paddings. */
@media (max-width: 1280px) {
  .lp { --lp-pad-x: 32px; }
  .nav { padding-block: 20px; }
  .tpl-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1024px) {
  .demo-frame { flex-direction: column; }
  .demo-input { flex: none; border-right: none; border-bottom: 1px solid var(--border-2); }
  .demo-output { min-height: 480px; }
  .step { gap: 32px; }
  .step-chip { display: none; }
  .privacy-cols { flex-direction: column; }
  .privacy-col { border-right: none; border-bottom: 1px solid var(--border-2); padding: 24px 0; }
  .privacy-col:not(:first-child) { padding-left: 0; }
  .privacy-col:last-child { border-bottom: none; }
}

@media (max-width: 768px) {
  .lp { --lp-pad-x: 20px; --lp-sec-y: 72px; }
  .nav { padding-block: 16px; }
  .nav-links { display: none; }
  .hero-static { min-height: 100svh; }
  .hero-static-copy { bottom: 48px; }
  .ch-t1 { font-size: clamp(38px, 11vw, 56px); }
  .ch-t2 { font-size: clamp(42px, 12vw, 62px); }
  .ch-sub { font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 26px; margin-bottom: 28px; }
  .ch-cta { flex-direction: column; align-items: stretch; width: 100%; }
  .ch-cta .btn-primary, .ch-cta .btn-outline { justify-content: center; }
  .sec-grid, .sec-grid--head { flex-direction: column; gap: 16px; }
  .sec-grid--head { margin-bottom: 40px; }
  .sec-eyebrow, .sec-aside { flex-basis: auto; padding-top: 0; }
  .tpl-rail { grid-template-columns: minmax(0, 1fr); }
  .sec-h { font-size: calc(28px * var(--nc-text-scale, 1)); line-height: 1.25; }
  .sec-h2 { font-size: calc(24px * var(--nc-text-scale, 1)); }
  .step { flex-direction: column; gap: 16px; padding-block: 32px; }
  .step-num { flex-basis: auto; }
  .step-numeral { font-size: calc(48px * var(--nc-text-scale, 1)); }
  .step-body h3 { font-size: calc(20px * var(--nc-text-scale, 1)); }
  .cta-h { font-size: calc(44px * var(--nc-text-scale, 1)); line-height: 1; }
  .cta-row { flex-direction: column; align-items: stretch; width: 100%; }
  .cta-row .btn-primary, .cta-row .btn-outline { justify-content: center; }
  .footer { flex-direction: column; align-items: flex-start; gap: 32px; padding-block: 32px; }
  .footer-cols { flex-wrap: wrap; gap: 24px; }
}

/* ═══════════════════════ REDUCED MOTION ═══════════════════════ */
@media (prefers-reduced-motion: reduce) {
  /* Nav overlay still toggles (contrast requires it) — just without motion.
     Hover/press micro-transitions collapse to instant state changes. */
  .lp .nav,
  .lp .nav-links a,
  .lp .nav-signin,
  .lp .nav-dash,
  .lp .btn-primary,
  .lp .btn-outline,
  .lp .browse-all,
  .lp .tpl,
  .lp .footer-col a {
    transition: none !important;
  }
  .lp .hs-rise,
  .lp .demo-line,
  .lp .demo-pop,
  .lp [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    stroke-dashoffset: 0 !important;
    animation: none !important;
    transition: none !important;
  }
  /* Chapters keep their is-active visibility gating, but never animate.
     (The scrub rail itself is already disabled under reduced motion.) */
  .lp .ch {
    transition: none !important;
  }
  .lp .ch-line-inner,
  .lp .ch-soft {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }
  .demo-caret { animation: none; }
}
</style>
