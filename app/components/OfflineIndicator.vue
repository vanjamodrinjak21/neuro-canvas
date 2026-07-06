<script setup lang="ts">
/**
 * Offline Status Indicator
 *
 * Shows a subtle banner when the device goes offline.
 * Uses VueUse's useOnline() + @capacitor/network for native detection.
 */
const { t } = useI18n()
const isOnline = ref(true)
const showBanner = ref(false)
const justReconnected = ref(false)
let dismissTimer: ReturnType<typeof setTimeout> | null = null

// Web-based detection
if (typeof window !== 'undefined') {
  isOnline.value = navigator.onLine

  window.addEventListener('online', () => {
    isOnline.value = true
    justReconnected.value = true
    showBanner.value = true
    // Auto-dismiss reconnection banner after 3s
    dismissTimer = setTimeout(() => {
      showBanner.value = false
      justReconnected.value = false
    }, 3000)
  })

  window.addEventListener('offline', () => {
    isOnline.value = false
    justReconnected.value = false
    showBanner.value = true
    if (dismissTimer) clearTimeout(dismissTimer)
  })
}

// Native detection (Capacitor)
onMounted(async () => {
  if (typeof window === 'undefined') return
  if (!('Capacitor' in window)) return

  try {
    const { Network } = await import('@capacitor/network')
    const status = await Network.getStatus()
    isOnline.value = status.connected

    Network.addListener('networkStatusChange', (status) => {
      const wasOffline = !isOnline.value
      isOnline.value = status.connected

      if (status.connected && wasOffline) {
        justReconnected.value = true
        showBanner.value = true
        dismissTimer = setTimeout(() => {
          showBanner.value = false
          justReconnected.value = false
        }, 3000)
      } else if (!status.connected) {
        justReconnected.value = false
        showBanner.value = true
        if (dismissTimer) clearTimeout(dismissTimer)
      }
    })
  } catch {
    // Not on native — web detection handles it
  }
})

// Also show banner initially if offline
onMounted(() => {
  if (!isOnline.value) {
    showBanner.value = true
  }
})

onUnmounted(() => {
  if (dismissTimer) clearTimeout(dismissTimer)
})
</script>

<template>
  <Transition name="offline-slide">
    <div
      v-if="showBanner"
      class="offline-banner"
    >
      <div
        class="offline-dot"
        :class="justReconnected ? 'offline-dot--online' : 'offline-dot--offline animate-pulse'"
      />
      <span v-if="justReconnected">{{ $t('common.offline.back_online') }}</span>
      <span v-else>{{ $t('common.offline.message') }}</span>
      <button
        v-if="!isOnline"
        class="offline-dismiss"
        @click="showBanner = false"
      >
        {{ $t('common.offline.dismiss') }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
/* Flat surface-2 banner + hairline — no glass, no status-color rainbow.
   The dot carries the semantic: accent = back online, coral = offline
   (coral is the live-marker/attention accent, REDESIGN.md §1). */
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0.5rem 1rem;
  padding-top: max(0.5rem, env(safe-area-inset-top));
  background: var(--nc-surface-2);
  border-bottom: 1px solid var(--nc-border);
  color: var(--nc-text);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
}

.offline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.offline-dot--online {
  background: var(--nc-accent);
}

.offline-dot--offline {
  background: var(--nc-coral);
}

/* Dismiss — mono uppercase chip (kbd-chip grammar, REDESIGN.md §4/§5). */
.offline-dismiss {
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 0.4rem;
  border: 1px solid var(--nc-border-subtle);
  background: var(--nc-chip-bg);
  color: var(--nc-text-secondary);
  font-family: var(--nc-font-mono);
  font-size: calc(0.66rem * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.offline-dismiss:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .offline-dismiss:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

.offline-dismiss:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Enter/leave — transform/opacity only, single ease. */
.offline-slide-enter-active,
.offline-slide-leave-active {
  transition: transform var(--nc-duration-slow) var(--nc-ease),
              opacity var(--nc-duration-slow) var(--nc-ease);
}

.offline-slide-enter-from,
.offline-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
