<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

const emit = defineEmits<{
  'toggle-sidebar': []
}>()

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

  // Calculate the max radius needed to cover the entire viewport
  const maxX = Math.max(cx, window.innerWidth - cx)
  const maxY = Math.max(cy, window.innerHeight - cy)
  const maxRadius = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY))

  const overlay = overlayRef.value
  if (!overlay) {
    applyThemeChange()
    return
  }

  // Set clip-path origin to button center
  overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`
  overlay.style.display = 'block'
  overlay.style.opacity = '1'

  // Force reflow so the initial clip-path is applied before animating
  overlay.offsetHeight

  // Expand the circle to cover entire viewport
  overlay.style.transition = 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)'
  overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`

  setTimeout(() => {
    // At peak coverage, swap the theme
    applyThemeChange()

    // Begin fade out
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
  <header class="docs-header">
    <!-- Mobile hamburger -->
    <button
      class="docs-header__hamburger"
      aria-label="Toggle sidebar"
      @click="emit('toggle-sidebar')"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <!-- Left: brand -->
    <div class="docs-header__left">
      <NuxtLink to="/" class="docs-header__brand">
        <NcLogo :size="14" :container-size="28" :radius="6" />
        <span class="docs-header__brand-name">NeuroCanvas</span>
      </NuxtLink>
      <span class="docs-header__separator">/</span>
      <NuxtLink to="/docs" class="docs-header__docs-link">Docs</NuxtLink>
    </div>

    <!-- Center: search trigger -->
    <button class="docs-header__search" aria-label="Search documentation">
      <svg class="docs-header__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <span class="docs-header__search-text">Search documentation...</span>
      <kbd class="docs-header__kbd">&hairsp;&#8984;K</kbd>
    </button>

    <!-- Right: actions -->
    <div class="docs-header__right">
      <NuxtLink to="/dashboard" class="docs-header__app-btn">App</NuxtLink>
      <button
        ref="toggleBtnRef"
        class="docs-header__theme-toggle"
        :class="{ 'is-light': isLight }"
        :aria-label="isLight ? 'Switch to dark mode' : 'Switch to light mode'"
        @click="toggleTheme"
      >
        <!-- Sun icon -->
        <svg
          class="docs-header__theme-icon docs-header__sun"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <!-- Moon icon -->
        <svg
          class="docs-header__theme-icon docs-header__moon"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
    </div>

    <!-- Theme swipe overlay -->
    <div ref="overlayRef" class="docs-header__swipe-overlay" />
  </header>
</template>

<style scoped>
.docs-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  background: var(--nc-bg);
  border-bottom: 1px solid var(--nc-border);
  z-index: 100;
  transition: background 0.3s ease, border-color 0.3s ease;
}

/* ─── Hamburger (mobile only) ─── */
.docs-header__hamburger {
  display: none;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  color: var(--nc-text-secondary);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.docs-header__hamburger:hover {
  color: var(--nc-text);
  background: rgba(255, 255, 255, 0.06);
}

:root.light .docs-header__hamburger:hover {
  background: rgba(0, 0, 0, 0.06);
}

@media (max-width: 768px) {
  .docs-header__hamburger {
    display: flex;
  }
}

/* ─── Left section ─── */
.docs-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.docs-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--nc-text);
}

.docs-header__brand-name {
  font-family: 'Inter', var(--nc-font-body);
  font-weight: 600;
  font-size: 14px;
  line-height: 1;
  color: var(--nc-text);
}

.docs-header__separator {
  font-size: 18px;
  font-weight: 300;
  color: var(--nc-text-muted);
  user-select: none;
  line-height: 1;
}

.docs-header__docs-link {
  font-family: 'Inter', var(--nc-font-body);
  font-weight: 500;
  font-size: 14px;
  color: var(--nc-text-secondary);
  text-decoration: none;
  line-height: 1;
  transition: color 0.15s ease;
}

.docs-header__docs-link:hover {
  color: var(--nc-text);
}

/* ─── Center search ─── */
.docs-header__search {
  flex: 1;
  max-width: 480px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  margin: 0 auto;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.docs-header__search:hover {
  border-color: var(--nc-border-active);
}

.docs-header__search-icon {
  color: var(--nc-text-muted);
  flex-shrink: 0;
}

.docs-header__search-text {
  font-family: 'Inter', var(--nc-font-body);
  font-size: 13px;
  color: var(--nc-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.docs-header__kbd {
  margin-left: auto;
  padding: 2px 6px;
  font-family: 'Inter', var(--nc-font-body);
  font-size: 11px;
  font-weight: 500;
  color: var(--nc-text-muted);
  background: var(--nc-bg);
  border: 1px solid var(--nc-border);
  border-radius: 4px;
  line-height: 1.4;
  flex-shrink: 0;
}

/* ─── Right section ─── */
.docs-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.docs-header__app-btn {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-family: 'Inter', var(--nc-font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-decoration: none;
  border: 1px solid var(--nc-border);
  border-radius: 6px;
  background: none;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.docs-header__app-btn:hover {
  color: var(--nc-text);
  border-color: var(--nc-border-active);
  background: rgba(255, 255, 255, 0.03);
}

:root.light .docs-header__app-btn:hover {
  background: rgba(0, 0, 0, 0.03);
}

/* ─── Theme toggle ─── */
.docs-header__theme-toggle {
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
  flex-shrink: 0;
}

.docs-header__theme-toggle:hover {
  color: var(--nc-text);
  background: rgba(255, 255, 255, 0.06);
}

:root.light .docs-header__theme-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
}

.docs-header__theme-icon {
  position: absolute;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
}

/* Dark mode default: moon visible, sun hidden */
.docs-header__sun {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.docs-header__moon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

/* Light mode: sun visible, moon hidden */
.is-light .docs-header__sun {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.is-light .docs-header__moon {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

/* ─── Full-page swipe overlay ─── */
.docs-header__swipe-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: #00D2BE;
  z-index: 9999;
  pointer-events: none;
}

/* ─── Mobile responsive ─── */
@media (max-width: 768px) {
  .docs-header {
    padding: 0 12px;
    gap: 10px;
  }

  .docs-header__search {
    max-width: none;
    flex: 1;
  }

  .docs-header__search-text {
    display: none;
  }

  .docs-header__kbd {
    display: none;
  }

  .docs-header__brand-name {
    display: none;
  }

  .docs-header__separator {
    display: none;
  }

  .docs-header__app-btn {
    display: none;
  }
}
</style>
