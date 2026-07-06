<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useGuestMode } from '~/composables/useGuestMode'
import { resolveDisplayName, resolveInitials } from '~/utils/userDisplay'
import NcAiMark from '~/components/ui/NcAiMark.vue'

const { t } = useI18n()

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
      overlay.style.transition = 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)'
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

// Unified state — web session only counts if it has a real email (not the Tauri local-only user)
const hasWebSession = computed(() => !!session.value?.user?.email)
const hasDesktopSession = computed(() => !!desktopAuth?.isSignedIn.value)
const isSignedIn = computed(() => hasWebSession.value || hasDesktopSession.value)
const isDesktopLocal = computed(() => _isTauri && !isSignedIn.value)

const user = computed(() => session.value?.user)
const desktopUser = computed(() => desktopAuth?.user?.value)
const userName = computed(() => {
  const fallback = t('auth.user_menu.user_default')
  // Prefer the web session, fall back to the desktop (Tauri) user. A private
  // Apple relay / local-device email resolves to the clean fallback rather than
  // a meaningless handle (see resolveDisplayName).
  return resolveDisplayName(user.value ?? desktopUser.value, fallback)
})
const userEmail = computed(() => {
  if (user.value?.email) return user.value.email
  if (desktopUser.value?.email) return desktopUser.value.email
  return ''
})
const userInitials = computed(() => {
  if (hasDesktopSession.value && !user.value && !desktopUser.value) return 'NC'
  return resolveInitials(userName.value)
})
const userImage = computed<string | null>(() => {
  const u = user.value as { image?: string | null; picture?: string | null } | undefined
  const d = desktopUser.value as { image?: string | null; picture?: string | null } | undefined
  return u?.image || u?.picture || d?.image || d?.picture || null
})

const currentNav = computed(() => {
  if (props.activeNav) return props.activeNav
  if (route.path === '/dashboard') return 'home'
  if (route.path.startsWith('/maps')) return 'maps'
  if (route.path.startsWith('/documents')) return 'documents'
  if (route.path.startsWith('/templates')) return 'templates'
  if (route.path.startsWith('/settings')) return 'settings'
  return 'home'
})

const navItems = computed(() => [
  { id: 'home', label: t('common.nav.home'), icon: 'i-lucide-house', to: '/dashboard' },
  { id: 'maps', label: t('common.nav.maps'), icon: 'i-lucide-layout-grid', to: '/maps' },
  // { id: 'documents', label: t('common.nav.documents'), icon: 'i-lucide-file-text', to: '/documents' },
  { id: 'templates', label: t('common.nav.templates'), icon: 'i-lucide-layers', to: '/templates' },
  { id: 'settings', label: t('common.nav.settings'), icon: 'i-lucide-settings', to: '/settings' },
])

const visibleNavItems = computed(() => {
  if (guest.isGuest.value) return []
  return navItems.value
})

// Sidebar collapse — persisted so the rail stays put across navigation/reload.
// AppSidebar is mounted per-page (dashboard, maps, templates, settings, …); a
// plain ref would reset to expanded on every route change, so back it with
// localStorage and have each freshly-mounted instance restore the last state.
// Implemented against localStorage directly (not VueUse's useStorage) so this
// always-mounted component never depends on an auto-import that may not be
// present in every build.
const COLLAPSE_KEY = 'nc-sidebar-collapsed'
const collapsed = ref(import.meta.client && localStorage.getItem(COLLAPSE_KEY) === 'true')
watch(collapsed, (value) => {
  if (!import.meta.client) return
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? 'true' : 'false')
  } catch {
    // localStorage unavailable (private mode / blocked) — persistence is best-effort.
  }
})
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

async function onSignOut() {
  if (desktopAuth) {
    // desktopAuth.signOut() now owns the full teardown (flush + server revoke +
    // clearUserData + drop session), so the early return no longer skips local
    // data clearing — and there's no double-clear because handleSignOut (which
    // also clears) is NOT called on the desktop path.
    await desktopAuth.signOut()
    return
  }
  await handleSignOut()
}

// Search → launches the global command palette (Cmd/Ctrl+K). The old sidebar
// search box was inert (no results were ever wired to it); it now opens the
// real Spotlight-style palette (app/components/CommandPalette.vue), which also
// owns the global Cmd+K listener — so no local keydown handler is needed here.
const palette = useCommandPalette()
</script>

<template>
  <aside :class="['sidebar', { collapsed }]">
    <!-- Logo -->
    <div class="sidebar-logo">
      <NcLogo :size="14" :container-size="28" :radius="7" />
      <span v-if="!collapsed" class="logo-text">NeuroCanvas</span>
      <button v-if="!collapsed" class="collapse-btn" :title="$t('canvas.sidebar.collapse_tooltip')" @click="toggleCollapse">
        <span class="i-lucide-panel-left-close collapse-icon" />
      </button>
    </div>

    <!-- Expand button (when collapsed) -->
    <button v-if="collapsed" class="expand-btn" :title="$t('canvas.sidebar.expand_tooltip')" @click="toggleCollapse">
      <span class="i-lucide-panel-left-open collapse-icon" />
    </button>

    <!-- Search → opens the global command palette -->
    <div v-if="!collapsed" class="sidebar-search" role="button" tabindex="0" @click="palette.open()" @keydown.enter="palette.open()">
      <span class="i-lucide-search search-icon" />
      <input
        type="text"
        readonly
        tabindex="-1"
        :placeholder="$t('canvas.sidebar.search_placeholder')"
        class="search-input"
        @mousedown.prevent
      >
      <kbd class="search-kbd">⌘K</kbd>
    </div>
    <button v-else class="collapsed-search" :title="$t('canvas.sidebar.search_tooltip')" @click="palette.open()">
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
      <!-- Guest: engagement ladder + save CTA -->
      <div v-if="guest.isGuest.value" class="guest-ladder" :class="{ 'is-collapsed': collapsed }">
        <template v-if="!collapsed">
          <div class="ladder-eyebrow-row">
            <span class="ladder-eyebrow">{{ $t('common.sidebar.upgrade_ladder.unlock_title') }}</span>
            <span class="ladder-count">{{ $t('common.sidebar.upgrade_ladder.item_5_things') }}</span>
          </div>
          <ul class="ladder-list">
            <li class="ladder-item is-next">
              <span class="ladder-icon ladder-icon--ai">
                <NcAiMark :size="12" />
              </span>
              <span class="ladder-label">{{ $t('common.sidebar.upgrade_ladder.item_ai_node') }}</span>
              <span class="ladder-arrow">→</span>
            </li>
            <li class="ladder-item">
              <span class="ladder-icon">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M7 2 V8 M4 5 L7 8 L10 5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M2 11 H12" />
                </svg>
              </span>
              <span class="ladder-label">{{ $t('common.sidebar.upgrade_ladder.item_export') }}</span>
            </li>
            <li class="ladder-item">
              <span class="ladder-icon">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="2" y="2" width="10" height="10" rx="1.5" />
                  <path d="M5 7 L7 9 L10 5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="ladder-label">{{ $t('common.sidebar.upgrade_ladder.item_multiple_maps') }}</span>
            </li>
            <li class="ladder-item">
              <span class="ladder-icon">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 4 L11 4 M3 7 L11 7 M3 10 L8 10" stroke-linecap="round" />
                </svg>
              </span>
              <span class="ladder-label">{{ $t('common.sidebar.upgrade_ladder.item_templates') }}</span>
            </li>
            <li class="ladder-item">
              <span class="ladder-icon">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="7" cy="7" r="4.5" />
                  <path d="M7 3 V7 H10" />
                </svg>
              </span>
              <span class="ladder-label">{{ $t('common.sidebar.upgrade_ladder.item_sync') }}</span>
            </li>
          </ul>
        </template>

        <NuxtLink to="/auth/signup" class="ladder-cta" :title="collapsed ? $t('canvas.sidebar.save_tooltip') : undefined" @click="guest.exitGuestMode()">
          <template v-if="!collapsed">
            <div class="ladder-cta-meta">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="6" cy="6" r="4.5" />
                <path d="M6 4 V6 L7.5 7.5" />
              </svg>
              <span>{{ $t('common.sidebar.upgrade_ladder.cta_meta') }}</span>
            </div>
            <div class="ladder-cta-title">{{ $t('common.sidebar.upgrade_ladder.cta_title') }}</div>
            <div class="ladder-cta-desc">{{ $t('common.sidebar.upgrade_ladder.cta_desc') }}</div>
            <div class="ladder-cta-btn">{{ $t('common.sidebar.upgrade_ladder.cta_button') }}</div>
          </template>
          <span v-else class="ladder-cta-collapsed">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 8 L7 12 L13 4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </NuxtLink>
      </div>

      <!-- Desktop local mode: Sign In button (opens in-app auth window) -->
      <div v-if="isDesktopLocal && !guest.isGuest.value" class="user-section">
        <button
          class="signin-btn"
          :disabled="desktopAuth?.showAuthModal.value"
          @click="desktopAuth?.signIn()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
          <span v-if="!collapsed">{{ desktopAuth?.showAuthModal.value ? $t('common.buttons.signing_in') : $t('common.buttons.sign_in') }}</span>
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
          <NuxtLink to="/settings" class="sidebar-user-link" :title="collapsed ? `${userName} — Settings` : undefined">
            <div class="user-avatar">
              <img v-if="userImage" :src="userImage" :alt="userName" class="user-avatar-img" referrerpolicy="no-referrer">
              <span v-else class="user-initials">{{ userInitials }}</span>
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
            :aria-label="isLightSidebar ? $t('common.theme.to_dark') : $t('common.theme.to_light')"
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
            <span>{{ $t('common.buttons.sign_out') }}</span>
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
  background: var(--nc-accent);
  z-index: 9999;
  pointer-events: none;
}

/* Flat --nc-bg plane + THE hairline right border (REDESIGN.md §5).
   No local --sb-* palette — tokens are the single source of truth. */
.sidebar {
  display: flex;
  flex-direction: column;
  width: 240px;
  height: 100vh;
  flex-shrink: 0;
  padding: 20px 16px;
  background: var(--nc-bg);
  border-right: 1px solid var(--nc-border-subtle);
  position: sticky;
  top: 0;
  transition: width var(--nc-duration-normal) var(--nc-ease);
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
  font-family: var(--nc-font-display);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--nc-text);
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
  border-radius: var(--nc-radius-sm);
  /* Interactive rest ≥ the 0.62 tier (WCAG 1.4.11 — AER-76 icon visibility) */
  color: var(--nc-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.collapse-btn:active,
.expand-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .collapse-btn:hover,
  .expand-btn:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

.expand-btn {
  margin-bottom: 16px;
}

.collapse-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
}

/* Search — input grammar: chip fill + hairline, focus/hover = border only */
.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 20px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: var(--nc-radius-md);
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sidebar-search:hover {
    border-color: var(--nc-border-active);
  }

  /* Light: --nc-border-active (0.28 ink) is weaker than the form boundary
     (0.48) — hover must not fade the border below its rest state. */
  :root.light .sidebar-search:hover {
    border-color: var(--nc-text-secondary);
  }
}

.collapsed-search {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 36px;
  margin-bottom: 20px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  color: var(--nc-text-secondary);
  font-size: calc(14px * var(--nc-text-scale, 1));
  cursor: pointer;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .collapsed-search:hover {
    color: var(--nc-text);
    border-color: var(--nc-border-active);
  }
}

.search-icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  min-width: 0;
  cursor: pointer;
}

.search-input::placeholder {
  color: var(--nc-text-dim);
}

/* kbd hint — mono chip (REDESIGN.md §4) */
.search-kbd {
  margin-left: auto;
  padding: 2px 6px;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-muted);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.35rem;
  flex-shrink: 0;
}

/* Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  min-height: 40px;
  border-radius: var(--nc-radius-sm);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  text-decoration: none;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
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

@media (hover: hover) and (pointer: fine) {
  .nav-item:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
  }
}

/* Active — accent text + 2px marker edge, never color alone (REDESIGN.md §5) */
.nav-item.active {
  background: var(--nc-chip-bg);
  color: var(--nc-accent);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--nc-accent);
}

.collapsed .nav-item.active::before {
  top: 6px;
  bottom: 6px;
}

.nav-icon {
  font-size: calc(16px * var(--nc-text-scale, 1));
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
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-sm);
}

.theme-opt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 6px 4px;
  border-radius: 0.35rem;
  border: none;
  background: none;
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .theme-opt:hover {
    color: var(--nc-text);
  }
}

.theme-opt.active {
  background: var(--nc-surface-2);
  color: var(--nc-accent);
}

.theme-label {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
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
  border-top: 1px solid var(--nc-border-subtle);
  cursor: pointer;
  border-radius: var(--nc-radius-sm);
  transition: background-color var(--nc-duration-fast) var(--nc-ease);
}

.collapsed .sidebar-user {
  justify-content: center;
  padding: 12px 8px;
}

@media (hover: hover) and (pointer: fine) {
  .sidebar-user:hover {
    background: var(--nc-surface-3);
  }
}

.user-avatar {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* Circular avatar so a Google profile photo with dark edges doesn't
     read as a hard black square against the sidebar plane. The thin
     ring keeps the edge visible even when the image background
     matches the sidebar. */
  border-radius: 50%;
  background: var(--nc-accent);
  box-shadow: inset 0 0 0 1px rgba(var(--nc-bg-rgb), 0.08);
  overflow: hidden;
}

/* Selection grammar: accent fill carries bg-colored ink (REDESIGN.md §1) */
.user-initials {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  line-height: 16px;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text);
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-email {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text-muted);
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chevron {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
  flex-shrink: 0;
  transition: transform var(--nc-duration-normal) var(--nc-ease);
}

/* Guest engagement ladder */
.guest-ladder {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 14px 0;
  font-family: var(--nc-font-body);
}

.guest-ladder.is-collapsed {
  padding: 14px 8px 0;
}

.ladder-eyebrow-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

/* Mono micro-labels (REDESIGN.md §4) */
.ladder-eyebrow {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

.ladder-count {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-accent);
}

.ladder-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ladder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
}

.ladder-item.is-next {
  color: var(--nc-accent);
}

.ladder-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.35rem;
  color: var(--nc-text-muted);
  flex-shrink: 0;
}

.ladder-icon--ai {
  background: rgba(var(--nc-accent-rgb), 0.06);
  border-color: rgba(var(--nc-accent-rgb), 0.22);
  color: var(--nc-accent);
}

.ladder-label {
  flex: 1;
  font-weight: 500;
}

.ladder-arrow {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Save CTA — flat surface card, hairline shifts on hover (no glow) */
.ladder-cta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--nc-surface-2);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.22);
  border-radius: var(--nc-radius-md);
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .ladder-cta:hover {
    border-color: rgba(var(--nc-accent-rgb), 0.4);
  }
}

.ladder-cta:active {
  transform: scale(0.97);
}

.is-collapsed .ladder-cta {
  padding: 8px;
  align-items: center;
  justify-content: center;
}

.ladder-cta-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
}

.ladder-cta-title {
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  line-height: 1.3;
}

.ladder-cta-desc {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.4;
}

/* Ink-pill visual per primary button grammar (REDESIGN.md §5) */
.ladder-cta-btn {
  margin-top: 4px;
  padding: 8px 12px;
  background: var(--nc-text);
  border-radius: 2.4rem;
  color: var(--nc-bg);
  font-family: var(--nc-font-display);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 700;
  text-align: center;
  transition: background-color var(--nc-duration-fast) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .ladder-cta:hover .ladder-cta-btn {
    background: var(--nc-accent);
  }
}

.ladder-cta-collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 28px;
  background: var(--nc-text);
  color: var(--nc-bg);
  border-radius: 2.4rem;
}

.sidebar-user-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.collapsed .sidebar-user-row {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  width: 100%;
}

.collapsed .sidebar-user-link {
  flex: none;
  justify-content: center;
  padding: 4px;
}

.collapsed .sidebar-theme-btn {
  width: 100%;
  height: 32px;
  align-self: stretch;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  display: block;
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
  border-radius: var(--nc-radius-md);
  transition: background-color var(--nc-duration-fast) var(--nc-ease);
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .sidebar-user-link:hover {
    background: var(--nc-surface-3);
  }
}

.sidebar-theme-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--nc-radius-sm);
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--nc-text-secondary);
  flex-shrink: 0;
  transition: color var(--nc-duration-fast) var(--nc-ease),
              background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.sidebar-theme-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .sidebar-theme-btn:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
  }
}

/* User section wrapper */
.user-section {
  position: relative;
}

/* Sign In button (desktop local mode) — accent = interactive/hot */
.signin-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  border: 1px solid rgba(var(--nc-accent-rgb), 0.22);
  background: var(--nc-chip-bg);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-accent);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              border-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
  text-decoration: none;
}

.signin-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .signin-btn:hover {
    background: rgba(var(--nc-accent-rgb), 0.08);
    border-color: rgba(var(--nc-accent-rgb), 0.4);
  }
}

/* Sign Out button — coral = destructive-confirm accent (REDESIGN.md §1) */
.signout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  border: none;
  background: rgba(var(--nc-coral-rgb), 0.06);
  border-radius: var(--nc-radius-sm);
  color: var(--nc-coral);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.signout-btn:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .signout-btn:hover {
    background: rgba(var(--nc-coral-rgb), 0.12);
  }
}

/* Sign out transition */
.signout-enter-active {
  transition: opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-fast) var(--nc-ease),
              max-height var(--nc-duration-fast) var(--nc-ease),
              margin-top var(--nc-duration-fast) var(--nc-ease),
              padding-top var(--nc-duration-fast) var(--nc-ease),
              padding-bottom var(--nc-duration-fast) var(--nc-ease);
}

.signout-leave-active {
  transition: opacity var(--nc-duration-instant) var(--nc-ease),
              transform var(--nc-duration-instant) var(--nc-ease),
              max-height var(--nc-duration-instant) var(--nc-ease),
              margin-top var(--nc-duration-instant) var(--nc-ease),
              padding-top var(--nc-duration-instant) var(--nc-ease),
              padding-bottom var(--nc-duration-instant) var(--nc-ease);
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

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */

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
    font-size: calc(15px * var(--nc-text-scale, 1));
  }
}

/* Mobile: hide desktop sidebar entirely — Paper design has no sidebar on mobile */
@media (max-width: 768px) {
  .sidebar { display: none !important; }
}
</style>
