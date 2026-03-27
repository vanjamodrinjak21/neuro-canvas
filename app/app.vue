<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

// Initialize user store at root so theme loads once for all pages
useUserStore()

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <div id="neurocanvas-app" class="min-h-screen">
    <NuxtRouteAnnouncer />
    <NuxtPage />
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
</style>
