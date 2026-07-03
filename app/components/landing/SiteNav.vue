<script setup lang="ts">
import { gsap } from 'gsap'

/**
 * Landing chrome: fixed header (brand · product nav · locale · sign-in) +
 * fullscreen menu on mobile, plus the canvas-space coordinates readout.
 * Adapted from the standalone landing for the app (no_prefix i18n,
 * internal routes, NcLogo).
 */
const { t, locale, setLocale } = useI18n()
const lock = inject<(locked: boolean) => void>('journey-lock', () => {})

const ready = ref(false)
const open = ref(false)
const overlay = ref<HTMLElement | null>(null)
const menuBtn = ref<HTMLElement | null>(null)
const coords = ref('x 0.500 · y 0.500 · d 0000')
const coordsHidden = ref(false)

interface NavLink {
  label: string
  to?: string
  href?: string
  external?: boolean
}

const links = computed<NavLink[]>(() => [
  // header nav shows the first three; the mobile menu lists everything
  { label: t('topo.nav.download'), to: '/download' },
  { label: t('topo.nav.docs'), to: '/docs' },
  { label: 'GitHub', href: 'https://github.com/vanjamodrinjak21/neuro-canvas', external: true },
  { label: t('topo.nav.signin'), to: '/auth/signin' },
])

function toggleLocale() {
  const next = locale.value === 'en' ? 'hr' : 'en'
  setLocale(next)
  if (typeof localStorage !== 'undefined') localStorage.setItem('i18n_locale', next)
}

let reduced = false
let coordsRaf = 0

function animateOpen() {
  if (!overlay.value || reduced) return
  const rows = overlay.value.querySelectorAll('.menu__item, .menu__meta')
  gsap.fromTo(
    rows,
    { autoAlpha: 0, y: 42 },
    { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out', delay: 0.12 },
  )
}

function toggle(force?: boolean) {
  open.value = force ?? !open.value
  document.documentElement.classList.toggle('is-menu-open', open.value)
  lock(open.value)
  if (open.value) {
    nextTick(() => {
      animateOpen()
      overlay.value?.focus()
    })
  } else {
    menuBtn.value?.focus()
  }
}

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && open.value) {
    toggle(false)
    return
  }
  if (e.key === 'Tab' && open.value && overlay.value) {
    const focusables = overlay.value.querySelectorAll<HTMLElement>('button, a[href]')
    if (!focusables.length) return
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    const active = document.activeElement as HTMLElement | null
    if (!active || !overlay.value.contains(active)) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

let px = 0.5
let py = 0.5

function renderCoords() {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const d = max > 0 ? Math.round((window.scrollY / max) * 1200) : 0
  coords.value = `x ${px.toFixed(3)} · y ${py.toFixed(3)} · d ${String(d).padStart(4, '0')}`
  coordsHidden.value = d > 1140
}

const onPointer = (e: PointerEvent) => {
  px = e.clientX / window.innerWidth
  py = e.clientY / window.innerHeight
  cancelAnimationFrame(coordsRaf)
  coordsRaf = requestAnimationFrame(renderCoords)
}

const onScroll = () => {
  cancelAnimationFrame(coordsRaf)
  coordsRaf = requestAnimationFrame(renderCoords)
}

onMounted(() => {
  ready.value = true
  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointermove', onPointer)
  window.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(coordsRaf)
  document.documentElement.classList.remove('is-menu-open')
})
</script>

<template>
  <a class="skip-link" href="#content">{{ t('topo.a11y.skip') }}</a>

  <header class="site-header" :class="{ 'is-ready': ready }">
    <NuxtLink to="/" class="brand" aria-label="NeuroCanvas" data-cursor="link">
      <NcLogo :size="24" :container="false" />
      <span>NeuroCanvas</span>
    </NuxtLink>

    <nav class="header-nav" aria-label="Site">
      <template v-for="l in links.slice(0, 3)" :key="l.label">
        <NuxtLink v-if="l.to" class="header-nav__item" :to="l.to" data-cursor="link">
          {{ l.label }}
        </NuxtLink>
        <a
          v-else
          class="header-nav__item"
          :href="l.href"
          :target="l.external ? '_blank' : undefined"
          :rel="l.external ? 'noopener' : undefined"
          data-cursor="link"
          >{{ l.label
          }}<span v-if="l.external" class="sr-only">{{ t('topo.a11y.newTab') }}</span></a
        >
      </template>
    </nav>

    <div class="header-right">
      <nav class="locale-switch" aria-label="Language">
        <button
          type="button"
          :class="{ 'is-active': locale === 'en' }"
          data-cursor="link"
          @click="locale !== 'en' && toggleLocale()"
        >
          EN
        </button>
        <button
          type="button"
          :class="{ 'is-active': locale === 'hr' }"
          data-cursor="link"
          @click="locale !== 'hr' && toggleLocale()"
        >
          HR
        </button>
      </nav>
      <NuxtLink class="header-cta" to="/auth/signin" data-cursor="link">
        {{ t('topo.nav.signin') }}
      </NuxtLink>
      <button
        ref="menuBtn"
        class="menu-btn"
        type="button"
        data-cursor="link"
        :aria-expanded="open"
        aria-controls="site-menu"
        @click="toggle()"
      >
        <span class="menu-btn__tick" aria-hidden="true" />
        {{ open ? t('topo.nav.close') : t('topo.nav.menu') }}
      </button>
    </div>
  </header>

  <!-- fullscreen menu — mobile only -->
  <div
    v-show="open"
    id="site-menu"
    ref="overlay"
    class="menu"
    role="dialog"
    aria-modal="true"
    aria-labelledby="site-menu-title"
    tabindex="-1"
    data-lenis-prevent
  >
    <div class="menu__inner">
      <p id="site-menu-title" class="menu__eyebrow">{{ t('topo.nav.menu') }}</p>
      <nav class="menu__list">
        <template v-for="(l, i) in links" :key="l.label">
          <NuxtLink
            v-if="l.to"
            class="menu__item"
            :to="l.to"
            data-cursor="link"
            @click="toggle(false)"
          >
            <span class="menu__num">0{{ i + 1 }}</span>
            <span class="menu__label"
              ><span class="menu__roll"
                ><span>{{ l.label }}</span
                ><span aria-hidden="true">{{ l.label }}</span></span
              ></span
            >
            <span class="menu__elev" aria-hidden="true">→</span>
          </NuxtLink>
          <a
            v-else
            class="menu__item"
            :href="l.href"
            :target="l.external ? '_blank' : undefined"
            :rel="l.external ? 'noopener' : undefined"
            data-cursor="link"
          >
            <span class="menu__num">0{{ i + 1 }}</span>
            <span class="menu__label"
              ><span class="menu__roll"
                ><span>{{ l.label }}</span
                ><span aria-hidden="true">{{ l.label }}</span></span
              ></span
            >
            <span class="menu__elev" aria-hidden="true">↗</span>
            <span v-if="l.external" class="sr-only">{{ t('topo.a11y.newTab') }}</span>
          </a>
        </template>
      </nav>
      <div class="menu__meta">
        <button type="button" data-cursor="link" @click="toggle(false)">
          {{ t('topo.nav.close') }}
        </button>
        <NuxtLink to="/dashboard" data-cursor="link" @click="toggle(false)">
          {{ t('topo.nav.open') }} →
        </NuxtLink>
        <button
          type="button"
          :class="{ 'is-active': locale === 'en' }"
          data-cursor="link"
          @click="locale !== 'en' && toggleLocale()"
        >
          EN
        </button>
        <button
          type="button"
          :class="{ 'is-active': locale === 'hr' }"
          data-cursor="link"
          @click="locale !== 'hr' && toggleLocale()"
        >
          HR
        </button>
      </div>
    </div>
  </div>

  <!-- surveying readout -->
  <div class="coords" :class="{ 'is-hidden': coordsHidden }" aria-hidden="true">{{ coords }}</div>
</template>
