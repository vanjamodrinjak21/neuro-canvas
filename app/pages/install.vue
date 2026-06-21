<script setup lang="ts">
/**
 * /install — Paper-exact (HZ8-0/HZ9-0/HZA-0 dark, I89-0/IBJ-0/IEI-0 light).
 * Reachable from /download via ?os=mac|windows or directly. Nav mirrors the
 * landing page so theme switching and routing stay consistent.
 */

definePageMeta({ layout: false })

const { t } = useI18n()

useHead({
  title: () => t('landing.install_page.meta_title'),
  meta: [
    { name: 'description', content: () => t('landing.install_page.meta_description') },
  ],
})

const { status } = useAuth()
const isAuthenticated = computed(() => status.value === 'authenticated')
const route = useRoute()

type OS = 'mac' | 'windows' | 'unknown'
const detected = ref<OS>('unknown')

onMounted(() => {
  const fromQuery = String(route.query.os || '').toLowerCase()
  if (fromQuery === 'mac' || fromQuery === 'macos') { detected.value = 'mac'; return }
  if (fromQuery === 'windows' || fromQuery === 'win') { detected.value = 'windows'; return }

  if (typeof navigator === 'undefined') return
  const ua = navigator.userAgent.toLowerCase()
  const platformStr = (navigator.platform || '').toLowerCase()
  if (/mac/.test(platformStr) || /mac os x|macintosh/.test(ua)) detected.value = 'mac'
  else if (/win/.test(platformStr) || /windows/.test(ua)) detected.value = 'windows'
})

const MAC_CMD = 'xattr -d com.apple.quarantine /Applications/NeuroCanvas.app'
const macCopied = ref(false)
async function copyMacCmd() {
  try {
    await navigator.clipboard.writeText(MAC_CMD)
    macCopied.value = true
    setTimeout(() => { macCopied.value = false }, 1600)
  } catch { /* clipboard blocked — user can still select the text */ }
}
</script>

<template>
  <div class="dl">
    <!-- ══════ TOP NAV (matches landing/download) ══════ -->
    <nav class="dl-nav">
      <div class="dl-nav-left">
        <NuxtLink to="/" class="dl-brand">
          <NcLogo :size="14" :container-size="24" :radius="6" />
          <span class="dl-brand-name">NeuroCanvas</span>
        </NuxtLink>
        <div class="dl-nav-links">
          <NuxtLink to="/#how-it-works">{{ $t('landing.nav.product') }}</NuxtLink>
          <NuxtLink to="/templates">{{ $t('landing.nav.templates') }}</NuxtLink>
          <NuxtLink to="/docs">{{ $t('landing.nav.docs') }}</NuxtLink>
          <NuxtLink to="/download">{{ $t('landing.nav.download') }}</NuxtLink>
        </div>
      </div>
      <div class="dl-nav-right">
        <NuxtLink v-if="!isAuthenticated" to="/auth/signin" class="dl-nav-signin">{{ $t('landing.nav.signin') }}</NuxtLink>
        <NuxtLink v-else to="/dashboard" class="dl-nav-dash">{{ $t('landing.nav.open_dashboard') }}</NuxtLink>
      </div>
    </nav>

    <!-- ══════ HERO ══════ -->
    <section class="dl-hero">
      <span class="dl-pill">
        <span class="dl-pill-dot" />
        <span>{{ $t('landing.install_page.pill') }}</span>
      </span>
      <h1 class="dl-headline">
        <span class="dl-h-sans">{{ $t('landing.install_page.hero_sans') }}</span>
        <span class="dl-h-serif">{{ $t('landing.install_page.hero_serif') }}</span>
      </h1>
      <p class="dl-sub">
        {{ $t('landing.install_page.hero_sub') }}
      </p>
    </section>

    <!-- ══════ macOS ══════ -->
    <section id="mac" class="dl-platform" :class="{ 'is-secondary': detected === 'windows' }">
      <header class="dl-platform-head">
        <span class="dl-platform-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M16.5 12.6c0-2.7 2.2-4 2.3-4.1-1.3-1.8-3.2-2.1-3.9-2.1-1.7-.2-3.2 1-4.1 1-.9 0-2.2-1-3.6-1-1.8 0-3.5 1.1-4.5 2.7-1.9 3.3-.5 8.2 1.4 10.9.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.5-.9s2.1.9 3.6.9c1.5 0 2.4-1.3 3.3-2.6.9-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.8-4.1zm-2.7-7.5c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.2 1.1.1 2.2-.5 3-1.4z" fill="currentColor"/>
          </svg>
        </span>
        <div>
          <p class="dl-platform-eyebrow">{{ $t('landing.install_page.mac_eyebrow') }}</p>
          <h2 class="dl-platform-title">{{ $t('landing.install_page.mac_title') }}</h2>
        </div>
      </header>
      <ol class="dl-steps">
        <li class="dl-step">
          <span class="dl-step-num">1</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.mac_step1_title') }}</h3>
            <p>{{ $t('landing.install_page.mac_step1_body_pre') }} <NuxtLink to="/download">{{ $t('landing.install_page.mac_step1_body_link') }}</NuxtLink>{{ $t('landing.install_page.mac_step1_body_post') }}</p>
          </div>
        </li>
        <li class="dl-step">
          <span class="dl-step-num">2</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.mac_step2_title') }}</h3>
            <p>{{ $t('landing.install_page.mac_step2_body') }}</p>
          </div>
        </li>
        <li class="dl-step is-key">
          <span class="dl-step-num">3</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.mac_step3_title') }}</h3>
            <p>{{ $t('landing.install_page.mac_step3_body') }}</p>
            <div class="dl-cmd">
              <pre><code>{{ MAC_CMD }}</code></pre>
              <button type="button" class="dl-cmd-copy" @click="copyMacCmd">{{ macCopied ? $t('landing.install_page.copied_button') : $t('landing.install_page.copy_button') }}</button>
            </div>
          </div>
        </li>
        <li class="dl-step">
          <span class="dl-step-num">4</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.mac_step4_title') }}</h3>
            <p>{{ $t('landing.install_page.mac_step4_body_pre') }} <strong>{{ $t('landing.install_page.mac_step4_body_emphasis') }}</strong> {{ $t('landing.install_page.mac_step4_body_post') }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- ══════ Windows ══════ -->
    <section id="windows" class="dl-platform" :class="{ 'is-secondary': detected === 'mac' }">
      <header class="dl-platform-head">
        <span class="dl-platform-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 5.5L11 4.3v7.2H3V5.5zm0 6.7h8v7.2L3 18.5v-6.3zm9-7.9L22 3v8.5h-10V4.3zm0 7.9h10V21l-10-1.4v-7.4z" fill="currentColor"/>
          </svg>
        </span>
        <div>
          <p class="dl-platform-eyebrow">{{ $t('landing.install_page.win_eyebrow') }}</p>
          <h2 class="dl-platform-title">{{ $t('landing.install_page.win_title') }}</h2>
        </div>
      </header>
      <ol class="dl-steps">
        <li class="dl-step">
          <span class="dl-step-num">1</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.win_step1_title') }}</h3>
            <p>{{ $t('landing.install_page.win_step1_body_pre') }} <code>NeuroCanvas_1.0.0_x64_en-US.msi</code> {{ $t('landing.install_page.win_step1_body_mid') }} <NuxtLink to="/download">{{ $t('landing.install_page.win_step1_body_link') }}</NuxtLink>{{ $t('landing.install_page.win_step1_body_post') }}</p>
          </div>
        </li>
        <li class="dl-step is-key">
          <span class="dl-step-num">2</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.win_step2_title') }}</h3>
            <p>{{ $t('landing.install_page.win_step2_body_pre') }} <strong>{{ $t('landing.install_page.win_step2_body_more_info') }}</strong>{{ $t('landing.install_page.win_step2_body_mid') }} <strong>{{ $t('landing.install_page.win_step2_body_run_anyway') }}</strong>{{ $t('landing.install_page.win_step2_body_post') }}</p>
          </div>
        </li>
        <li class="dl-step">
          <span class="dl-step-num">3</span>
          <div class="dl-step-body">
            <h3>{{ $t('landing.install_page.win_step3_title') }}</h3>
            <p>{{ $t('landing.install_page.win_step3_body_pre') }} <strong>{{ $t('landing.install_page.win_step3_body_letter') }}</strong>{{ $t('landing.install_page.win_step3_body_post') }}</p>
          </div>
        </li>
      </ol>
    </section>

    <!-- ══════ VERIFY (optional) ══════ -->
    <section class="dl-verify">
      <p class="dl-verify-eyebrow">{{ $t('landing.install_page.verify_eyebrow') }}</p>
      <h2 class="dl-verify-title">{{ $t('landing.install_page.verify_title') }}</h2>
      <p class="dl-verify-sub">
        {{ $t('landing.install_page.verify_body_pre') }} <code>.sha256</code> {{ $t('landing.install_page.verify_body_post') }}
      </p>
    </section>

    <!-- ══════ FOOTER ══════ -->
    <footer class="dl-footer">
      <div class="dl-foot-brand">
        <NcLogo :size="11" :container-size="18" :radius="5" />
        <span class="dl-foot-brand-name">NeuroCanvas · v1.0.0</span>
      </div>
      <div class="dl-foot-links">
        <NuxtLink to="/docs">{{ $t('landing.footer.docs_link') }}</NuxtLink>
        <NuxtLink to="/download">{{ $t('landing.footer.changelog_link') }}</NuxtLink>
        <a href="https://github.com/vanjamodrinjak21/neuro-canvas" target="_blank" rel="noopener">{{ $t('landing.footer.github_link') }}</a>
        <a href="mailto:hello@neuro-canvas.com">{{ $t('landing.footer.contact_link') }}</a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   /install — Paper-exact (dark HZ8-0/HZ9-0/HZA-0, light I89-0/IBJ-0/IEI-0)
   Tokens shared with /download so theme + nav stay synced.
   ═══════════════════════════════════════════════════════ */
.dl {
  --bg: #09090B;
  --surface: #111114;
  --surface-3: #1A1A1E;
  --border: #1E1E22;
  --border-active: #2A2A30;
  --text: #FAFAFA;
  --text-2: #A1A1AA;
  --text-3: #777777;
  --text-faint: #52525B;
  --accent: #00D2BE;
  --on-accent: #0A0A0C;
  --sans: 'Inter', system-ui, -apple-system, sans-serif;
  --serif: 'Instrument Serif', Georgia, serif;
  --mono: 'JetBrains Mono', ui-monospace, monospace;

  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}
:root.light .dl {
  --bg: #FAFAF9;
  --surface: #F5F5F3;
  --surface-3: #E8E8E6;
  --border: #E8E8E6;
  --border-active: #D4D4D8;
  --text: #111111;
  --text-2: #555555;
  --text-3: #555555;
  --text-faint: #A1A1AA;
}

/* ═══════════════════════ NAV ═══════════════════════ */
.dl-nav {
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
:root.light .dl-nav { background: rgba(250, 250, 249, 0.85); }
.dl-nav-left { display: flex; align-items: center; gap: 40px; }
.dl-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
.dl-brand-name { font-size: 15px; font-weight: 600; line-height: 18px; letter-spacing: -0.01em; }
.dl-nav-links { display: flex; gap: 28px; }
.dl-nav-links a {
  font-size: 14px; font-weight: 500; line-height: 18px;
  color: var(--text-2); text-decoration: none;
  transition: color 120ms ease;
}
.dl-nav-links a:hover { color: var(--text); }
.dl-nav-right { display: flex; align-items: center; gap: 12px; }
.dl-nav-signin {
  padding: 8px 12px;
  font-size: 14px; font-weight: 500; line-height: 18px;
  color: var(--text-2); text-decoration: none;
  transition: color 120ms ease;
}
.dl-nav-signin:hover { color: var(--text); }
.dl-nav-dash {
  display: inline-flex; align-items: center;
  padding: 8px 16px;
  border: 1px solid var(--border-active);
  border-radius: 10px;
  font-size: 14px; font-weight: 500; line-height: 18px;
  color: var(--text); text-decoration: none;
  transition: border-color 120ms ease, background 120ms ease;
}
.dl-nav-dash:hover { background: var(--surface); border-color: var(--text-2); }

/* ═══════════════════════ HERO ═══════════════════════ */
.dl-hero {
  display: flex; flex-direction: column; align-items: flex-start;
  gap: 24px;
  padding: 80px 120px 64px;
}
.dl-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px; font-weight: 500;
  color: var(--text-2);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.dl-pill-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--accent);
}
.dl-headline { display: flex; flex-direction: column; gap: 4px; margin: 0; font-weight: normal; }
.dl-h-sans {
  font-family: 'Cabinet Grotesk', var(--sans);
  font-size: clamp(40px, 5.5vw, 64px);
  font-weight: 600; color: var(--text);
  letter-spacing: -0.025em; line-height: 1.05;
}
.dl-h-serif {
  font-family: var(--serif);
  font-size: clamp(40px, 5.5vw, 64px);
  font-style: italic; font-weight: 400; color: var(--accent);
  letter-spacing: -0.025em; line-height: 1.05;
}
.dl-sub {
  margin: 0;
  font-size: 18px; line-height: 1.55;
  color: var(--text-2);
  max-width: 620px;
}

/* ═══════════════════════ PLATFORM SECTIONS ═══════════════════════ */
.dl-platform {
  padding: 48px 120px;
  display: flex; flex-direction: column;
  gap: 32px;
  border-top: 1px solid var(--border);
}
.dl-platform.is-secondary { opacity: 0.92; }
.dl-platform-head { display: flex; align-items: center; gap: 16px; }
.dl-platform-icon {
  width: 44px; height: 44px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--text);
  flex-shrink: 0;
}
.dl-platform-eyebrow {
  margin: 0 0 2px;
  font-size: 12px; font-weight: 500;
  color: var(--text-faint);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.dl-platform-title {
  margin: 0;
  font-family: 'Cabinet Grotesk', var(--sans);
  font-size: 28px; font-weight: 600;
  color: var(--text);
  letter-spacing: -0.015em;
}

.dl-steps {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column;
  gap: 14px;
}
.dl-step {
  display: flex; gap: 18px;
  padding: 22px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.dl-step.is-key {
  border-color: var(--accent);
  padding: 24px;
}
.dl-step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  flex-shrink: 0;
  background: var(--surface-3);
  border: 1px solid var(--border-active);
  border-radius: 999px;
  font-size: 13px; font-weight: 600;
  color: var(--text);
  line-height: 1;
}
.dl-step.is-key .dl-step-num {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}
.dl-step-body { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.dl-step.is-key .dl-step-body { gap: 14px; }
.dl-step-body h3 {
  margin: 0;
  font-family: 'Cabinet Grotesk', var(--sans);
  font-size: 16px; font-weight: 600;
  color: var(--text);
  letter-spacing: -0.005em;
}
.dl-step-body p {
  margin: 0;
  font-size: 14px; line-height: 1.55;
  color: var(--text-2);
}
.dl-step-body p strong { color: var(--text); font-weight: 600; }
.dl-step-body p code {
  font-family: var(--mono);
  font-size: 12.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-3);
  color: var(--text);
}
.dl-step-body p a {
  color: var(--accent);
  text-decoration: none;
}
.dl-step-body p a:hover { text-decoration: underline; }

/* macOS quarantine command box */
.dl-cmd {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}
:root.light .dl-cmd { background: var(--bg); }
.dl-cmd pre {
  margin: 0;
  font-family: var(--mono);
  font-weight: 500;
  font-size: 13px;
  color: var(--text);
  overflow-x: auto;
  flex: 1; min-width: 0;
}
.dl-cmd pre code { background: none; padding: 0; }
.dl-cmd-copy {
  display: inline-flex; align-items: center;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border-active);
  border-radius: 6px;
  font-family: var(--sans);
  font-size: 12px; font-weight: 600;
  color: var(--text);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 120ms ease, background 120ms ease;
}
.dl-cmd-copy:hover { border-color: var(--text-2); background: var(--surface-3); }

/* ═══════════════════════ VERIFY ═══════════════════════ */
.dl-verify {
  display: flex; flex-direction: column;
  gap: 18px;
  padding: 48px 120px;
  border-top: 1px solid var(--border);
}
.dl-verify-eyebrow {
  margin: 0;
  font-size: 12px; font-weight: 500;
  color: var(--text-faint);
  letter-spacing: 0.06em; text-transform: uppercase;
}
.dl-verify-title {
  margin: 0;
  font-family: 'Cabinet Grotesk', var(--sans);
  font-size: 24px; font-weight: 600;
  color: var(--text);
  letter-spacing: -0.015em;
}
.dl-verify-sub {
  margin: 0;
  font-size: 15px; line-height: 1.6;
  color: var(--text-2);
  max-width: 720px;
}
.dl-verify-sub code {
  font-family: var(--mono);
  font-size: 13px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
}

/* ═══════════════════════ FOOTER ═══════════════════════ */
.dl-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  padding: 32px 120px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.dl-foot-brand { display: flex; align-items: center; gap: 10px; }
.dl-foot-brand-name { font-size: 13px; font-weight: 500; color: var(--text-2); }
.dl-foot-links {
  display: flex; align-items: center;
  gap: 24px; flex-wrap: wrap;
}
.dl-foot-links a {
  font-size: 13px; font-weight: 500;
  color: var(--text-2);
  text-decoration: none;
  transition: color 120ms ease;
}
.dl-foot-links a:hover { color: var(--text); }

/* ═══════════════════════ LAPTOP (≤ 1280) ═══════════════════════ */
@media (max-width: 1440px) {
  .dl-hero { padding: 64px 96px 48px; }
  .dl-platform { padding: 40px 96px; }
  .dl-verify { padding: 40px 96px; }
  .dl-footer { padding: 28px 96px; }
}

/* ═══════════════════════ MOBILE (≤ 640) ═══════════════════════ */
@media (max-width: 640px) {
  .dl-nav { padding: 14px 20px; }
  .dl-nav-left { gap: 20px; }
  .dl-nav-links, .dl-nav-signin { display: none; }
  .dl-nav-dash { padding: 7px 14px; font-size: 13px; }

  .dl-hero { padding: 32px 20px 24px; gap: 14px; }
  .dl-h-sans, .dl-h-serif {
    font-size: 30px; letter-spacing: -0.025em; line-height: 1.1;
  }
  .dl-headline { gap: 4px; }
  .dl-sub { font-size: 14px; }

  .dl-platform { padding: 24px 20px; gap: 16px; }
  .dl-platform-icon { display: none; }
  .dl-platform-title { font-size: 20px; }

  .dl-steps { gap: 10px; }
  .dl-step { padding: 14px; gap: 12px; border-radius: 10px; }
  .dl-step.is-key { padding: 14px; }
  .dl-step-num { width: 24px; height: 24px; font-size: 11px; }
  .dl-step-body h3 { font-size: 13px; }
  .dl-step-body p { font-size: 12px; }

  .dl-cmd {
    flex-direction: column; align-items: stretch;
    padding: 10px;
    gap: 8px;
  }
  .dl-cmd pre { font-size: 10px; white-space: pre-wrap; word-break: break-all; }
  .dl-cmd-copy { width: 100%; justify-content: center; padding: 6px 10px; font-size: 11px; }

  .dl-verify { padding: 24px 20px; gap: 12px; }
  .dl-verify-title { font-size: 20px; }
  .dl-verify-sub { font-size: 13px; }

  .dl-footer { flex-direction: column; align-items: flex-start; padding: 24px 20px; gap: 14px; }
  .dl-foot-links { gap: 18px; }
  .dl-foot-links a { font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .dl-nav-dash, .dl-cmd-copy { transition: none; }
}
</style>
