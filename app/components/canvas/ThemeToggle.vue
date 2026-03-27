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

function toggle() {
  if (isAnimating.value) return
  isAnimating.value = true

  const next = isLight.value ? 'dark' : 'light'
  userStore.setPreference('theme', next)

  setTimeout(() => {
    isAnimating.value = false
  }, 500)
}
</script>

<template>
  <button
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
  transition: color 0.15s ease, background 0.15s ease;
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
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
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
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.3s ease;
}
</style>
