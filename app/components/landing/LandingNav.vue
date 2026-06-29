<script setup lang="ts">
defineProps<{ isAuthenticated: boolean }>()

// In-page smooth scroll to a section anchor. Operates on document element ids
// (the sections live in the parent landing page), so it is self-contained here.
function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <nav class="nav">
    <div class="nav-left">
      <NuxtLink to="/" class="brand">
        <NcLogo :size="14" :container-size="24" :radius="6" />
        <span class="brand-name">NeuroCanvas</span>
      </NuxtLink>
      <div class="nav-links">
        <a href="#how-it-works" @click.prevent="scrollToId('how-it-works')">{{ $t('landing.nav.product') }}</a>
        <a href="#templates" @click.prevent="scrollToId('templates')">{{ $t('landing.nav.templates') }}</a>
        <NuxtLink to="/docs">{{ $t('landing.nav.docs') }}</NuxtLink>
        <NuxtLink to="/download">{{ $t('landing.nav.download') }}</NuxtLink>
      </div>
    </div>
    <div class="nav-right">
      <NuxtLink v-if="!isAuthenticated" to="/auth/signin" class="nav-signin">{{ $t('landing.nav.signin') }}</NuxtLink>
      <NuxtLink v-else to="/dashboard" class="nav-dash">
        {{ $t('landing.nav.open_dashboard') }}
      </NuxtLink>
    </div>
  </nav>
</template>

<!-- Extracted from index.vue. CSS custom properties cascade in from the landing
     wrapper through the unchanged DOM position. -->
<style scoped>
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 56px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  z-index: 100;
}

:root.light .nav { background: rgba(250, 250, 249, 0.85); }

.nav-left {
  display: flex;
  align-items: center;
  gap: 40px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
}

.brand-name {
  font-family: var(--sans);
  font-size: calc(15px * var(--nc-text-scale, 1));
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 18px;
  color: var(--text);
}

.nav-links {
  display: flex;
  gap: 28px;
}

.nav-links a {
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text-2);
  text-decoration: none;
  transition: color 120ms ease;
}

.nav-links a:hover { color: var(--text); }

.nav-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-signin {
  padding: 8px 12px;
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text-2);
  text-decoration: none;
  transition: color 120ms ease;
}

.nav-signin:hover { color: var(--text); }

.nav-dash {
  padding: 8px 16px;
  border: 1px solid var(--border-3);
  border-radius: 10px;
  font-family: var(--sans);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--text);
  text-decoration: none;
  transition: border-color 120ms ease, background 120ms ease;
}

.nav-dash:hover { border-color: var(--border-4); background: var(--bg-2); }

@media (max-width: 1280px) {
  .nav { padding: 20px 32px; }
}

@media (max-width: 768px) {
  .nav { padding: 16px 20px; }
  .nav-links { display: none; }
}
</style>
