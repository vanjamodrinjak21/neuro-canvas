<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useGuestMode } from '~/composables/useGuestMode'

const props = defineProps<{
  activeNav?: string
}>()


const userStore = useUserStore()
const sidebarOverlayRef = ref<HTMLDivElement | null>(null)
const sidebarThemeBtnRef = ref<HTMLButtonElement | null>(null)
const sidebarThemeAnimating = ref(false)

const isLightSidebar = computed(() => {
  if (userStore.preferences.value.theme === 'system') {
    if (typeof window === 'undefined') return false
    return !window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return userStore.preferences.value.theme === 'light'
})

function sidebarThemeReveal(btn: HTMLElement, theme: 'light' | 'dark' | 'system') {
  if (sidebarThemeAnimating.value) return
  sidebarThemeAnimating.value = true

  if (!btn || typeof window === 'undefined') {
    userStore.setPreference('theme', theme)
    sidebarThemeAnimating.value = false
    return
  }

  const rect = btn.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const maxX = Math.max(cx, window.innerWidth - cx)
  const maxY = Math.max(cy, window.innerHeight - cy)
  const maxRadius = Math.ceil(Math.sqrt(maxX * maxX + maxY * maxY))

  const overlay = sidebarOverlayRef.value
  if (!overlay) {
    userStore.setPreference('theme', theme)
    sidebarThemeAnimating.value = false
    return
  }

  overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`
  overlay.style.display = 'block'
  overlay.style.opacity = '1'

  overlay.offsetHeight

  overlay.style.transition = 'clip-path 500ms cubic-bezier(0.16, 1, 0.3, 1)'
  overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`

  setTimeout(() => {
    userStore.setPreference('theme', theme)
    setTimeout(() => {
      overlay.style.transition = 'opacity 300ms ease'
      overlay.style.opacity = '0'
      setTimeout(() => {
        overlay.style.display = 'none'
        overlay.style.transition = ''
        overlay.style.clipPath = ''
        sidebarThemeAnimating.value = false
      }, 300)
    }, 60)
  }, 480)
}
const _authStore = (() => {
  try { return useAuthStore() }
  catch { return { handleSignOut: async () => {} } }
})()
const { handleSignOut } = _authStore
const guest = useGuestMode()

const route = useRoute()

const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

// Desktop auth (Tauri only)
const desktopAuth = _isTauri ? useDesktopAuth() : null

// Web auth (non-Tauri only)
const { data: _sessionData } = _isTauri
  ? { data: ref(null) }
  : useAuth()
const session = _sessionData ?? ref(null)

// Unified state
const hasWebSession = computed(() => !!session.value?.user)
const hasDesktopSession = computed(() => !!desktopAuth?.isSignedIn.value)
const isSignedIn = computed(() => hasWebSession.value || hasDesktopSession.value)
const isDesktopLocal = computed(() => _isTauri && !isSignedIn.value)

const user = computed(() => session.value?.user)
const userName = computed(() => {
  if (user.value?.name) return user.value.name
  if (user.value?.email) return user.value.email.split('@')[0]
  if (hasDesktopSession.value) return 'Signed In'
  return 'User'
})
const userEmail = computed(() => {
  if (user.value?.email) return user.value.email
  if (hasDesktopSession.value) return 'neuro-canvas.com'
  return ''
})
const userInitials = computed(() => {
  if (hasDesktopSession.value && !user.value) return 'NC'
  const name = userName.value
  const parts = name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

const currentNav = computed(() => {
  if (props.activeNav) return props.activeNav
  if (route.path === '/dashboard') return 'home'
  if (route.path.startsWith('/maps')) return 'maps'
  if (route.path.startsWith('/templates')) return 'templates'
  if (route.path === '/settings') return 'settings'
  return 'home'
})

const navItems = [
  { id: 'home', label: 'Home', icon: 'i-lucide-house', to: '/dashboard' },
  { id: 'maps', label: 'All Maps', icon: 'i-lucide-layout-grid', to: '/maps' },
  { id: 'templates', label: 'Templates', icon: 'i-lucide-layers', to: '/templates' },
  { id: 'settings', label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]

const visibleNavItems = computed(() => {
  if (guest.isGuest.value) return []
  return navItems
})

// Sidebar collapse
const collapsed = ref(false)
function toggleCollapse() {
  collapsed.value = !collapsed.value
}

// User menu expand (shows theme toggle)
const userMenuOpen = ref(false)
function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

// Sign out hover reveal
const userHovered = ref(false)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

function onUserEnter() {
  if (hoverTimeout) clearTimeout(hoverTimeout)
  userHovered.value = true
}

function onUserLeave() {
  hoverTimeout = setTimeout(() => {
    userHovered.value = false
  }, 300)
}

function onSignOut() {
  if (desktopAuth) {
    desktopAuth.signOut()
    return
  }
  handleSignOut()
}

// Search
const searchQuery = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    searchQuery.value = ''
    searchInput.value?.blur()
  }
}

onMounted(() => {
  function onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      if (collapsed.value) collapsed.value = false
      nextTick(() => searchInput.value?.focus())
    }
  }
  window.addEventListener('keydown', onKeydown)
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
})
</script>

<template>
  <aside :class="['sidebar', { collapsed }]">
    <!-- Logo -->
    <div class="sidebar-logo">
      <NcLogo :size="14" :container-size="28" :radius="7" />
      <span v-if="!collapsed" class="logo-text">NeuroCanvas</span>
      <button v-if="!collapsed" class="collapse-btn" title="Collapse sidebar" @click="toggleCollapse">
        <span class="i-lucide-panel-left-close collapse-icon" />
      </button>
    </div>

    <!-- Expand button (when collapsed) -->
    <button v-if="collapsed" class="expand-btn" title="Expand sidebar" @click="toggleCollapse">
      <span class="i-lucide-panel-left-open collapse-icon" />
    </button>

    <!-- Search -->
    <div v-if="!collapsed" class="sidebar-search">
      <span class="i-lucide-search search-icon" />
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        placeholder="Search maps..."
        class="search-input"
        @keydown="handleSearchKeydown"
      >
      <kbd class="search-kbd">⌘K</kbd>
    </div>
    <button v-else class="collapsed-search" title="Search (⌘K)" @click="toggleCollapse">
      <span class="i-lucide-search" />
    </button>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <NuxtLink
        v-for="item in visibleNavItems"
        :key="item.id"
        :to="item.to"
        :class="['nav-item', { active: currentNav === item.id }]"
        :title="collapsed ? item.label : undefined"
      >
        <span :class="['nav-icon', item.icon]" />
        <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <!-- Bottom section -->
    <div class="sidebar-bottom">
      <!-- Guest: show sign-up CTA -->
      <div v-if="guest.isGuest.value" class="guest-cta">
        <NuxtLink to="/auth/signup" class="guest-signup-btn" @click="guest.exitGuestMode()">
          <span class="i-lucide-user-plus guest-signup-icon" />
          <template v-if="!collapsed">
            <span class="guest-signup-text">Sign up free</span>
            <span class="guest-signup-sub">Unlock all features</span>
          </template>
        </NuxtLink>
      </div>

      <!-- Desktop local mode: Sign In button (opens in-app auth window) -->
      <div v-if="isDesktopLocal && !guest.isGuest.value" class="user-section">
        <button
          class="signin-btn"
          :disabled="desktopAuth?.isAuthWindowOpen.value"
          @click="desktopAuth?.signIn()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
          <span v-if="!collapsed">{{ desktopAuth?.isAuthWindowOpen.value ? 'Signing in...' : 'Sign In' }}</span>
        </button>
      </div>

      <!-- Signed-in User Profile -->
      <div
        v-if="!isDesktopLocal && !guest.isGuest.value"
        class="user-section"
        @mouseenter="onUserEnter"
        @mouseleave="onUserLeave"
      >
        <div class="sidebar-user-row">
          <NuxtLink to="/settings" class="sidebar-user-link">
            <div class="user-avatar">
              <span class="user-initials">{{ userInitials }}</span>
            </div>
            <template v-if="!collapsed">
              <div class="user-info">
                <span class="user-name">{{ userName }}</span>
                <span class="user-email">{{ userEmail }}</span>
              </div>
            </template>
          </NuxtLink>
          <button
            ref="sidebarThemeBtnRef"
            class="sidebar-theme-btn"
            :aria-label="isLightSidebar ? 'Switch to dark mode' : 'Switch to light mode'"
            @click.stop="sidebarThemeReveal($event.currentTarget as HTMLElement, isLightSidebar ? 'dark' : 'light')"
          >
            <!-- Sun -->
            <svg v-if="isLightSidebar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            <!-- Moon -->
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          </button>
        </div>

        <!-- Sign Out (hover reveal) -->
        <Transition name="signout">
          <button
            v-if="userHovered && !collapsed"
            class="signout-btn"
            @click.stop="onSignOut"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            <span>Sign Out</span>
          </button>
        </Transition>
      </div>
    </div>
  </aside>

  <!-- Theme swipe overlay -->
  <Teleport to="body">
    <div ref="sidebarOverlayRef" class="sidebar-swipe-overlay" />
  </Teleport>
</template>

<style scoped>
.sidebar-swipe-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: #00D2BE;
  z-index: 9999;
  pointer-events: none;
}

.sidebar {
  display: flex;
  flex-direction: column;
  width: 240px;
  height: 100vh;
  flex-shrink: 0;
  padding: 20px 16px;
  background: var(--sb-bg, #09090B);
  border-right: 1px solid var(--sb-border, #1A1A1E);
  position: sticky;
  top: 0;
  transition: width var(--nc-duration-normal, 200ms) var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

.sidebar.collapsed {
  width: 64px;
  padding: 20px 12px;
  align-items: center;
}

/* Logo */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  margin-bottom: 28px;
}

.collapsed .sidebar-logo {
  padding: 0;
  justify-content: center;
  gap: 0;
}

.logo-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--sb-text, #FAFAFA);
  flex: 1;
}

.collapse-btn,
.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  border-radius: 6px;
  color: var(--sb-muted, #52525B);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}

.collapse-btn:hover,
.expand-btn:hover {
  color: var(--sb-text, #FAFAFA);
  background: var(--sb-hover, #111113);
}

.expand-btn {
  margin-bottom: 16px;
}

.collapse-icon {
  font-size: 16px;
}

/* Search */
.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 20px;
  background: var(--sb-surface, #111113);
  border: 1px solid var(--sb-border, #1A1A1E);
  border-radius: 6px;
  cursor: text;
}

.collapsed-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 36px;
  margin-bottom: 20px;
  background: var(--sb-surface, #111113);
  border: 1px solid var(--sb-border, #1A1A1E);
  border-radius: 6px;
  color: var(--sb-muted, #52525B);
  font-size: 14px;
  cursor: pointer;
  transition: color 0.15s;
}

.collapsed-search:hover {
  color: var(--sb-text, #FAFAFA);
}

.search-icon {
  font-size: 14px;
  color: var(--sb-muted, #52525B);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: var(--sb-text, #FAFAFA);
  min-width: 0;
}

.search-input::placeholder {
  color: var(--sb-muted, #52525B);
}

.search-kbd {
  margin-left: auto;
  padding: 2px 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: var(--sb-muted-2, #3F3F46);
  background: var(--sb-kbd-bg, #18181B);
  border: 1px solid var(--sb-kbd-border, #27272A);
  border-radius: 4px;
  flex-shrink: 0;
}

/* Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  min-height: 40px;
  border-radius: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--sb-secondary, #A1A1AA);
  text-decoration: none;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background var(--nc-duration-fast) var(--nc-ease-out),
              color var(--nc-duration-fast) var(--nc-ease-out),
              transform var(--nc-duration-press) var(--nc-ease-out);
}

@media (hover: none) {
  .nav-item {
    min-height: 44px;
    padding: 12px 10px;
  }
}

.nav-item:active {
  transform: scale(0.97);
}

.collapsed .nav-item {
  justify-content: center;
  padding: 8px;
  width: 40px;
}

.nav-item:hover {
  background: var(--sb-hover, #111113);
  color: var(--sb-text, #FAFAFA);
}

.nav-item.active {
  background: var(--sb-active-bg, rgba(0, 210, 190, 0.08));
  color: var(--sb-accent, #00D2BE);
}

.nav-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.nav-label {
  line-height: 16px;
}

/* Bottom section */
.sidebar-bottom {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Theme Toggle */
.sidebar-theme {
  display: flex;
  gap: 2px;
  padding: 3px;
  margin-bottom: 8px;
  background: var(--sb-surface, #111113);
  border: 1px solid var(--sb-border, #1A1A1E);
  border-radius: 6px;
}

.theme-opt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 4px;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--sb-muted, #52525B);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.theme-opt:hover {
  color: var(--sb-text, #FAFAFA);
}

.theme-opt.active {
  background: var(--sb-theme-active, #09090B);
  color: var(--sb-accent, #00D2BE);
}

.theme-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
}

/* Slide transition */
.slide-enter-active {
  transition: opacity var(--nc-duration-normal) var(--nc-ease-out),
              max-height var(--nc-duration-normal) var(--nc-ease-out),
              margin-bottom var(--nc-duration-normal) var(--nc-ease-out);
  overflow: hidden;
}

.slide-leave-active {
  transition: opacity var(--nc-duration-fast) cubic-bezier(0.4, 0, 1, 1),
              max-height var(--nc-duration-fast) cubic-bezier(0.4, 0, 1, 1),
              margin-bottom var(--nc-duration-fast) cubic-bezier(0.4, 0, 1, 1);
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 44px;
  margin-bottom: 8px;
}

/* User Profile */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  border-top: 1px solid var(--sb-border, #1A1A1E);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.collapsed .sidebar-user {
  justify-content: center;
  padding: 12px 8px;
}

.sidebar-user:hover {
  background: var(--sb-hover, #111113);
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--sb-accent, #00D2BE);
}

.user-initials {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #09090B;
  line-height: 16px;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--sb-text, #FAFAFA);
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 400;
  color: var(--sb-muted, #52525B);
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chevron {
  font-size: 14px;
  color: var(--sb-muted-2, #3F3F46);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

/* Guest CTA */
.guest-cta {
  padding: 12px;
  border-left: 2px solid var(--nc-accent, #00D2BE);
  margin-left: 12px;
}

.guest-signup-btn {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: var(--nc-accent, #00D2BE);
  border: none;
  border-radius: 10px;
  color: #09090B;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.guest-signup-btn:hover {
  opacity: 0.9;
}

.sidebar-user-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sidebar-user-link {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  text-decoration: none;
  color: inherit;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.15s ease;
  cursor: pointer;
}

.sidebar-user-link:hover {
  background: rgba(255, 255, 255, 0.04);
}

:root.light .sidebar-user-link:hover {
  background: rgba(0, 0, 0, 0.04);
}

.sidebar-theme-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sb-muted, #71717A);
  flex-shrink: 0;
  transition: color 0.15s ease, background 0.15s ease;
}

.sidebar-theme-btn:hover {
  color: var(--sb-text, #FAFAFA);
  background: rgba(255, 255, 255, 0.06);
}

:root.light .sidebar-theme-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.guest-signup-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.guest-signup-text {
  font-weight: 600;
}

.guest-signup-sub {
  width: 100%;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.7;
  margin-top: -4px;
}

/* User section wrapper */
.user-section {
  position: relative;
}

/* Sign In button (desktop local mode) */
.signin-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  border: none;
  background: rgba(0, 210, 190, 0.08);
  border-radius: 6px;
  color: #00D2BE;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  text-decoration: none;
}

.signin-btn:hover {
  background: rgba(0, 210, 190, 0.15);
}

/* Sign Out button */
.signout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  border: none;
  background: rgba(239, 68, 68, 0.06);
  border-radius: 6px;
  color: #EF4444;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.signout-btn:hover {
  background: rgba(239, 68, 68, 0.12);
}

/* Sign out transition */
.signout-enter-active {
  transition: opacity 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              transform 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              max-height 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              margin-top 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              padding-top 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1)),
              padding-bottom 150ms var(--nc-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
}

.signout-leave-active {
  transition: opacity 100ms cubic-bezier(0.4, 0, 1, 1),
              transform 100ms cubic-bezier(0.4, 0, 1, 1),
              max-height 100ms cubic-bezier(0.4, 0, 1, 1),
              margin-top 100ms cubic-bezier(0.4, 0, 1, 1),
              padding-top 100ms cubic-bezier(0.4, 0, 1, 1),
              padding-bottom 100ms cubic-bezier(0.4, 0, 1, 1);
}

.signout-enter-from {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.signout-enter-to {
  opacity: 1;
  transform: translateY(0);
  max-height: 40px;
  margin-top: 4px;
}

.signout-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 40px;
}

.signout-leave-to {
  opacity: 0;
  transform: translateY(-4px);
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
}

/* Light theme */
:root.light .sidebar {
  --sb-bg: #F5F5F3;
  --sb-border: #E8E8E6;
  --sb-surface: #E8E8E6;
  --sb-text: #111111;
  --sb-secondary: #71717A;
  --sb-muted: #777777;
  --sb-muted-2: #D4D4D8;
  --sb-accent: #00D2BE;
  --sb-active-bg: rgba(0, 210, 190, 0.08);
  --sb-hover: #E8E8E6;
  --sb-kbd-bg: #F4F4F5;
  --sb-kbd-border: #E8E8E6;
  --sb-theme-active: #FFFFFF;
}

:root.light .user-avatar {
  background: var(--sb-accent);
}

:root.light .user-initials {
  color: #FFFFFF;
}

:root.light .collapse-btn:hover,
:root.light .expand-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

:root.light .collapsed-search:hover {
  color: var(--sb-text);
}

:root.light .signout-btn {
  background: rgba(239, 68, 68, 0.04);
}

:root.light .signout-btn:hover {
  background: rgba(239, 68, 68, 0.08);
}

/* Laptop breakpoint */
@media (max-width: 1366px) {
  .sidebar {
    width: 220px;
    padding: 20px 14px;
  }

  .sidebar-logo {
    margin-bottom: 24px;
  }

  .logo-text {
    font-size: 15px;
  }
}
</style>
