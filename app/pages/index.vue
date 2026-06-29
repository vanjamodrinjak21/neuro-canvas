<script setup lang="ts">
import { useGuestMode } from '~/composables/useGuestMode'

definePageMeta({ layout: false })

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

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const lpRoot = ref<HTMLElement | null>(null)

onMounted(() => {
  if (typeof window === 'undefined') return
  // Trigger hero entrance choreography
  requestAnimationFrame(() => lpRoot.value?.classList.add('is-loaded'))

  // Scroll-reveal observer for [data-reveal] elements
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    lpRoot.value?.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible')
    })
    return
  }
  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          obs.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  )
  lpRoot.value?.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => obs.observe(el))
})
</script>

<template>
  <div ref="lpRoot" class="lp">
    <!-- ══════ TOP NAV ══════ -->
    <nav class="nav">
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

    <!-- ══════ HERO SPLIT ══════ -->
    <section class="hero">
      <div class="hero-copy">
        <h1 class="hero-h1 hero-rise" style="--hero-delay: 0ms">{{ $t('landing.hero.title_a') }}</h1>
        <h1 class="hero-h2 hero-rise" style="--hero-delay: 60ms">{{ $t('landing.hero.title_b') }}</h1>
        <p class="hero-sub hero-rise" style="--hero-delay: 140ms">
          {{ $t('landing.hero.subtitle_v2') }}
        </p>
        <div class="hero-cta hero-rise" style="--hero-delay: 200ms">
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
        <p class="hero-receipt hero-rise" style="--hero-delay: 260ms">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13.333 4.667L6 12l-3.333-3.333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ $t('landing.hero.receipt') }}</span>
        </p>
      </div>

      <!-- ══ MINI CANVAS PREVIEW ══ -->
      <div class="mini-canvas hero-rise" style="--hero-delay: 100ms">
        <div class="mc-glow" />

        <!-- top chips -->
        <div class="mc-chip mc-chip--tl mc-rise" style="--mc-delay: 320ms">
          <span class="mc-chip-dot" />
          <span class="mc-chip-text">{{ $t('landing.mini_canvas.session_chip') }}</span>
        </div>
        <div class="mc-chip mc-chip--tc mc-rise" style="--mc-delay: 380ms">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="2" fill="#00D2BE" />
            <circle cx="6" cy="6" r="5" stroke="#00D2BE" stroke-dasharray="2 2" />
          </svg>
          <span>{{ $t('landing.mini_canvas.live_chip') }}</span>
        </div>
        <div class="mc-chip mc-chip--tr mc-rise" style="--mc-delay: 440ms">
          <span class="mc-chip-strong">7</span>
          <span class="mc-chip-mute">{{ $t('landing.mini_canvas.nodes_label') }}</span>
        </div>

        <!-- stage: locked aspect ratio so SVG paths and nodes stay aligned at any canvas width -->
        <div class="mc-stage">
          <!-- edges: 4 mirrored curves radiating from the center "Hero CTA framing" node -->
          <svg class="mc-edges" viewBox="0 0 600 560" preserveAspectRatio="none">
            <path class="mc-line mc-line--draw" style="--mc-delay: 700ms" pathLength="1" d="M180 160 Q 215 205 240 258" stroke="#3F3F46" stroke-width="1.5" fill="none" stroke-linecap="round" />
            <path class="mc-line mc-line--draw" style="--mc-delay: 760ms" pathLength="1" d="M180 400 Q 215 355 240 302" stroke="#3F3F46" stroke-width="1.5" fill="none" stroke-linecap="round" />
            <path class="mc-line mc-line--fade" style="--mc-delay: 900ms" d="M360 258 Q 385 205 420 160" stroke="#00D2BE" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-dasharray="4 4" />
            <path class="mc-line mc-line--fade" style="--mc-delay: 940ms" d="M360 302 Q 385 355 420 400" stroke="#00D2BE" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-dasharray="4 4" />
          </svg>

          <!-- center principle -->
          <div class="mc-node mc-node--root mc-pop" style="left:50%; top:50%; transform:translate(-50%, -50%); width:200px; --mc-delay: 560ms">
            {{ $t('landing.mini_canvas.node_root') }}
          </div>

          <!-- left branch (existing thoughts) -->
          <div class="mc-node mc-pop" style="right:70%; top:28.5%; transform:translateY(-50%); width:172px; --mc-delay: 680ms">{{ $t('landing.mini_canvas.node_left_top') }}</div>
          <div class="mc-node mc-pop" style="right:70%; top:71.5%; transform:translateY(-50%); width:200px; --mc-delay: 740ms">{{ $t('landing.mini_canvas.node_left_bottom') }}</div>

          <!-- right branch (AI suggestions) -->
          <div class="mc-node mc-node--ai mc-pop" style="left:70%; top:28.5%; transform:translateY(-50%); width:205px; --mc-delay: 880ms">
            <span class="mc-ai-eyebrow">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L7.4 4.6L11 6L7.4 7.4L6 11L4.6 7.4L1 6L4.6 4.6L6 1Z" fill="#00D2BE" />
              </svg>
              <span>{{ $t('landing.mini_canvas.ai_suggested') }}</span>
            </span>
            <span class="mc-ai-text">{{ $t('landing.mini_canvas.node_right_top') }}</span>
          </div>
          <div class="mc-node mc-node--ai mc-pop" style="left:70%; top:71.5%; transform:translateY(-50%); width:220px; --mc-delay: 940ms">
            <span class="mc-ai-eyebrow">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L7.4 4.6L11 6L7.4 7.4L6 11L4.6 7.4L1 6L4.6 4.6L6 1Z" fill="#00D2BE" />
              </svg>
              <span>{{ $t('landing.mini_canvas.ai_suggested') }}</span>
            </span>
            <span class="mc-ai-text">{{ $t('landing.mini_canvas.node_right_bottom') }}</span>
          </div>
        </div>

        <!-- bottom prompt bar -->
        <div class="mc-prompt mc-rise" style="--mc-delay: 1100ms">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 1.5L10.95 6.55L16 8.5L10.95 10.45L9 15.5L7.05 10.45L2 8.5L7.05 6.55L9 1.5Z" stroke="#00D2BE" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
          <span class="mc-prompt-text">{{ $t('landing.mini_canvas.prompt_example') }}</span>
          <span class="mc-prompt-kbd">
            <span>⌘</span><span>K</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ══════ 01 — WHY THIS EXISTS ══════ -->
    <section class="sec sec-01">
      <div class="sec-grid">
        <div class="sec-eyebrow" data-reveal>{{ $t('landing.section_01.eyebrow') }}</div>
        <div class="sec-body">
          <h2 class="sec-h" data-reveal style="--reveal-delay: 50ms">{{ $t('landing.section_01.heading') }}</h2>
          <p class="sec-p" data-reveal style="--reveal-delay: 110ms">
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
          <h2 class="sec-h2" data-reveal style="--reveal-delay: 50ms">{{ $t('landing.section_02.heading') }}</h2>
        </div>
      </div>

      <div class="demo-frame" data-reveal style="--reveal-delay: 100ms">
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
            <path class="demo-line" pathLength="1" style="--mc-delay: 200ms" d="M460 100 Q 280 140 200 240" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 240ms" d="M460 100 Q 460 180 460 240" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 280ms" d="M460 100 Q 640 140 720 240" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 480ms" d="M200 280 Q 160 360 140 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 520ms" d="M200 280 Q 240 360 280 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 560ms" d="M460 280 Q 460 360 420 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 600ms" d="M720 280 Q 720 360 700 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
            <path class="demo-line" pathLength="1" style="--mc-delay: 640ms" d="M720 280 Q 760 360 800 420" stroke="#3F3F46" stroke-width="1.5" fill="none" />
          </svg>
          <div class="demo-node demo-node--root demo-pop" style="left:50%; bottom:81%; transform:translateX(-50%); width:170px; --mc-delay: 120ms">{{ $t('landing.section_02.node_root') }}</div>
          <div class="demo-node demo-node--mid demo-pop" style="left:22%; top:50%; transform:translate(-50%, -50%); width:154px; --mc-delay: 360ms">{{ $t('landing.section_02.node_engineering') }}</div>
          <div class="demo-node demo-node--mid demo-pop" style="left:50%; top:50%; transform:translate(-50%, -50%); width:154px; --mc-delay: 400ms">{{ $t('landing.section_02.node_content') }}</div>
          <div class="demo-node demo-node--mid demo-pop" style="left:78%; top:50%; transform:translate(-50%, -50%); width:154px; --mc-delay: 440ms">{{ $t('landing.section_02.node_rollout') }}</div>
          <div class="demo-node demo-node--leaf demo-pop" style="left:15%; top:81%; transform:translateX(-50%); width:150px; --mc-delay: 680ms">{{ $t('landing.section_02.node_leaf_1') }}</div>
          <div class="demo-node demo-node--leaf demo-pop" style="left:30%; top:81%; transform:translateX(-50%); width:150px; --mc-delay: 720ms">{{ $t('landing.section_02.node_leaf_2') }}</div>
          <div class="demo-node demo-node--leaf demo-pop" style="left:46%; top:81%; transform:translateX(-50%); width:150px; --mc-delay: 760ms">{{ $t('landing.section_02.node_leaf_3') }}</div>
          <div class="demo-node demo-node--leaf demo-pop" style="left:76%; top:81%; transform:translateX(-50%); width:150px; --mc-delay: 800ms">{{ $t('landing.section_02.node_leaf_4') }}</div>
          <div class="demo-node demo-node--leaf demo-pop" style="left:87%; top:81%; transform:translateX(-50%); width:150px; --mc-delay: 840ms">{{ $t('landing.section_02.node_leaf_5') }}</div>
        </div>
      </div>
    </section>

    <!-- ══════ 03 — HOW IT WORKS ══════ -->
    <section id="how-it-works" class="sec sec-03">
      <div class="sec-grid sec-grid--head">
        <div class="sec-eyebrow" data-reveal>{{ $t('landing.section_03.eyebrow') }}</div>
        <div class="sec-body">
          <h2 class="sec-h2" data-reveal style="--reveal-delay: 50ms">{{ $t('landing.section_03.heading') }}</h2>
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

        <article class="step" data-reveal style="--reveal-delay: 60ms">
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

        <article class="step step--last" data-reveal style="--reveal-delay: 120ms">
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
          <h2 class="sec-h" data-reveal style="--reveal-delay: 50ms">{{ $t('landing.section_04.heading') }}</h2>
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

        <NuxtLink to="/templates" class="tpl" data-reveal style="--reveal-delay: 50ms">
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

        <NuxtLink to="/templates" class="tpl" data-reveal style="--reveal-delay: 100ms">
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

        <NuxtLink to="/templates" class="tpl" data-reveal style="--reveal-delay: 150ms">
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
          <h2 class="sec-h" data-reveal style="--reveal-delay: 50ms">{{ $t('landing.section_05.heading') }}</h2>
          <div class="privacy-cols">
            <div class="privacy-col" data-reveal style="--reveal-delay: 110ms">
              <h4>{{ $t('landing.section_05.col_local.title') }}</h4>
              <p>{{ $t('landing.section_05.col_local.body') }}</p>
            </div>
            <div class="privacy-col" data-reveal style="--reveal-delay: 170ms">
              <h4>{{ $t('landing.section_05.col_byok.title') }}</h4>
              <p>{{ $t('landing.section_05.col_byok.body') }}</p>
            </div>
            <div class="privacy-col" data-reveal style="--reveal-delay: 230ms">
              <h4>{{ $t('landing.section_05.col_export.title') }}</h4>
              <p>{{ $t('landing.section_05.col_export.body') }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════ FINAL CTA ══════ -->
    <section class="cta">
      <h2 class="cta-h" data-reveal>{{ $t('landing.final_cta.heading') }}</h2>
      <div class="cta-row" data-reveal style="--reveal-delay: 80ms">
        <button type="button" class="btn-primary btn-lg" @click="handleTryFree">
          <span>{{ $t('landing.final_cta.primary') }}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <a href="https://github.com/vanjamodrinjak21/neuro-canvas" target="_blank" rel="noopener" class="btn-outline btn-lg">{{ $t('landing.final_cta.github') }}</a>
      </div>
      <p class="cta-receipt" data-reveal style="--reveal-delay: 160ms">{{ $t('landing.final_cta.receipt') }}</p>
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
   NEUROCANVAS — Try-Free 1 Landing (Paper-exact: DMB-0)
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
  --text-3: #52525B;
  --accent: #00D2BE;
  --accent-soft: rgba(0, 210, 190, 0.08);
  --sans: 'Inter', system-ui, -apple-system, sans-serif;
  --serif: 'Instrument Serif', Georgia, serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;

  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
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
  --text-3: #777777;
}

/* ═══════════════════════ NAV ═══════════════════════ */
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 56px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  z-index: 100;
}

:root.light .nav { background: rgba(250, 250, 249, 0.85); }

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
  transition: color 120ms ease;
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
  transition: color 120ms ease;
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
  transition: border-color 120ms ease, background 120ms ease;
}

.nav-dash:hover { border-color: var(--border-4); background: var(--bg-2); }

/* ═══════════════════════ MOTION ═══════════════════════ */
.lp {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
}

/* Hero entrance — staggered rise on mount (.is-loaded set on next frame) */
.hero-rise {
  opacity: 0;
  transform: translateY(8px);
}
.lp.is-loaded .hero-rise {
  animation: lp-rise 420ms var(--ease-out) var(--hero-delay, 0ms) forwards;
}

/* Mini-canvas: explanatory marketing animation, runs once on mount */
.mc-rise,
.mc-pop {
  opacity: 0;
}
.mc-line--draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
}
.mc-line--fade {
  opacity: 0;
}
.lp.is-loaded .mc-rise {
  animation: lp-rise 380ms var(--ease-out) var(--mc-delay, 0ms) forwards;
}
/* mc-pop nodes carry positioning transforms — animate opacity only */
.lp.is-loaded .mc-pop {
  animation: mc-fade 380ms var(--ease-out) var(--mc-delay, 0ms) forwards;
}
.lp.is-loaded .mc-line--draw {
  animation: mc-draw 520ms var(--ease-out) var(--mc-delay, 0ms) forwards;
}
.lp.is-loaded .mc-line--fade {
  animation: mc-fade 280ms var(--ease-out) var(--mc-delay, 0ms) forwards;
}

/* Scroll reveals — opacity + small lift only */
[data-reveal] {
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 360ms var(--ease-out) var(--reveal-delay, 0ms),
    transform 360ms var(--ease-out) var(--reveal-delay, 0ms);
}
[data-reveal].is-visible {
  opacity: 1;
  transform: translateY(0);
}

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
  animation: mc-fade 380ms var(--ease-out) var(--mc-delay, 0ms) forwards;
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
  transition: background 120ms ease, transform 80ms ease;
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
  transition: border-color 120ms ease, color 120ms ease, transform 80ms ease;
}

.btn-outline:hover { border-color: var(--text-2); }
.btn-outline:active { transform: scale(0.97); }

.btn-lg { padding: 16px 24px; font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 20px; }
.btn-lg.btn-primary { font-weight: 600; }
.btn-lg.btn-outline { font-weight: 500; }

/* ═══════════════════════ HERO ═══════════════════════ */
.hero {
  display: flex;
  align-items: stretch;
  gap: 64px;
  padding: 56px 56px 96px;
  min-height: 712px;
}

.hero-copy {
  flex: 1;
  max-width: 560px;
  padding-top: 24px;
  display: flex;
  flex-direction: column;
}

.hero-h1 {
  font-family: var(--sans);
  font-size: clamp(54px, 6.4vw, 92px);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.96;
  color: var(--text);
  margin: 0 0 8px;
}

.hero-h2 {
  font-family: var(--serif);
  font-size: clamp(60px, 7.2vw, 104px);
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.03em;
  line-height: 0.94;
  color: var(--accent);
  margin: 0 0 32px;
}

:root.light .hero-h2 { color: var(--text); }

.hero-sub {
  font-family: var(--sans);
  font-size: calc(18px * var(--nc-text-scale, 1));
  line-height: 30px;
  color: var(--text-2);
  max-width: 480px;
  margin: 0 0 40px;
}

.hero-cta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.hero-receipt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  line-height: 16px;
  color: var(--text-3);
  margin: 0;
}

.hero-receipt svg { color: var(--text-3); flex-shrink: 0; }

/* ═══════════════════════ MINI CANVAS PREVIEW ═══════════════════════ */
.mini-canvas {
  flex: 1;
  height: 640px;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}

.mc-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(63, 63, 70, 0.4) 0%, transparent 70%);
  opacity: 0.6;
  pointer-events: none;
}

.mc-chip {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-3);
  border: 1px solid var(--border-3);
  border-radius: 10px;
  z-index: 2;
}

.mc-chip--tl { top: 16px; left: 16px; gap: 10px; }
.mc-chip--tr { top: 16px; right: 16px; gap: 8px; }

.mc-chip--tc {
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent-soft);
  border-color: var(--accent);
  border-style: dashed;
}

.mc-chip--tc span:not(svg) {
  font-family: var(--mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 12px;
  color: var(--accent);
}

.mc-chip-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  flex-shrink: 0;
}

.mc-chip-text {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 14px;
  color: var(--text-2);
}

.mc-chip-strong {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 14px;
  color: var(--text);
}

.mc-chip-mute {
  font-family: var(--mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 14px;
  color: var(--text-3);
}

/* Stage locks the graph to a fixed 600:560 ratio inside the canvas so SVG
   paths and absolutely-positioned nodes stay aligned at any screen size. */
.mc-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(calc(100% - 32px), 720px);
  aspect-ratio: 600 / 560;
  max-height: calc(100% - 96px);
}

.mc-edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.mc-node {
  position: absolute;
  background: var(--bg-3);
  border: 1px solid var(--border-3);
  border-radius: 10px;
  padding: 10px 14px;
  font-family: var(--sans);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text);
  z-index: 3;
}

.mc-node--root {
  background: var(--surface);
  border: 1px solid var(--accent);
  padding: 18px 22px;
  font-family: var(--sans);
  font-size: calc(17px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 22px;
  color: var(--text);
  border-radius: 12px;
  z-index: 4;
  text-align: center;
}

.mc-node--ai {
  background: var(--accent-soft);
  border: 1px dashed var(--accent);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mc-ai-eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: calc(9px * var(--nc-text-scale, 1));
  font-weight: 500;
  letter-spacing: 0.06em;
  line-height: 12px;
  color: var(--accent);
  text-transform: uppercase;
}

.mc-ai-text { color: var(--text); }

.mc-prompt {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-3);
  border: 1px solid var(--border-3);
  border-radius: 12px;
  z-index: 3;
}

.mc-prompt svg { flex-shrink: 0; }

.mc-prompt-text {
  flex: 1;
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  line-height: 18px;
  color: var(--text-3);
}

.mc-prompt-kbd {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 8px;
  background: var(--surface);
  border: 1px solid var(--border-3);
  border-radius: 6px;
  font-family: var(--mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 12px;
  color: var(--text-2);
}

/* ═══════════════════════ SECTIONS ═══════════════════════ */
.sec {
  padding: 120px 56px;
  border-top: 1px solid var(--border);
}

.sec-01 { padding-top: 160px; padding-bottom: 120px; margin-top: 96px; }
.sec-02 { background: var(--bg-2); padding: 120px 56px; }
.sec-03 { padding: 120px 0; }
.sec-03 .sec-grid--head { padding: 0 56px; }
.sec-04 { background: var(--bg-2); padding: 120px 0 120px 56px; border-top: none; }
.sec-05 { padding: 160px 56px; }

.sec-grid {
  display: flex;
  align-items: flex-start;
  gap: 64px;
}

.sec-grid--head { margin-bottom: 56px; }

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
  transition: border-color 120ms ease, background 120ms ease;
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
  line-height: 30px;
  color: var(--text-2);
  margin: 0;
  max-width: 680px;
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

/* ── 03 Steps ── */
.steps {
  display: flex;
  flex-direction: column;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 64px;
  padding: 48px 56px;
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
  line-height: 28px;
  color: var(--text-2);
  margin: 0;
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
  padding-right: 56px;
}

.tpl-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
  padding-right: 56px;
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
  transition: border-color 150ms ease;
  text-decoration: none;
  color: inherit;
}

.tpl:hover { border-color: var(--border-4); }

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
  line-height: 16px;
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

.privacy-col h4 {
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
  line-height: 22px;
  color: var(--text-2);
  margin: 0;
}

/* ═══════════════════════ FINAL CTA ═══════════════════════ */
.cta {
  padding: 200px 56px 160px;
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
  line-height: 16px;
  color: var(--text-3);
  margin: 0;
}

/* ═══════════════════════ FOOTER ═══════════════════════ */
.footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 48px 56px 36px;
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
  line-height: 16px;
  color: var(--text-2);
  text-decoration: none;
  transition: color 120ms ease;
}

.footer-col a:hover { color: var(--text); }

/* ═══════════════════════ RESPONSIVE ═══════════════════════ */
@media (max-width: 1280px) {
  .nav { padding: 20px 32px; }
  .hero { padding: 40px 32px 80px; gap: 40px; }
  .sec, .sec-01, .sec-02, .sec-03, .sec-04, .sec-05 {
    padding-left: 32px; padding-right: 32px;
  }
  .sec-04 { padding-right: 0; }
  .sec-04 .sec-grid--head { padding-right: 32px; }
  .tpl-rail { padding-right: 32px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cta, .footer { padding-left: 32px; padding-right: 32px; }
}

@media (max-width: 1024px) {
  .hero { flex-direction: column; min-height: auto; }
  .hero-copy { max-width: 100%; }
  .mini-canvas { width: 100%; min-height: 480px; }
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
  .nav { padding: 16px 20px; }
  .nav-links { display: none; }
  .hero { padding: 32px 20px 64px; }
  .hero-h1, .hero-h2 { font-size: clamp(40px, 12vw, 64px); }
  .hero-cta { flex-direction: column; align-items: stretch; width: 100%; }
  .hero-cta .btn-primary, .hero-cta .btn-outline { justify-content: center; }
  .mini-canvas { display: none; }
  .sec, .sec-01, .sec-02, .sec-03, .sec-04, .sec-05 {
    padding: 64px 20px;
  }
  .sec-01 { padding-top: 80px; margin-top: 0; }
  .sec-04 { padding-right: 0; }
  .sec-grid, .sec-grid--head { flex-direction: column; gap: 16px; }
  .sec-eyebrow, .sec-aside { flex-basis: auto; padding-top: 0; }
  .tpl-rail { grid-template-columns: minmax(0, 1fr); padding-right: 20px; }
  .sec-h { font-size: calc(28px * var(--nc-text-scale, 1)); line-height: 1.25; }
  .sec-h2 { font-size: calc(24px * var(--nc-text-scale, 1)); }
  .step { flex-direction: column; gap: 16px; padding: 32px 0; }
  .step-num { flex-basis: auto; }
  .step-numeral { font-size: calc(48px * var(--nc-text-scale, 1)); }
  .step-body h3 { font-size: calc(20px * var(--nc-text-scale, 1)); }
  .cta { padding: 96px 20px 80px; }
  .cta-h { font-size: calc(44px * var(--nc-text-scale, 1)); line-height: 1; }
  .cta-row { flex-direction: column; align-items: stretch; width: 100%; }
  .cta-row .btn-primary, .cta-row .btn-outline { justify-content: center; }
  .footer { flex-direction: column; align-items: flex-start; gap: 32px; padding: 32px 20px; }
  .footer-cols { flex-wrap: wrap; gap: 24px; }
}

/* ═══════════════════════ HOVER POLISH ═══════════════════════ */
.tpl {
  transition: border-color 180ms ease, background 180ms ease;
}
.tpl:hover {
  border-color: var(--border-4);
}

/* ═══════════════════════ REDUCED MOTION ═══════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .lp .hero-rise,
  .lp .mc-rise,
  .lp .mc-pop,
  .lp .mc-line--draw,
  .lp .mc-line--fade,
  .lp .demo-line,
  .lp .demo-pop,
  .lp .mc-node--ai,
  .lp [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    stroke-dashoffset: 0 !important;
    animation: none !important;
    transition: none !important;
  }
  .mc-chip-dot::after { animation: none; display: none; }
  .demo-caret { animation: none; }
}
</style>
