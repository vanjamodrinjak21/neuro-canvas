<script setup lang="ts">
// Global app setup
useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <div id="neurocanvas-app" class="min-h-screen bg-nc-charcoal">
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
  min-height: 100dvh; /* Dynamic viewport height for mobile */
}
</style>
