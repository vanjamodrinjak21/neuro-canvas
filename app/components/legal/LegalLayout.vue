<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

interface Props {
  title: string
  lastUpdated: string
}

defineProps<Props>()

const userStore = useUserStore()

const isLight = computed(() => {
  if (userStore.preferences.value.theme === 'system') {
    if (typeof window === 'undefined') return false
    return !window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return userStore.preferences.value.theme === 'light'
})

const isAnimating = ref(false)
const toggleBtnRef = ref<HTMLButtonElement | null>(null)
const overlayRef = ref<HTMLDivElement | null>(null)

function toggleTheme() {
  if (isAnimating.value) return
  isAnimating.value = true

  const btn = toggleBtnRef.value
  if (!btn || typeof window === 'undefined') {
    applyThemeChange()
    return
  }

  const rect = btn.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const maxX = Math.max(cx, window.innerWidth - cx)
  const maxY = Math.max(cy, window.innerHeight - cy)
  const maxRadius = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY))

  const overlay = overlayRef.value
  if (!overlay) {
    applyThemeChange()
    return
  }

  overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`
  overlay.style.display = 'block'
  overlay.style.opacity = '1'

  overlay.offsetHeight

  overlay.style.transition = 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)'
  overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`

  setTimeout(() => {
    applyThemeChange()
    setTimeout(() => {
      overlay.style.transition = 'opacity 300ms ease'
      overlay.style.opacity = '0'
      setTimeout(() => {
        overlay.style.display = 'none'
        overlay.style.transition = ''
        overlay.style.clipPath = ''
        isAnimating.value = false
      }, 300)
    }, 60)
  }, 480)
}

function applyThemeChange() {
  const next = isLight.value ? 'dark' : 'light'
  userStore.setPreference('theme', next)
  if (isAnimating.value && !overlayRef.value) {
    setTimeout(() => { isAnimating.value = false }, 100)
  }
}
</script>

<template>
  <div class="legal-root">
    <!-- Header -->
    <header class="legal-header">
      <div class="legal-header__left">
        <NuxtLink to="/" class="legal-header__brand">
          <NcLogo :size="14" :container-size="28" :radius="6" />
          <span class="legal-header__brand-name">NeuroCanvas</span>
        </NuxtLink>
      </div>

      <div class="legal-header__right">
        <NuxtLink to="/" class="legal-header__back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </NuxtLink>
        <button
          ref="toggleBtnRef"
          class="legal-header__theme"
          :class="{ 'is-light': isLight }"
          :aria-label="isLight ? 'Switch to dark mode' : 'Switch to light mode'"
          @click="toggleTheme"
        >
          <svg class="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="legal-main">
      <div class="legal-content">
        <p class="legal-eyebrow" aria-hidden="true">
          <span class="legal-eyebrow__mark">[</span>
          <span class="legal-eyebrow__key">LEGAL</span>
          <span class="legal-eyebrow__mark">]</span>
          <span class="legal-eyebrow__dot">·</span>
          <span class="legal-eyebrow__doc">DOCUMENT</span>
        </p>
        <h1 class="legal-title">{{ title }}</h1>
        <p class="legal-updated">Last updated: {{ lastUpdated }}</p>
        <div class="legal-prose">
          <slot />
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="legal-footer">
      <div class="legal-footer__inner">
        <div class="legal-footer__links">
          <NuxtLink to="/privacy">Privacy Policy</NuxtLink>
          <span class="legal-footer__sep">·</span>
          <NuxtLink to="/terms">Terms of Service</NuxtLink>
          <span class="legal-footer__sep">·</span>
          <NuxtLink to="/docs">Documentation</NuxtLink>
        </div>
        <p class="legal-footer__copy">&copy; {{ new Date().getFullYear() }} NeuroCanvas. All rights reserved.</p>
      </div>
    </footer>

    <!-- Theme swipe overlay -->
    <div ref="overlayRef" class="legal-swipe-overlay" />
  </div>
</template>

<style scoped>
.legal-root {
  /* Palette comes from the global tokens (tokens.css) — the landing
     values used to be re-declared here; they ARE the global tokens
     now (AER-76). Only the docs-local coral alias remains. */
  --docs-coral: var(--nc-coral);

  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nc-bg);
  transition: background 0.3s ease;
}

/* ─── Header ─── */
.legal-header {
  position: sticky;
  top: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--nc-bg);
  border-bottom: 1px solid var(--nc-border);
  z-index: 100;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.legal-header__left {
  display: flex;
  align-items: center;
}

.legal-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--nc-text);
}

.legal-header__brand-name {
  font-family: 'Inter', var(--nc-font-body);
  font-weight: 600;
  font-size: calc(14px * var(--nc-text-scale, 1));
}

.legal-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legal-header__back {
  height: 32px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  font-family: 'Inter', var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-decoration: none;
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  transition: all 0.15s ease;
}

.legal-header__back:hover {
  color: var(--nc-text);
  border-color: var(--nc-border-active);
  background: rgba(255, 255, 255, 0.03);
}

:root.light .legal-header__back:hover {
  background: rgba(0, 0, 0, 0.03);
}

.legal-header__theme {
  position: relative;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-text-secondary);
  transition: color 0.15s ease, background 0.15s ease;
}

.legal-header__theme:hover {
  color: var(--nc-text);
  background: rgba(255, 255, 255, 0.06);
}

:root.light .legal-header__theme:hover {
  background: rgba(0, 0, 0, 0.06);
}

.legal-header__theme .icon-sun,
.legal-header__theme .icon-moon {
  position: absolute;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.icon-sun { opacity: 0; transform: rotate(-90deg) scale(0.5); }
.icon-moon { opacity: 1; transform: rotate(0deg) scale(1); }
.is-light .icon-sun { opacity: 1; transform: rotate(0deg) scale(1); }
.is-light .icon-moon { opacity: 0; transform: rotate(90deg) scale(0.5); }

/* ─── Main content ─── */
.legal-main {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 48px 24px 80px;
}

.legal-content {
  width: 100%;
  max-width: 720px;
}

/* ─── Eyebrow — mono uppercase, coral LEGAL segment ─── */
.legal-eyebrow {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--nc-text-muted);
  line-height: 1;
  margin-bottom: 18px;
  user-select: none;
}

.legal-eyebrow__mark,
.legal-eyebrow__key {
  color: var(--docs-coral);
}

.legal-eyebrow__dot {
  color: var(--nc-text-dim);
  margin: 0 2px;
}

.legal-eyebrow__doc {
  color: var(--nc-text-muted);
}

.legal-title {
  font-family: var(--nc-font-display);
  font-size: calc(38px * var(--nc-text-scale, 1));
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--nc-text);
  margin-bottom: 10px;
}

.legal-updated {
  font-family: var(--nc-font-mono);
  font-size: calc(12px * var(--nc-text-scale, 1));
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--nc-text-muted);
  margin-bottom: 40px;
}

/* ─── Prose ─── */
.legal-prose :deep(h2) {
  position: relative;
  font-family: var(--nc-font-display);
  font-size: calc(22px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--nc-text);
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--nc-border);
  margin-bottom: 16px;
}

/* Mono coral survey mark — pairs with the inline section number in the copy
   without duplicating it. */
.legal-prose :deep(h2)::before {
  content: '§';
  font-family: var(--nc-font-mono);
  font-weight: 500;
  font-size: 0.72em;
  color: var(--docs-coral);
  margin-right: 8px;
  vertical-align: 1px;
}

.legal-prose :deep(h3) {
  font-family: var(--nc-font-display);
  font-size: calc(17px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  margin-top: 32px;
  margin-bottom: 12px;
}

.legal-prose :deep(p) {
  font-family: var(--nc-font-body);
  font-size: calc(15px * var(--nc-text-scale, 1));
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 16px;
}

.legal-prose :deep(ul),
.legal-prose :deep(ol) {
  padding-left: 20px;
  margin-bottom: 16px;
}

.legal-prose :deep(li) {
  font-family: var(--nc-font-body);
  font-size: calc(15px * var(--nc-text-scale, 1));
  line-height: 1.75;
  color: var(--nc-text-secondary);
  margin-bottom: 6px;
}

.legal-prose :deep(li::marker) {
  color: var(--nc-text-dim);
}

.legal-prose :deep(strong) {
  font-weight: 600;
  color: var(--nc-text);
}

.legal-prose :deep(a) {
  color: var(--nc-accent);
  font-weight: 500;
  text-decoration: none;
}

.legal-prose :deep(a:hover) {
  text-decoration: underline;
}

.legal-prose :deep(code) {
  font-family: var(--nc-font-mono);
  font-size: calc(13px * var(--nc-text-scale, 1));
  background: var(--nc-accent-glow);
  color: var(--nc-accent);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ─── Footer ─── */
.legal-footer {
  border-top: 1px solid var(--nc-border);
  padding: 24px;
  transition: border-color 0.3s ease;
}

.legal-footer__inner {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.legal-footer__links {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: calc(13px * var(--nc-text-scale, 1));
}

.legal-footer__links a {
  color: var(--nc-text-muted);
  text-decoration: none;
  font-weight: 500;
  font-family: var(--nc-font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transition: color 0.15s;
}

.legal-footer__links a:hover {
  color: var(--nc-accent);
}

.legal-footer__sep {
  color: var(--nc-text-dim);
}

.legal-footer__copy {
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
}

/* ─── Swipe overlay ─── */
.legal-swipe-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100vw;
  height: 100vh;
  background: var(--nc-accent);
  z-index: 9999;
  pointer-events: none;
}

/* ─── Mobile ─── */
@media (max-width: 768px) {
  .legal-header { padding: 0 16px; }
  .legal-main { padding: 32px 16px 60px; }
  .legal-title { font-size: calc(30px * var(--nc-text-scale, 1)); }
  .legal-eyebrow { font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.16em; }
  .legal-header__brand-name { display: none; }
}
</style>
