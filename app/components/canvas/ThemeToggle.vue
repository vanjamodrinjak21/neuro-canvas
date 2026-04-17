<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

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

function toggle() {
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
  <button
    ref="toggleBtnRef"
    class="theme-toggle"
    :class="{ 'is-light': isLight, 'is-animating': isAnimating }"
    :aria-label="isLight ? 'Switch to dark mode' : 'Switch to light mode'"
    @click="toggle"
  >
    <span class="theme-toggle-track">
      <!-- Sun icon -->
      <svg
        class="theme-icon sun-icon"
        width="14"
        height="14"
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
        class="theme-icon moon-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  </button>

  <!-- Theme swipe overlay -->
  <Teleport to="body">
    <div ref="overlayRef" class="theme-swipe-overlay" />
  </Teleport>
</template>

<style scoped>
.theme-toggle {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-ink-soft, #777777);
  transition: color var(--nc-duration-fast) ease, background var(--nc-duration-fast) ease;
  flex-shrink: 0;
}

.theme-toggle:hover {
  color: var(--nc-ink, #FAFAFA);
  background: rgba(255, 255, 255, 0.06);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 2px;
}

:root.light .theme-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
}

.theme-toggle-track {
  position: relative;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-icon {
  position: absolute;
  transition: transform var(--nc-duration-slow) var(--nc-ease-smooth),
              opacity var(--nc-duration-slow) ease;
}

/* Dark mode: show moon, hide sun */
.sun-icon {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.moon-icon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

/* Light mode: show sun, hide moon */
.is-light .sun-icon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.is-light .moon-icon {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

/* Animation burst on toggle */
.is-animating .sun-icon,
.is-animating .moon-icon {
  transition: transform 500ms var(--nc-ease-bounce),
              opacity var(--nc-duration-slow) ease;
}

/* Swipe overlay */
.theme-swipe-overlay {
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
</style>
