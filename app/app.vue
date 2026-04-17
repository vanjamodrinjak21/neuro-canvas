<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

// Initialize user store at root so theme loads once for all pages
useUserStore()

// Desktop auth modal (Tauri only)
const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const desktopAuth = _isTauri ? useDesktopAuth() : null

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <div id="neurocanvas-app" class="min-h-screen">
    <NuxtRouteAnnouncer />
    <OfflineIndicator />
    <div class="page-wrapper">
      <NuxtPage />
    </div>

    <!-- Desktop auth iframe modal -->
    <DesktopAuthModal
      v-if="desktopAuth"
      :visible="desktopAuth.showAuthModal.value"
      :url="desktopAuth.authUrl"
      @close="desktopAuth.closeAuthModal()"
      @authenticated="desktopAuth.completeSignIn()"
    />
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
