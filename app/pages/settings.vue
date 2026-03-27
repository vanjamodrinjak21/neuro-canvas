<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { useAISettings } from '~/composables/useAISettings'

definePageMeta({
  layout: false
})

useHead({
  title: 'Settings - NeuroCanvas'
})

const router = useRouter()
const userStore = useUserStore()
const aiSettings = useAISettings()

// Auth (for mobile account card + sign out)
const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)
const { handleSignOut: authSignOut, isLoading: signOutLoading } = useAuthStore()

const user = computed(() => session.value?.user)
const userInitial = computed(() => {
  const name = user.value?.name
  return name ? name.charAt(0).toUpperCase() : 'U'
})

onMounted(async () => {
  await aiSettings.initialize()
  await loadProviderKeyStatus()
})

// ─── Desktop: Tabs ────────────────────────────────────────────────
const activeTab = ref('general')
const tabs = [
  { id: 'general', label: 'General' },
  { id: 'ai-providers', label: 'AI Providers' },
  { id: 'personas', label: 'Personas' },
  { id: 'account', label: 'Account' }
]

// Theme
const themeOptions = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
]

// Font size
const fontSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
]

function handleResetPreferences() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    userStore.resetPreferences()
  }
}

function handleOpenTemplates() {
  router.push('/dashboard')
}

function handleAccountClose() {
  router.push('/')
}

// ─── Mobile: Provider key status ──────────────────────────────────
const providerKeyStatus = ref<Map<string, boolean>>(new Map())

async function loadProviderKeyStatus() {
  for (const provider of aiSettings.providers.value) {
    const hasKey = await aiSettings.hasProviderApiKey(provider.id)
    providerKeyStatus.value.set(provider.id, hasKey)
  }
}

watch(() => aiSettings.providers.value, loadProviderKeyStatus)

// ─── Mobile: Computed labels ──────────────────────────────────────
const themeLabel = computed(() => {
  const map: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }
  return map[userStore.preferences.value.theme] || 'Dark'
})

const fontSizeLabel = computed(() => {
  const map: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large' }
  return map[userStore.preferences.value.fontSize] || 'Medium'
})

// ─── Mobile: Actions ──────────────────────────────────────────────
function cycleTheme() {
  const order = ['light', 'dark', 'system'] as const
  const current = userStore.preferences.value.theme
  const idx = order.indexOf(current as typeof order[number])
  const next = order[(idx + 1) % order.length]
  userStore.setPreference('theme', next as any)
}

function cycleFontSize() {
  const order = ['small', 'medium', 'large'] as const
  const current = userStore.preferences.value.fontSize
  const idx = order.indexOf(current as typeof order[number])
  const next = order[(idx + 1) % order.length]
  userStore.setPreference('fontSize', next as any)
}

async function handleMobileSignOut() {
  await aiSettings.clearAllSecrets()
  await authSignOut()
}
</script>

<template>
  <div class="settings-page">
  <!-- ═══ MOBILE SETTINGS (≤768px) ═══ -->
  <div class="m-settings">
    <div class="m-scroll">
      <!-- Header -->
      <div class="m-header">
        <h1 class="m-title">Settings</h1>
      </div>

      <!-- Account Card -->
      <div class="m-account">
        <div class="m-avatar">
          <img
            v-if="user?.image"
            :src="user.image"
            :alt="user?.name || 'Profile'"
            class="m-avatar-img"
          >
          <span v-else class="m-avatar-letter">{{ userInitial }}</span>
        </div>
        <div class="m-account-info">
          <span class="m-account-name">{{ user?.name || 'User' }}</span>
          <span class="m-account-email">{{ user?.email || '' }}</span>
        </div>
        <span class="m-chevron i-lucide-chevron-right" />
      </div>

      <!-- PREFERENCES -->
      <div class="m-label">Preferences</div>
      <div class="m-group">
        <button class="m-row" @click="cycleTheme">
          <div class="m-row-left">
            <span class="m-row-icon i-lucide-moon" />
            <span class="m-row-text">Theme</span>
          </div>
          <div class="m-row-right">
            <span class="m-row-value">{{ themeLabel }}</span>
            <span class="m-row-chevron i-lucide-chevron-right" />
          </div>
        </button>

        <button class="m-row" @click="cycleFontSize">
          <div class="m-row-left">
            <span class="m-row-icon i-lucide-type" />
            <span class="m-row-text">Font Size</span>
          </div>
          <div class="m-row-right">
            <span class="m-row-value">{{ fontSizeLabel }}</span>
            <span class="m-row-chevron i-lucide-chevron-right" />
          </div>
        </button>

        <div class="m-row m-row--last">
          <div class="m-row-left">
            <span class="m-row-icon i-lucide-save" />
            <span class="m-row-text">Auto-save</span>
          </div>
          <button
            class="m-toggle"
            :class="{ on: userStore.preferences.value.autoSave }"
            @click="userStore.setPreference('autoSave', !userStore.preferences.value.autoSave)"
          >
            <span class="m-toggle-knob" />
          </button>
        </div>
      </div>

      <!-- AI PROVIDERS -->
      <div class="m-label">AI Providers</div>
      <div class="m-group">
        <template v-if="aiSettings.providers.value.length > 0">
          <div
            v-for="(provider, idx) in aiSettings.providers.value"
            :key="provider.id"
            :class="['m-row', { 'm-row--last': idx === aiSettings.providers.value.length - 1 }]"
          >
            <div class="m-row-left">
              <span class="m-row-icon i-lucide-lock" />
              <span class="m-row-text">{{ provider.name }}</span>
            </div>
            <div v-if="providerKeyStatus.get(provider.id)" class="m-row-right m-connected">
              <span class="m-dot" />
              <span class="m-connected-text">Connected</span>
            </div>
            <div v-else class="m-row-right">
              <span class="m-row-value">Add key</span>
              <span class="m-row-chevron i-lucide-chevron-right" />
            </div>
          </div>
        </template>
        <div v-else class="m-row m-row--last m-empty-providers">
          <span class="m-empty-text">No providers configured</span>
        </div>
      </div>

      <!-- Sign Out -->
      <button
        class="m-signout"
        :disabled="signOutLoading"
        @click="handleMobileSignOut"
      >
        {{ signOutLoading ? 'Signing out...' : 'Sign Out' }}
      </button>
    </div>
  </div>

  <!-- ═══ DESKTOP SETTINGS (>768px) ═══ -->
  <div class="settings-layout">
    <AppSidebar
      active-nav="settings"
      @open-templates="handleOpenTemplates"
    />

    <main class="settings-main">
      <!-- Header -->
      <div class="settings-header">
        <h1 class="settings-title">Settings</h1>
        <p class="settings-subtitle">Manage your preferences and account</p>
      </div>

      <!-- Tabs -->
      <div class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-item', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <Transition name="nc-crossfade" mode="out-in">
      <!-- General Tab -->
      <div v-if="activeTab === 'general'" key="general" class="tab-content">
        <!-- APPEARANCE Section -->
        <div class="settings-section">
          <span class="section-label">Appearance</span>

          <!-- Theme Row -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Theme</span>
              <span class="setting-desc">Choose your preferred appearance</span>
            </div>
            <div class="segmented-control">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                :class="['segment', { active: userStore.preferences.value.theme === option.value }]"
                @click="userStore.setPreference('theme', option.value as any)"
              >
                <span :class="['segment-icon', option.icon]" />
                <span class="segment-label">{{ option.label }}</span>
              </button>
            </div>
          </div>

          <!-- Font Size Row -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Font Size</span>
              <span class="setting-desc">Adjust text size across the app</span>
              <span
                class="font-preview"
                :style="{
                  fontSize: userStore.preferences.value.fontSize === 'small' ? '12px' : userStore.preferences.value.fontSize === 'large' ? '18px' : '15px'
                }"
              >
                The quick brown fox
              </span>
            </div>
            <div class="segmented-control">
              <button
                v-for="option in fontSizeOptions"
                :key="option.value"
                :class="['segment', { active: userStore.preferences.value.fontSize === option.value }]"
                @click="userStore.setPreference('fontSize', option.value as any)"
              >
                <span class="segment-label">{{ option.label }}</span>
              </button>
            </div>
          </div>

          <!-- Reduced Motion Row -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Reduced Motion</span>
              <span class="setting-desc">Minimize animations for accessibility</span>
            </div>
            <button
              :class="['toggle-switch', { on: userStore.preferences.value.reducedMotion }]"
              @click="userStore.setPreference('reducedMotion', !userStore.preferences.value.reducedMotion)"
            >
              <span class="toggle-knob" />
            </button>
          </div>
        </div>

        <!-- CANVAS Section -->
        <div class="settings-section">
          <span class="section-label">Canvas</span>

          <!-- Show Grid Row -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Show Grid</span>
              <span class="setting-desc">Display background grid on canvas</span>
            </div>
            <button
              :class="['toggle-switch', { on: userStore.preferences.value.showGrid }]"
              @click="userStore.setPreference('showGrid', !userStore.preferences.value.showGrid)"
            >
              <span class="toggle-knob" />
            </button>
          </div>

          <!-- Show Minimap Row -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Show Minimap</span>
              <span class="setting-desc">Display navigation minimap</span>
            </div>
            <button
              :class="['toggle-switch', { on: userStore.preferences.value.showMinimap }]"
              @click="userStore.setPreference('showMinimap', !userStore.preferences.value.showMinimap)"
            >
              <span class="toggle-knob" />
            </button>
          </div>

          <!-- Auto-save Row -->
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Auto-save</span>
              <span class="setting-desc">Automatically save your work every {{ userStore.preferences.value.autoSaveInterval / 1000 }}s</span>
            </div>
            <button
              :class="['toggle-switch', { on: userStore.preferences.value.autoSave }]"
              @click="userStore.setPreference('autoSave', !userStore.preferences.value.autoSave)"
            >
              <span class="toggle-knob" />
            </button>
          </div>
        </div>

        <!-- About Section -->
        <div class="settings-section">
          <span class="section-label">About</span>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Version</span>
              <span class="setting-desc">NeuroCanvas v1.0.0</span>
            </div>
            <span class="setting-value">Nuxt 4 + Tauri 2</span>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Author</span>
              <span class="setting-desc">Vanja Modrinjak</span>
            </div>
            <button class="reset-btn" @click="handleResetPreferences">
              Reset to defaults
            </button>
          </div>
        </div>
      </div>

      <!-- AI Providers Tab -->
      <div v-else-if="activeTab === 'ai-providers'" key="ai-providers" class="tab-content">
        <SettingsSectionsAIProvidersSection />
      </div>

      <!-- Personas Tab -->
      <div v-else-if="activeTab === 'personas'" key="personas" class="tab-content">
        <SettingsSectionsPersonasSection />
      </div>

      <!-- Account Tab -->
      <div v-else-if="activeTab === 'account'" key="account" class="tab-content">
        <SettingsSectionsAccountSection @close="handleAccountClose" />
      </div>
      </Transition>
    </main>
  </div>

  <!-- Shared: Mobile Tab Bar -->
  <MobileTabBar />
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════
   MOBILE SETTINGS — matches Paper "Mobile Web — Settings" artboard
   ═══════════════════════════════════════════════════════════════════ */

.settings-page {
  min-height: 100vh;
  min-height: 100dvh;
}

.m-settings {
  display: none;
}

@media (max-width: 768px) {
  .m-settings {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--ms-bg);
  }

  .settings-layout {
    display: none !important;
  }
}

/* ── Variables ── */
.m-settings {
  --ms-bg: #0A0A0C;
  --ms-card: #111114;
  --ms-border: #1E1E22;
  --ms-text: #FAFAFA;
  --ms-muted: #888890;
  --ms-accent: #00D2BE;
  --ms-green: #4ADE80;
  --ms-red: #EF4444;
  --ms-toggle-off: #1E1E22;
  --ms-knob-off: #555560;
}

:root.light .m-settings {
  --ms-bg: #FAFAF9;
  --ms-card: #FFFFFF;
  --ms-border: #E8E8E6;
  --ms-text: #1A1A1A;
  --ms-muted: #666666;
  --ms-toggle-off: #D4D4D8;
  --ms-knob-off: #888890;
}

/* ── Scroll container ── */
.m-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-top: 48px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 100px);
}

/* ── Header ── */
.m-header {
  padding: 8px 24px 24px;
}

.m-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 30px;
  color: var(--ms-text);
  margin: 0;
}

/* ── Account Card ── */
.m-account {
  display: flex;
  align-items: center;
  margin: 0 24px 24px;
  padding: 16px;
  gap: 14px;
  border-radius: 10px;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}

.m-avatar {
  width: 48px;
  height: 48px;
  border-radius: 24px;
  background: rgba(0, 210, 190, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.m-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.m-avatar-letter {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 20px;
  font-weight: 700;
  line-height: 24px;
  color: var(--ms-accent);
}

.m-account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.m-account-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  color: var(--ms-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-account-email {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--ms-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-chevron {
  width: 16px;
  height: 16px;
  color: var(--ms-muted);
  flex-shrink: 0;
}

/* ── Section Label ── */
.m-label {
  padding: 0 24px;
  margin-bottom: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 16px;
  color: var(--ms-muted);
}

/* ── Group ── */
.m-group {
  margin: 0 24px 24px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--ms-card);
  border: 1px solid var(--ms-border);
}

/* ── Row ── */
.m-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px;
  border-bottom: 1px solid var(--ms-border);
  background: none;
  border-left: none;
  border-right: none;
  border-top: none;
  width: 100%;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

button.m-row {
  text-align: left;
}

.m-row--last {
  border-bottom: none;
}

.m-row-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.m-row-icon {
  width: 18px;
  height: 18px;
  color: var(--ms-muted);
  flex-shrink: 0;
}

.m-row-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ms-text);
}

.m-row-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.m-row-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: var(--ms-muted);
}

.m-row-chevron {
  width: 14px;
  height: 14px;
  color: var(--ms-muted);
  flex-shrink: 0;
}

/* ── Toggle ── */
.m-toggle {
  width: 44px;
  height: 26px;
  border-radius: 13px;
  border: none;
  padding: 2px;
  display: flex;
  align-items: center;
  background: var(--ms-toggle-off);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.m-toggle.on {
  background: var(--ms-accent);
  justify-content: flex-end;
}

.m-toggle-knob {
  width: 22px;
  height: 22px;
  border-radius: 11px;
  background: var(--ms-knob-off);
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.m-toggle.on .m-toggle-knob {
  background: #FAFAFA;
}

/* ── Connected Status ── */
.m-connected {
  gap: 6px;
}

.m-dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: var(--ms-green);
  flex-shrink: 0;
}

.m-connected-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  color: var(--ms-green);
}

/* ── Empty Providers ── */
.m-empty-providers {
  justify-content: center;
  cursor: default;
}

.m-empty-text {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--ms-muted);
}

/* ── Sign Out ── */
.m-signout {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 8px 24px 0;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.25);
  background: none;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 18px;
  color: var(--ms-red);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s ease;
}

.m-signout:active {
  background: rgba(239, 68, 68, 0.08);
}

.m-signout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}


/* ═══════════════════════════════════════════════════════════════════
   DESKTOP SETTINGS
   ═══════════════════════════════════════════════════════════════════ */

/* Layout */
.settings-layout {
  display: flex;
  min-height: 100vh;
  background: var(--s-bg, #09090B);
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 32px 48px;
  gap: 32px;
  overflow-y: auto;
}

/* Header */
.settings-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 34px;
  color: var(--s-text, #FAFAFA);
}

.settings-subtitle {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 18px;
  color: var(--s-muted, #555560);
}

/* Tabs */
.settings-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--s-border, #1A1A1E);
}

.tab-item {
  padding: 12px 20px;
  min-height: 44px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: var(--s-tab-text, #555560);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-item:hover {
  color: var(--s-text, #FAFAFA);
}

.tab-item.active {
  color: var(--s-text, #FAFAFA);
  border-bottom-color: var(--s-accent, #00D2BE);
}

/* Tab Content */
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

/* Section */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 16px;
  color: var(--s-accent, #00D2BE);
  padding-bottom: 4px;
}

/* Setting Row */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 8px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 18px;
  color: var(--s-text, #FAFAFA);
}

.setting-desc {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--s-muted, #555560);
}

.font-preview {
  display: block;
  margin-top: 6px;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 400;
  color: var(--s-text, #FAFAFA);
  opacity: 0.6;
  transition: font-size 0.2s ease;
  line-height: 1.4;
}

.setting-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--s-muted, #555560);
}

/* Segmented Control */
.segmented-control {
  display: flex;
  border-radius: 6px;
  padding: 3px;
  gap: 4px;
  background: var(--s-seg-bg, #151518);
}

.segment {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  min-height: 36px;
  border-radius: 4px;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

@media (max-width: 768px) {
  .segment {
    min-height: 44px;
    padding: 10px 14px;
  }
}

.segment.active {
  background: var(--s-seg-active, #09090B);
}

.segment-icon {
  font-size: 14px;
  color: var(--s-muted, #555560);
  flex-shrink: 0;
}

.segment.active .segment-icon {
  color: var(--s-text, #FAFAFA);
}

.segment-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--s-muted, #555560);
}

.segment.active .segment-label {
  font-weight: 500;
  color: var(--s-text, #FAFAFA);
}

/* Toggle Switch */
.toggle-switch {
  width: 44px;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 12px;
  border: none;
  background: var(--s-toggle-off, #1A1A1E);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, justify-content 0.2s;
}

.toggle-switch.on {
  background: var(--s-accent, #00D2BE);
  justify-content: flex-end;
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--s-knob-off, #555560);
  flex-shrink: 0;
  transition: background 0.2s;
}

.toggle-switch.on .toggle-knob {
  background: var(--s-knob-on, #FAFAFA);
}

/* Reset Button */
.reset-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #EF4444;
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 14px;
  min-height: 44px;
  border-radius: 6px;
  transition: background 0.15s;
}

.reset-btn:hover {
  background: rgba(239, 68, 68, 0.08);
}

/* Light theme */
:root.light .settings-layout {
  --s-bg: #FAFAF9;
  --s-surface: #FFFFFF;
  --s-border: #E8E8E6;
  --s-text: #111111;
  --s-muted: #777777;
  --s-tab-text: #777777;
  --s-accent: #00D2BE;
  --s-seg-bg: #E8E8E6;
  --s-seg-active: #FFFFFF;
  --s-toggle-off: #D4D4D8;
  --s-knob-off: #777777;
  --s-knob-on: #FFFFFF;
}
</style>
