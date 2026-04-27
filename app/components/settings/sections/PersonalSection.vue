<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'

const { data: _sessionData } = useAuth()
const session = _sessionData ?? ref(null)
const userStore = useUserStore()
const { locale, setLocale, locales } = useI18n()
const { t } = useI18n()
const flashSaved = inject<() => void>('flashSaved', () => {})

const user = computed(() => session.value?.user)
const userInitial = computed(() => {
  const name = user.value?.name
  return name ? name.charAt(0).toUpperCase() : 'U'
})

// Profile editing state
const displayName = ref('')
const bio = ref('')
const avatarUrl = ref('')
const showAvatarInput = ref(false)
const isSaving = ref(false)
const saveSuccess = ref(false)
const saveError = ref<string | null>(null)

// Load profile from server
const userProfile = ref<{ bio?: string; image?: string } | null>(null)

onMounted(async () => {
  try {
    const profile = await $fetch<{ name?: string; bio?: string; image?: string }>('/api/user/profile')
    userProfile.value = profile
    if (profile.name) displayName.value = profile.name
    if (profile.bio) bio.value = profile.bio
  } catch {
    // Fall back to session data
  }
})

// Fall back to session name if profile didn't load
watchEffect(() => {
  if (!displayName.value && user.value?.name) {
    displayName.value = user.value.name
  }
})

// Language — wired to @nuxtjs/i18n
const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map(l => ({
    value: l.code,
    label: l.name
  }))
)

async function changeLocale(code: string) {
  await setLocale(code)
  userStore.setPreference('language', code)
  // Also persist in localStorage for Tauri/Capacitor
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('i18n_locale', code)
  }
  flashSaved()
}

// Save profile field
async function saveProfile(field: 'name' | 'bio' | 'image', value: string) {
  const trimmed = value.trim()
  isSaving.value = true
  saveError.value = null
  saveSuccess.value = false

  try {
    await $fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { [field]: trimmed || null }
    })
    saveSuccess.value = true
    flashSaved()
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    saveError.value = err?.data?.statusMessage || 'Failed to update profile'
  } finally {
    isSaving.value = false
  }
}

function saveDisplayName() {
  const trimmed = displayName.value.trim()
  if (!trimmed || trimmed === user.value?.name) return
  saveProfile('name', trimmed)
}

function saveBio() {
  const trimmed = bio.value.trim()
  if (trimmed === (userProfile.value?.bio || '')) return
  saveProfile('bio', trimmed)
}

function saveAvatar() {
  const url = avatarUrl.value.trim()
  if (!url) return
  if (!url.startsWith('https://')) {
    saveError.value = 'Avatar URL must use HTTPS'
    return
  }
  saveProfile('image', url)
  showAvatarInput.value = false
}
</script>

<template>
  <div class="tab-content">
    <!-- PROFILE Section -->
    <div class="settings-section">
      <span class="section-label">01 — {{ t('settings.personal.profile').toLowerCase() }}</span>

      <!-- Avatar + Name + Email row -->
      <div class="setting-row profile-row">
        <div class="profile-left">
          <div class="profile-avatar">
            <img
              v-if="user?.image"
              :src="user.image"
              :alt="user?.name || 'Profile'"
              class="avatar-img"
            >
            <span v-else class="avatar-letter">{{ userInitial }}</span>
          </div>
          <div class="profile-info">
            <span class="profile-name">{{ user?.name || 'User' }}</span>
            <span class="profile-email">{{ user?.email || '' }}</span>
          </div>
        </div>
        <button class="change-avatar-btn" @click="showAvatarInput = !showAvatarInput">
          {{ t('settings.personal.change_avatar') }}
        </button>
      </div>

      <!-- Avatar URL input (shown when Change avatar clicked) -->
      <div v-if="showAvatarInput" class="setting-row avatar-input-row">
        <div class="setting-info">
          <span class="setting-title">Avatar URL</span>
          <span class="setting-desc">Paste an HTTPS image URL</span>
        </div>
        <div class="avatar-input-group">
          <input
            v-model="avatarUrl"
            type="url"
            class="setting-input"
            placeholder="https://example.com/photo.jpg"
            @keydown.enter="saveAvatar"
          >
          <button class="avatar-save-btn" :disabled="!avatarUrl.trim()" @click="saveAvatar">Save</button>
        </div>
      </div>

      <!-- Display Name -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.personal.display_name') }}</span>
          <span class="setting-desc">{{ locale === 'hr' ? 'Kako se vaše ime prikazuje drugima' : 'How your name appears to others' }}</span>
        </div>
        <div class="input-group">
          <input
            v-model="displayName"
            type="text"
            class="setting-input"
            maxlength="100"
            placeholder="Your name"
            @blur="saveDisplayName"
            @keydown.enter="($event.target as HTMLInputElement)?.blur()"
          >
          <span v-if="saveSuccess" class="save-indicator i-lucide-check" />
          <span v-if="isSaving" class="save-indicator saving i-lucide-loader-2" />
        </div>
      </div>

      <!-- Bio -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.personal.bio') }}</span>
          <span class="setting-desc">{{ locale === 'hr' ? 'Kratki opis o sebi' : 'A short description about yourself' }}</span>
        </div>
        <input
          v-model="bio"
          type="text"
          class="setting-input"
          maxlength="280"
          placeholder="Tell us about yourself"
          @blur="saveBio"
          @keydown.enter="($event.target as HTMLInputElement)?.blur()"
        >
      </div>

      <!-- Save error -->
      <div v-if="saveError" class="error-banner">
        <span class="i-lucide-alert-circle" />
        {{ saveError }}
      </div>
    </div>

    <!-- PREFERENCES Section -->
    <div class="settings-section">
      <span class="section-label">02 — {{ t('settings.personal.preferences').toLowerCase() }}</span>

      <!-- Language / Jezik -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.personal.language') }}</span>
          <span class="setting-desc">Jezik / Language</span>
        </div>
        <select
          :value="locale"
          class="setting-select"
          @change="changeLocale(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="loc in availableLocales" :key="loc.value" :value="loc.value">
            {{ loc.label }}
          </option>
        </select>
      </div>

      <!-- Email Notifications -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.personal.email_notifications') }}</span>
          <span class="setting-desc">{{ locale === 'hr' ? 'Primajte obavijesti o novim značajkama i savjetima' : 'Receive updates about new features and tips' }}</span>
        </div>
        <button
          :class="['toggle-switch', { on: userStore.preferences.value.emailNotifications }]"
          @click="userStore.setPreference('emailNotifications', !userStore.preferences.value.emailNotifications)"
        >
          <span class="toggle-knob" />
        </button>
      </div>

      <!-- Usage Analytics -->
      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.personal.usage_analytics') }}</span>
          <span class="setting-desc">{{ locale === 'hr' ? 'Pomozite poboljšati NeuroCanvas dijeljenjem anonimnih podataka o korištenju' : 'Help improve NeuroCanvas by sharing anonymous usage data' }}</span>
        </div>
        <button
          :class="['toggle-switch', { on: userStore.preferences.value.usageAnalytics }]"
          @click="userStore.setPreference('usageAnalytics', !userStore.preferences.value.usageAnalytics)"
        >
          <span class="toggle-knob" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0.06em;
  line-height: 14px;
  color: var(--s-muted, #52525B);
  padding-bottom: 4px;
}

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

/* Profile row */
.profile-row {
  padding: 20px;
}

.profile-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: rgba(0, 210, 190, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-letter {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #00D2BE;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.profile-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
  color: var(--s-text, #FAFAFA);
}

.profile-email {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  line-height: 16px;
  color: var(--s-muted, #555560);
}

.change-avatar-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--s-text, #FAFAFA);
  background: none;
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.change-avatar-btn:hover {
  border-color: var(--s-accent, #00D2BE);
  color: var(--s-accent, #00D2BE);
}

.avatar-input-row {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.avatar-input-group {
  display: flex;
  gap: 8px;
}

.avatar-input-group .setting-input {
  flex: 1;
  width: auto;
}

.avatar-save-btn {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #09090B;
  background: var(--s-accent, #00D2BE);
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.avatar-save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Input */
.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.setting-input {
  width: 200px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--s-text, #FAFAFA);
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.15s;
}

.setting-input:focus {
  border-color: var(--s-accent, #00D2BE);
}

.setting-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.setting-input::placeholder {
  color: var(--s-muted, #555560);
}

.save-indicator {
  position: absolute;
  right: 10px;
  font-size: 14px;
  color: #22C55E;
}

.save-indicator.saving {
  color: var(--s-accent, #00D2BE);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Select */
.setting-select {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 400;
  color: var(--s-text, #FAFAFA);
  background: var(--s-surface, #0D0D10);
  border: 1px solid var(--s-border, #1A1A1E);
  border-radius: 6px;
  padding: 8px 32px 8px 12px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23555560' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s;
}

.setting-select:focus {
  border-color: var(--s-accent, #00D2BE);
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

/* Error banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  color: #EF4444;
}

/* Light theme */
:root.light .setting-input,
:root.light .setting-select {
  background: #FFFFFF;
  border-color: #E8E8E6;
  color: #111111;
}

:root.light .setting-input::placeholder {
  color: #777777;
}
</style>
