<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Landing footer: CTA line, link columns, the giant teal wordmark that
 * rises with a scroll scrub, and a meta row. Adapted for the app —
 * every product link is an internal route.
 */
const { t, locale, setLocale } = useI18n()
const scrollTo = inject<(target: string) => void>('journey-scroll', () => {})

const root = ref<HTMLElement | null>(null)
const letters = 'NEUROCANVAS'.split('')
let scrub: gsap.core.Tween | null = null

const explore = computed(() => [
  { id: '#generate', label: t('topo.s1.eyebrow') },
  { id: '#connect', label: t('topo.s2.eyebrow') },
  { id: '#collaborate', label: t('topo.s3.eyebrow') },
  { id: '#everywhere', label: t('topo.s4.eyebrow') },
])

function toggleLocale() {
  const next = locale.value === 'en' ? 'hr' : 'en'
  setLocale(next)
  if (typeof localStorage !== 'undefined') localStorage.setItem('i18n_locale', next)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.registerPlugin(ScrollTrigger)
  const chars = root.value?.querySelectorAll('.wordmark .ch')
  if (!chars?.length) return
  scrub = gsap.fromTo(
    chars,
    { yPercent: 104 },
    {
      yPercent: 0,
      stagger: 0.06,
      ease: 'none',
      scrollTrigger: {
        // the wordmark sits at the document end — the range must fit
        // inside what max-scroll can actually deliver on every viewport
        trigger: root.value!.querySelector('.wordmark'),
        start: 'top 99%',
        end: 'top 86%',
        scrub: 0.6,
      },
    },
  )
})

onBeforeUnmount(() => {
  scrub?.scrollTrigger?.kill()
  scrub?.kill()
})
</script>

<template>
  <footer ref="root" class="site-footer-block" role="contentinfo">
    <div class="footer__cta-row">
      <p class="footer__eyebrow">{{ t('topo.footer.ready') }}</p>
      <NuxtLink class="footer__cta" to="/auth/signup" data-cursor="link">
        {{ t('topo.footer.cta') }} <span class="footer__arrow" aria-hidden="true">→</span>
      </NuxtLink>
    </div>

    <div class="footer__cols">
      <div class="footer__col">
        <p class="footer__col-title">{{ t('topo.footer.colExplore') }}</p>
        <button
          v-for="e in explore"
          :key="e.id"
          type="button"
          class="footer__link"
          data-cursor="link"
          @click="scrollTo(e.id)"
        >
          {{ e.label }}
        </button>
      </div>
      <div class="footer__col">
        <p class="footer__col-title">{{ t('topo.footer.colApp') }}</p>
        <NuxtLink to="/dashboard" class="footer__link" data-cursor="link">
          {{ t('topo.nav.open') }}
        </NuxtLink>
        <NuxtLink to="/download" class="footer__link" data-cursor="link">
          {{ t('topo.nav.download') }}
        </NuxtLink>
        <NuxtLink to="/docs" class="footer__link" data-cursor="link">
          {{ t('topo.nav.docs') }}
        </NuxtLink>
        <NuxtLink to="/templates" class="footer__link" data-cursor="link">
          {{ t('topo.nav.templates') }}
        </NuxtLink>
        <NuxtLink to="/roadmap" class="footer__link" data-cursor="link">
          {{ t('topo.footer.roadmap') }}
        </NuxtLink>
      </div>
      <div class="footer__col">
        <p class="footer__col-title">{{ t('topo.footer.colElse') }}</p>
        <a
          href="https://github.com/vanjamodrinjak21/neuro-canvas"
          target="_blank"
          rel="noopener"
          class="footer__link"
          data-cursor="link"
          >GitHub<span class="sr-only">{{ t('topo.a11y.newTab') }}</span></a
        >
        <button type="button" class="footer__link" data-cursor="link" @click="toggleLocale()">
          {{ locale === 'en' ? 'Hrvatski' : 'English' }}
        </button>
      </div>
    </div>

    <NuxtLink class="wordmark" to="/dashboard" aria-label="NeuroCanvas" data-cursor="link">
      <span v-for="(ch, i) in letters" :key="i" class="ch-mask"
        ><span class="ch"
          ><span class="ch__a">{{ ch }}</span
          ><span class="ch__b" aria-hidden="true">{{ ch }}</span></span
        ></span
      >
    </NuxtLink>

    <div class="footer__meta">
      <span>{{ t('topo.footer.line') }}</span>
      <span class="footer__meta-links">
        <NuxtLink to="/privacy" data-cursor="link">{{ t('topo.footer.privacy') }}</NuxtLink>
        <NuxtLink to="/terms" data-cursor="link">{{ t('topo.footer.terms') }}</NuxtLink>
      </span>
      <button type="button" class="footer__top" data-cursor="link" @click="scrollTo('#top')">
        {{ t('topo.footer.top') }} ↑
      </button>
    </div>
  </footer>
</template>
