<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

const props = defineProps<{
  activeNav?: string
}>()

const emit = defineEmits<{
  (e: 'open-templates'): void
}>()

const userStore = useUserStore()
const { handleSignOut } = useAuthStore()

const route = useRoute()

const _isTauri = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
const _tauriSession = { user: { id: 'desktop-user', email: 'desktop@neurocanvas.local', name: 'Desktop User' } }
const { data: _sessionData } = _isTauri
  ? { data: ref(_tauriSession) }
  : useAuth()
const session = _sessionData ?? ref(null)

const user = computed(() => session.value?.user)
const userName = computed(() => {
  if (user.value?.name) return user.value.name
  if (user.value?.email) return user.value.email.split('@')[0]
  return 'User'
})
const userEmail = computed(() => user.value?.email || '')
const userInitials = computed(() => {
  const name = userName.value
  const parts = name.split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
})

const currentNav = computed(() => {
  if (props.activeNav) return props.activeNav
  if (route.path === '/dashboard') return 'home'
  if (route.path.startsWith('/maps')) return 'maps'
  if (route.path === '/settings') return 'settings'
  return 'home'
})

const navItems = [
  { id: 'home', label: 'Home', icon: 'i-lucide-house', to: '/dashboard' },
  { id: 'maps', label: 'All Maps', icon: 'i-lucide-layout-grid', to: '/maps' },
  { id: 'templates', label: 'Templates', icon: 'i-lucide-layers', action: 'open-templates' },
  { id: 'settings', label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]

function handleNavClick(item: typeof navItems[0]) {
  if (item.action) {
    emit(item.action as 'open-templates')
  }
}

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
      <button v-if="!collapsed" class="collapse-btn" @click="toggleCollapse" title="Collapse sidebar">
        <span class="i-lucide-panel-left-close collapse-icon" />
      </button>
    </div>

    <!-- Expand button (when collapsed) -->
    <button v-if="collapsed" class="expand-btn" @click="toggleCollapse" title="Expand sidebar">
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
      <template v-for="item in navItems" :key="item.id">
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          :class="['nav-item', { active: currentNav === item.id }]"
          :title="collapsed ? item.label : undefined"
        >
          <span :class="['nav-icon', item.icon]" />
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </NuxtLink>
        <button
          v-else
          :class="['nav-item', { active: currentNav === item.id }]"
          :title="collapsed ? item.label : undefined"
          @click="handleNavClick(item)"
        >
          <span :class="['nav-icon', item.icon]" />
          <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
        </button>
      </template>
    </nav>

    <!-- Bottom section -->
    <div class="sidebar-bottom">
      <!-- Theme toggle (collapsible under user) -->
      <Transition name="slide">
        <div v-if="userMenuOpen && !collapsed" class="sidebar-theme">
          <button
            :class="['theme-opt', { active: userStore.preferences.value.theme === 'light' }]"
            @click="userStore.setPreference('theme', 'light')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            <span class="theme-label">Light</span>
          </button>
          <button
            :class="['theme-opt', { active: userStore.preferences.value.theme === 'dark' }]"
            @click="userStore.setPreference('theme', 'dark')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            <span class="theme-label">Dark</span>
          </button>
          <button
            :class="['theme-opt', { active: userStore.preferences.value.theme === 'system' }]"
            @click="userStore.setPreference('theme', 'system')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            <span class="theme-label">System</span>
          </button>
        </div>
      </Transition>

      <!-- User Profile -->
      <div
        class="user-section"
        @mouseenter="onUserEnter"
        @mouseleave="onUserLeave"
      >
        <div :class="['sidebar-user', { open: userMenuOpen }]" @click="toggleUserMenu">
          <div class="user-avatar">
            <span class="user-initials">{{ userInitials }}</span>
          </div>
          <template v-if="!collapsed">
            <div class="user-info">
              <span class="user-name">{{ userName }}</span>
              <span class="user-email">{{ userEmail }}</span>
            </div>
            <span :class="['user-chevron', userMenuOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up']" />
          </template>
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
</template>

<style scoped>
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
  transition: width 0.2s ease;
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
  transition: background 0.15s, color 0.15s, transform 150ms var(--nc-ease);
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
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
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

/* User section wrapper */
.user-section {
  position: relative;
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.signout-leave-active {
  transition: all 0.15s ease-in;
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
