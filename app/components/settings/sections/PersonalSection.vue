<script setup lang="ts">
import { useUserStore } from '~/stores/userStore'
import { safeImageUrl } from '~/utils/safeUrl'
import { resolveAvatarInitials, resolveDisplayName, resolveDisplayEmail, isHiddenAppleUser } from '~/utils/userDisplay'

const { data: _sessionData, getSession } = useAuth()
const session = _sessionData ?? ref(null)
const userStore = useUserStore()
const { locale, setLocale, locales } = useI18n()
const { t } = useI18n()
const flashSaved = inject<() => void>('flashSaved', () => {})

const user = computed(() => session.value?.user)
const avatarSrc = computed(() => safeImageUrl(user.value?.image))
const userInitial = computed(() => resolveAvatarInitials(user.value))
const profileDisplayName = computed(() => resolveDisplayName(user.value, 'User'))
const profileEmail = computed(() => resolveDisplayEmail(user.value))
const isHidden = computed(() => isHiddenAppleUser(user.value))

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
  if (code !== 'en' && code !== 'hr') return
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
    // Re-pull the session so the new name/avatar lands in the JWT-backed
    // session and shows everywhere (sidebar, greeting) without a re-login.
    if ((field === 'name' || field === 'image') && typeof getSession === 'function') {
      try { await getSession() } catch { /* non-fatal — eventual refresh still applies */ }
    }
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
              v-if="avatarSrc"
              :src="avatarSrc"
              :alt="profileDisplayName"
              class="avatar-img"
              referrerpolicy="no-referrer"
            >
            <span v-else class="avatar-letter">{{ userInitial }}</span>
          </div>
          <div class="profile-info">
            <span class="profile-name">{{ profileDisplayName }}</span>
            <span class="profile-email">{{ profileEmail }}</span>
            <span v-if="isHidden" class="profile-hidden-note">{{ t('mobile.settings.hiddenNoSync') }}</span>
          </div>
        </div>
        <button class="change-avatar-btn" @click="showAvatarInput = !showAvatarInput">
          {{ t('settings.personal.change_avatar') }}
        </button>
      </div>

      <!-- Avatar URL input (shown when Change avatar clicked) -->
      <div v-if="showAvatarInput" class="setting-row avatar-input-row">
        <div class="setting-info">
          <span class="setting-title">{{ t('settings.personal.avatar_url') }}</span>
          <span class="setting-desc">{{ t('settings.personal.avatar_url_desc') }}</span>
        </div>
        <div class="avatar-input-group">
          <input
            v-model="avatarUrl"
            type="url"
            class="setting-input"
            :placeholder="t('settings.personal.avatar_url_placeholder')"
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
            :placeholder="t('settings.personal.name_placeholder')"
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
          <span class="setting-desc">{{ t('settings.personal.bio_desc') }}</span>
        </div>
        <input
          v-model="bio"
          type="text"
          class="setting-input"
          maxlength="280"
          :placeholder="t('settings.personal.bio_placeholder')"
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

/* Section eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.section-label {
  font-family: var(--nc-font-mono);
  font-size: calc(0.68rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  line-height: 14px;
  color: var(--nc-text-secondary);
  padding-bottom: 4px;
}

/* Setting Row — flat surface + THE hairline (REDESIGN.md §5) */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-title {
  font-family: var(--nc-font-body);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-weight: 500;
  line-height: 18px;
  color: var(--nc-text);
}

.setting-desc {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: var(--nc-text-secondary);
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
  /* Circular so dark Google profile photos don't read as black tiles on
     light surfaces. Inset ring keeps the edge visible even when the
     image's own background matches the surrounding panel. */
  border-radius: 50%;
  background: rgba(var(--nc-accent-rgb), 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(var(--nc-bg-rgb), 0.08);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-letter {
  font-family: var(--nc-font-body);
  font-size: calc(22px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-accent);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.profile-name {
  font-family: var(--nc-font-body);
  font-size: calc(16px * var(--nc-text-scale, 1));
  font-weight: 600;
  line-height: 20px;
  color: var(--nc-text);
}

.profile-email {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  line-height: 16px;
  color: var(--nc-text-secondary);
}

/* Attention note — coral is the attention/live-marker color (REDESIGN.md §1) */
.profile-hidden-note {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 15px;
  color: var(--nc-coral);
  margin-top: 4px;
}

/* Ghost action grammar — mono uppercase chip, hover brightens to accent
   (REDESIGN.md §5) */
.change-avatar-btn {
  font-family: var(--nc-font-mono);
  font-size: calc(0.72rem * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nc-text-secondary);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.4rem;
  padding: 8px 14px;
  cursor: pointer;
  transition: border-color var(--nc-duration-fast) var(--nc-ease),
              color var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.change-avatar-btn:active { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .change-avatar-btn:hover {
    border-color: var(--nc-border-active);
    color: var(--nc-accent);
  }
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

/* Save — primary ink pill (REDESIGN.md §5) */
.avatar-save-btn {
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-bg);
  background: var(--nc-text);
  border: none;
  border-radius: 2.4rem;
  padding: 8px 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--nc-duration-fast) var(--nc-ease),
              opacity var(--nc-duration-fast) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.avatar-save-btn:active:not(:disabled) { transform: scale(0.97); }

@media (hover: hover) and (pointer: fine) {
  .avatar-save-btn:hover:not(:disabled) {
    background: var(--nc-accent);
    transform: translateY(-1px);
  }
}

.avatar-save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

/* Input */
.input-group {
  position: relative;
  display: flex;
  align-items: center;
}

/* Input grammar — chip fill, hairline, focus = border-color only
   (REDESIGN.md §5) */
.setting-input {
  width: 200px;
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  padding: 8px 12px;
  outline: none;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.setting-input:focus {
  border-color: var(--nc-accent);
}

.setting-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.setting-input::placeholder {
  color: var(--nc-text-dim);
}

/* Saved check — success carries accent (REDESIGN.md §1) */
.save-indicator {
  position: absolute;
  right: 10px;
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-accent);
}

.save-indicator.saving {
  color: var(--nc-accent);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Select — input grammar: chip fill + hairline, focus = border-color only
   (REDESIGN.md §5). Chevron is an encoded icon asset. */
.setting-select {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 400;
  color: var(--nc-text);
  background-color: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: var(--nc-radius-md);
  padding: 8px 32px 8px 12px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23555560' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color var(--nc-duration-fast) var(--nc-ease);
}

.setting-select:focus {
  border-color: var(--nc-accent);
}

/* Toggle Switch — hairline track, accent fill when on, ink thumb; no glow
   (REDESIGN.md §5 / ui/NcSwitch) */
.toggle-switch {
  width: 44px;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 2.4rem;
  border: 1px solid var(--nc-border);
  background: var(--nc-chip-bg);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--nc-duration-normal) var(--nc-ease),
              border-color var(--nc-duration-normal) var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
}

.toggle-switch:active { transform: scale(0.97); }

.toggle-switch.on {
  background: var(--nc-accent);
  border-color: var(--nc-accent);
  justify-content: flex-end;
}

.toggle-knob {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--nc-text);
  flex-shrink: 0;
  transition: background-color var(--nc-duration-normal) var(--nc-ease);
}

.toggle-switch.on .toggle-knob {
  background: var(--nc-bg);
}

/* Error banner — coral (REDESIGN.md §1) */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.2);
  border-radius: var(--nc-radius-md);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  color: var(--nc-coral);
}

/* Light theme is fully token-driven — tokens.css rebases every --nc-* var
   under :root.light, so no per-component palette overrides are needed. */
</style>
