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
      class="fixed top-0 left-0 right-0 z-9999 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
      :class="justReconnected
        ? 'bg-emerald-900/90 text-emerald-100 border-b border-emerald-700/50'
        : 'bg-amber-900/90 text-amber-100 border-b border-amber-700/50'"
      style="backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding-top: max(0.5rem, env(safe-area-inset-top))"
    >
      <div
        class="w-2 h-2 rounded-full shrink-0"
        :class="justReconnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'"
      />
      <span v-if="justReconnected">{{ $t('common.offline.back_online') }}</span>
      <span v-else>{{ $t('common.offline.message') }}</span>
      <button
        v-if="!isOnline"
        class="ml-2 px-2 py-0.5 rounded text-xs bg-amber-800/60 hover:bg-amber-800 transition-colors"
        @click="showBanner = false"
      >
        {{ $t('common.offline.dismiss') }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.offline-slide-enter-active,
.offline-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.offline-slide-enter-from,
.offline-slide-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
