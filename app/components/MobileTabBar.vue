<script setup lang="ts">
const route = useRoute()
const { haptics, isMobile } = usePlatform()
const { t } = useI18n()

const tabs = computed(() => [
  { name: t('common.nav.home'), path: '/dashboard', icon: 'home' as const },
  { name: t('common.nav.maps'), path: '/maps', icon: 'maps' as const },
  { name: t('common.nav.templates'), path: '/dashboard?templates=true', icon: 'templates' as const },
  { name: t('common.nav.settings'), path: '/settings', icon: 'settings' as const },
])

function isActive(tab: typeof tabs[number]): boolean {
  if (tab.icon === 'home') return route.path === '/dashboard' && !route.query.templates
  if (tab.icon === 'maps') return route.path === '/maps'
  if (tab.icon === 'templates') return route.query.templates === 'true'
  if (tab.icon === 'settings') return route.path === '/settings'
  return false
}

function onTabTap() {
  if (isMobile.value) {
    haptics.selection()
  }
}
</script>

<template>
  <nav class="mobile-tab-bar">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.icon"
      :to="tab.path"
      class="tab-item"
      :class="{ active: isActive(tab) }"
      @click="onTabTap"
    >
      <!-- Home -->
      <svg v-if="tab.icon === 'home'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <!-- Templates -->
      <svg v-else-if="tab.icon === 'templates'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
      <!-- Maps -->
      <svg v-else-if="tab.icon === 'maps'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <!-- Settings -->
      <svg v-else-if="tab.icon === 'settings'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span class="tab-label">{{ tab.name }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.mobile-tab-bar {
  display: none;
}

@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    padding: 12px 24px calc(env(safe-area-inset-bottom, 0px) + 12px);
    background: #0A0A0C;
    border-top: 1px solid #1E1E22;
  }

  :root.light .mobile-tab-bar {
    background: #FAFAF9;
    border-top-color: #E8E8E6;
  }

  :root.light .tab-item {
    color: #71717A;
  }

  :root.light .tab-item.active {
    color: #00D2BE;
  }

  .tab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 44px;
    min-width: 44px;
    padding: 4px 8px;
    text-decoration: none;
    color: #A1A1AA;
    transition: color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .tab-item svg {
    transition: transform 200ms var(--nc-ease);
  }

  .tab-item.active {
    color: #00D2BE;
  }

  .tab-item.active svg {
    transform: scale(1.08);
    transition: transform 200ms var(--nc-ease-bounce);
  }

  .tab-item.active .tab-label {
    font-weight: 600;
  }

  .tab-label {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 10px;
    font-weight: 500;
    line-height: 12px;
  }
}
</style>
