<script setup lang="ts">
const route = useRoute()
const { haptics, isMobile } = usePlatform()
const { t } = useI18n()

const tabs = computed(() => [
  { name: t('common.nav.home'), path: '/dashboard', icon: 'home' as const },
  { name: t('common.nav.maps'), path: '/maps', icon: 'maps' as const },
  { name: t('common.nav.templates'), path: '/templates', icon: 'templates' as const },
  { name: t('common.nav.settings'), path: '/settings', icon: 'settings' as const },
])

function isActive(tab: typeof tabs.value[number]): boolean {
  if (tab.icon === 'home') return route.path === '/dashboard'
  if (tab.icon === 'maps') return route.path === '/maps'
  if (tab.icon === 'templates') return route.path.startsWith('/templates')
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
  <nav class="mobile-tab-bar" aria-label="Mobile navigation">
    <div class="mtb-tabs">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.icon"
        :to="tab.path"
        class="mtb-tab"
        :class="{ 'mtb-tab--active': isActive(tab) }"
        :aria-label="tab.name"
        @click="onTabTap"
      >
        <!-- Home: filled when active, outlined otherwise (Paper) -->
        <svg v-if="tab.icon === 'home' && isActive(tab)" width="22" height="22" viewBox="0 0 22 22" fill="currentColor">
          <path d="M3.5 9.5L11 3L18.5 9.5V18C18.5 18.5523 18.0523 19 17.5 19H4.5C3.94772 19 3.5 18.5523 3.5 18V9.5Z" />
        </svg>
        <svg v-else-if="tab.icon === 'home'" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3.5 9.5L11 3L18.5 9.5V18C18.5 18.5523 18.0523 19 17.5 19H4.5C3.94772 19 3.5 18.5523 3.5 18V9.5Z" />
        </svg>

        <!-- Maps: book/atlas (Paper Try-Free) -->
        <svg v-else-if="tab.icon === 'maps'" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6L8 4L14 6L19 4V16L14 18L8 16L3 18V6Z" />
          <path d="M8 4V16M14 6V18" />
        </svg>

        <!-- Templates: 4× rounded squares (Paper) -->
        <svg v-else-if="tab.icon === 'templates'" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="12" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="12" width="7" height="7" rx="1.5" />
          <rect x="12" y="12" width="7" height="7" rx="1.5" />
        </svg>

        <!-- Settings: full gear (Paper path, fill-based for solidity at 22×22) -->
        <svg v-else-if="tab.icon === 'settings'" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.43 12.98C19.47 12.66 19.5 12.34 19.5 12C19.5 11.66 19.47 11.34 19.43 11.02L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.97 19.05 5.05L16.56 6.05C16.04 5.65 15.48 5.32 14.87 5.07L14.49 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.51 2.42L9.13 5.07C8.52 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.72 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11.02C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.66 4.57 12.98L2.46 14.63C2.27 14.78 2.22 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.95C7.96 18.35 8.52 18.68 9.13 18.93L9.51 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.49 21.58L14.87 18.93C15.48 18.68 16.04 18.34 16.56 17.95L19.05 18.95C19.28 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98ZM12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12C15.5 13.93 13.93 15.5 12 15.5Z" />
        </svg>
      </NuxtLink>
    </div>
    <!-- Home/gesture indicator pill (Paper) -->
    <div class="mtb-pill-slot">
      <div class="mtb-pill" />
    </div>
  </nav>
</template>

<style scoped>
.mobile-tab-bar { display: none; }

@media (max-width: 768px) {
  .mobile-tab-bar {
    display: flex;
    flex-direction: column;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: #09090B;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    -webkit-tap-highlight-color: transparent;
  }
  .mtb-tabs {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 20px 28px 10px 28px;
    width: 100%;
    box-sizing: border-box;
  }
  .mtb-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: #A1A1AA;
    text-decoration: none;
    transition: color 150ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
    flex-shrink: 0;
  }
  .mtb-tab--active { color: #00D2BE; }
  .mtb-tab:active { transform: scale(0.92); }

  .mtb-pill-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
    width: 100%;
  }
  .mtb-pill {
    width: 134px;
    height: 5px;
    border-radius: 999px;
    background: rgba(250, 250, 250, 0.85);
  }
}
</style>
