<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useGuestMode } from '~/composables/useGuestMode'

definePageMeta({ layout: false })

const { t } = useI18n()

/* ---- real product CTAs: guest mode / auth-aware (kept from the old page) */
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

/* ---- smooth scroll bus (Lenis ↔ ScrollTrigger, one RAF loop) ------------ */
let lenis: Lenis | null = null
let lenisTick: ((time: number) => void) | null = null
const triggers: ScrollTrigger[] = []

const scrollToTarget = (target: string) => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth'
  if (target === '#top') {
    if (lenis) lenis.scrollTo(0, { duration: 1.6 })
    else window.scrollTo({ top: 0, behavior })
    return
  }
  const el = document.querySelector<HTMLElement>(target)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { duration: 1.6 })
  else el.scrollIntoView({ behavior })
}
provide('journey-scroll', scrollToTarget)
provide('journey-lock', (locked: boolean) => {
  if (!lenis) return
  if (locked) lenis.stop()
  else lenis.start()
})

useSeoMeta({
  title: () => t('topo.meta.title'),
  description: () => t('topo.meta.description'),
  ogTitle: () => t('topo.meta.title'),
  ogDescription: () => t('topo.meta.description'),
})

onMounted(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  gsap.registerPlugin(ScrollTrigger)

  if (!reducedMotion) {
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

  // quiet fade-rise for station prose (titles reveal themselves)
  if (!reducedMotion) {
    for (const el of gsap.utils.toArray<HTMLElement>(
      '.lp .station__eyebrow, .lp .station__body, .lp .station__chip, .lp .finale__sub, .lp .finale .cta-row',
    )) {
      gsap.set(el, { autoAlpha: 0, y: 26 })
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top 86%',
          once: true,
          onEnter: () =>
            gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out' }),
        }),
      )
    }
  }
})

onBeforeUnmount(() => {
  triggers.forEach((tr) => tr.kill())
  if (lenisTick) gsap.ticker.remove(lenisTick)
  lenis?.destroy()
  lenis = null
})
</script>

<template>
  <div class="lp">
    <LandingTopoCanvas />
    <LandingCursorReticle />
    <LandingSiteNav />

    <main id="content" class="journey">
      <!-- hero -->
      <section id="top" class="section hero">
        <p class="hero__eyebrow">{{ t('topo.hero.eyebrow') }}</p>
        <LandingRevealText
          :text="t('topo.hero.title')"
          as="h1"
          class="hero__title"
          immediate
          :delay="0.5"
        />
        <p class="hero__sub">{{ t('topo.hero.sub') }}</p>
        <div class="cta-row">
          <button class="btn-primary" type="button" data-cursor="link" @click="handleTryFree">
            {{ t('topo.hero.ctaPrimary') }}
          </button>
          <button
            class="btn-ghost"
            type="button"
            data-cursor="link"
            @click="scrollToTarget('#generate')"
          >
            {{ t('topo.hero.ctaSecondary') }}
          </button>
        </div>
        <div class="hero__scroll">
          <span>{{ t('topo.hero.scroll') }}</span>
          <span class="wire" />
        </div>
      </section>

      <!-- stations -->
      <LandingStationSection
        id="generate"
        num="01"
        :eyebrow="t('topo.s1.eyebrow')"
        :title="t('topo.s1.title')"
        :body="t('topo.s1.body')"
        side="left"
      />
      <LandingStationSection
        id="connect"
        num="02"
        :eyebrow="t('topo.s2.eyebrow')"
        :title="t('topo.s2.title')"
        :body="t('topo.s2.body')"
        chip="embedding <=> query · HNSW · pgvector"
        side="right"
      />
      <LandingStationSection
        id="collaborate"
        num="03"
        :eyebrow="t('topo.s3.eyebrow')"
        :title="t('topo.s3.title')"
        :body="t('topo.s3.body')"
        side="left"
      />
      <LandingStationSection
        id="everywhere"
        num="04"
        :eyebrow="t('topo.s4.eyebrow')"
        :title="t('topo.s4.title')"
        :body="t('topo.s4.body')"
        side="right"
      />

      <!-- finale -->
      <section id="map" class="section finale">
        <p class="finale__eyebrow">{{ t('topo.finale.eyebrow') }}</p>
        <LandingRevealText :text="t('topo.finale.title')" as="h2" class="finale__title" />
        <p class="finale__sub">{{ t('topo.finale.sub') }}</p>
        <div class="cta-row">
          <button class="btn-primary" type="button" data-cursor="link" @click="handleTryFree">
            {{ t('topo.finale.cta') }}
          </button>
        </div>
      </section>

      <LandingSiteFooter />
    </main>

    <LandingDepthRail />
  </div>
</template>
