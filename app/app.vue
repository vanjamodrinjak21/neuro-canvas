<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useAIPreload } from '~/composables/useAIPreload'

// Initialize user store at root so theme loads once for all pages
useUserStore()

// Background pre-warm of the embedding model so the first user-facing
// semantic operation (search, smart expand, auto-connect) doesn't pay the
// cold-start cost. Native shells skip this — Tauri pre-warms its own ONNX
// engine inside `commands::ml::spawn_preload_default_model`.
useAIPreload()

// Desktop auth modal (Tauri only)
const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const desktopAuth = _isTauri ? useDesktopAuth() : null

// --- App loading screen (native apps only) ---
const _isNativeApp = typeof window !== 'undefined' && (
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
  || ('Capacitor' in window && (window as any).Capacitor?.isNativePlatform?.())
)
const appLoading = ref(_isNativeApp)
const loadingStatus = ref('Initializing...')
const loadingProgress = ref(0)
const loadingRef = ref<InstanceType<typeof AppLoadingScreen> | null>(null)

async function step(progress: number, status: string, ms: number) {
  loadingProgress.value = progress
  loadingStatus.value = status
  await new Promise(resolve => setTimeout(resolve, ms))
}

onMounted(async () => {
  if (_isNativeApp) {
    await step(15, 'Loading assets...', 300)
    await step(35, 'Preparing workspace...', 400)
    await step(60, 'Setting up environment...', 350)
    await step(85, 'Almost ready...', 300)
    await step(100, 'Ready', 200)

    if (loadingRef.value) {
      await loadingRef.value.leave()
    }
    appLoading.value = false
  }

  // Dismiss Capacitor native splash if present
  if (typeof window !== 'undefined' && 'Capacitor' in window) {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide({ fadeOutDuration: 250 })
    }
    catch {}
  }
})

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <div id="neurocanvas-app" class="min-h-screen">
    <!-- App loading screen -->
    <AppLoadingScreen
      v-if="appLoading"
      ref="loadingRef"
      :status="loadingStatus"
      :progress="loadingProgress"
    />

    <NuxtRouteAnnouncer />
    <OfflineIndicator />
    <div class="page-wrapper">
      <NuxtPage />
    </div>

    <!-- Desktop auth iframe modal -->
    <DesktopAuthModal
      v-if="desktopAuth"
      :visible="desktopAuth.showAuthModal.value"
      @close="desktopAuth.closeAuthModal()"
      @authenticated="desktopAuth.completeSignIn()"
    />

    <!-- Global toast stack -->
    <Toast />
  </div>
</template>

<style>
/* App-level styles */
#neurocanvas-app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--nc-bg, #0A0A0C);
}

.page-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
}
</style>
