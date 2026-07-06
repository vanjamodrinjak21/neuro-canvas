<script setup lang="ts">
/**
 * Mobile Settings (Dark) — implementation of Paper artboards
 * GCX-0 (iOS) and GT1-0 (Android).
 */
import { safeImageUrl } from '~/utils/safeUrl'
import { resolveDisplayName, resolveDisplayEmail, isHiddenAppleUser } from '~/utils/userDisplay'
import NcAiMark from '~/components/ui/NcAiMark.vue'

const { t } = useI18n()

interface UserLike {
  name?: string | null
  email?: string | null
  image?: string | null
}

const props = defineProps<{
  user: UserLike | null | undefined
  userInitial: string
  isLocalUser: boolean
  connectedProvidersCount: number
  signOutLoading: boolean
}>()

const emit = defineEmits<{
  'open-account': []
  'open-general': []
  'open-ai-providers': []
  'open-personal': []
  'sign-out': []
  'sign-in': [provider: 'apple' | 'google' | 'github' | 'email']
}>()

const avatarSrc = computed(() => safeImageUrl(props.user?.image))
const displayName = computed(() => resolveDisplayName(props.user, t('mobile.settings.guestName')))
const displayEmail = computed(() => resolveDisplayEmail(props.user))
const isHidden = computed(() => isHiddenAppleUser(props.user))

// Sign in with Apple only on Apple devices (and it's required there by
// Guideline 4.8); GitHub is hidden on iOS in exchange.
const isApplePlatform = computed(() =>
  typeof window !== 'undefined'
  && (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === 'ios'
)
</script>

<template>
  <section class="mset" :aria-label="t('mobile.settings.ariaSettings')">
    <!-- Top bar -->
    <header class="mset-top">
      <div class="mset-brand" aria-label="NeuroCanvas">
        <NcLogo :size="14" :container-size="26" :radius="6" />
        <span class="mset-wordmark">Neuro<span class="mset-wordmark-em">Canvas</span></span>
      </div>
    </header>

    <!-- Editorial hero -->
    <div class="mset-hero">
      <span class="mset-eyebrow">04 — {{ t('mobile.settings.eyebrow') }}</span>
      <h1 class="mset-hero-line">
        <span class="mset-hero-sans">{{ t('mobile.settings.heroLineSans') }}</span>
        <span class="mset-hero-serif">{{ t('mobile.settings.heroLineSerif') }}</span>
      </h1>
      <span class="mset-hero-meta">{{ t('mobile.settings.heroMeta') }}</span>
    </div>

    <!-- Scrollable body -->
    <div class="mset-scroll">
      <!-- Sign-in panel (guest / local user) -->
      <div v-if="isLocalUser" class="mset-signin">
        <div class="mset-signin-head">
          <span class="mset-signin-eyebrow">{{ t('mobile.settings.signInEyebrow') }}</span>
          <span class="mset-signin-title">{{ t('mobile.settings.signInTitle') }}</span>
          <span class="mset-signin-sub">{{ t('mobile.settings.signInSub') }}</span>
        </div>
        <div class="mset-signin-grid">
          <button v-if="isApplePlatform" class="mset-signin-btn mset-signin-btn--apple" type="button" @click="emit('sign-in', 'apple')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.51 4.09l-.02-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span>{{ t('mobile.settings.continueApple') }}</span>
          </button>
          <button class="mset-signin-btn" type="button" @click="emit('sign-in', 'google')">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            <span>{{ t('mobile.settings.continueGoogle') }}</span>
          </button>
          <button v-if="!isApplePlatform" class="mset-signin-btn" type="button" @click="emit('sign-in', 'github')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.9-.39.98 0 1.97.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
            </svg>
            <span>{{ t('mobile.settings.continueGithub') }}</span>
          </button>
          <button class="mset-signin-btn" type="button" @click="emit('sign-in', 'email')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7L12 13L21 7" />
            </svg>
            <span>{{ t('mobile.settings.signInEmail') }}</span>
          </button>
        </div>
      </div>

      <!-- Profile card (signed in) -->
      <button v-else class="mset-profile" type="button" @click="emit('open-account')">
        <div class="mset-profile-avatar">
          <img v-if="avatarSrc" :src="avatarSrc" :alt="displayName" class="mset-profile-img" referrerpolicy="no-referrer">
          <span v-else>{{ userInitial }}</span>
        </div>
        <div class="mset-profile-info">
          <span class="mset-profile-name">{{ displayName }}</span>
          <span class="mset-profile-email">{{ displayEmail }}</span>
        </div>
        <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Apple Hide-My-Email accounts have no stable identity to sync against -->
      <p v-if="isHidden" class="mset-hidden-note">{{ t('mobile.settings.hiddenNoSync') }}</p>

      <!-- Section header -->
      <div class="mset-section">
        <span class="mset-section-label">{{ t('mobile.settings.sectionPreferences') }}</span>
      </div>

      <!-- Settings group -->
      <div class="mset-group">
        <button class="mset-row" type="button" @click="emit('open-general')">
          <div class="mset-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" />
            </svg>
          </div>
          <div class="mset-row-text">
            <span class="mset-row-title">{{ t('mobile.settings.rowGeneralTitle') }}</span>
            <span class="mset-row-hint">{{ t('mobile.settings.rowGeneralHint') }}</span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mset-divider" />

        <button class="mset-row" type="button" @click="emit('open-ai-providers')">
          <div class="mset-row-icon mset-row-icon--mint">
            <NcAiMark :size="18" />
          </div>
          <div class="mset-row-text mset-row-text--ai">
            <div class="mset-row-titlebar">
              <span class="mset-row-title">{{ t('mobile.settings.rowAiProvidersTitle') }}</span>
              <span v-if="connectedProvidersCount > 0" class="mset-badge">{{ connectedProvidersCount }}</span>
            </div>
            <span class="mset-row-hint">
              <template v-if="connectedProvidersCount > 0">{{ t('mobile.settings.rowAiProvidersConnected', { n: connectedProvidersCount }) }}</template>
              <template v-else>{{ t('mobile.settings.rowAiProvidersNone') }}</template>
            </span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mset-divider" />

        <button class="mset-row" type="button" @click="emit('open-personal')">
          <div class="mset-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" />
            </svg>
          </div>
          <div class="mset-row-text">
            <span class="mset-row-title">{{ t('mobile.settings.rowPersonalTitle') }}</span>
            <span class="mset-row-hint">{{ t('mobile.settings.rowPersonalHint') }}</span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mset-divider" />

        <button class="mset-row" type="button" @click="emit('open-account')">
          <div class="mset-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3L4 6V11C4 15.97 7.5 20.61 12 22C16.5 20.61 20 15.97 20 11V6L12 3Z" />
              <path d="M9 12L11 14L15 10" />
            </svg>
          </div>
          <div class="mset-row-text">
            <span class="mset-row-title">{{ t('mobile.settings.rowAccountTitle') }}</span>
            <span class="mset-row-hint">{{ t('mobile.settings.rowAccountHint') }}</span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <!-- Sign out (only when signed in) -->
      <button
        v-if="!isLocalUser"
        class="mset-signout"
        type="button"
        :disabled="signOutLoading"
        @click="emit('sign-out')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" />
          <path d="M16 17L21 12L16 7" />
          <path d="M21 12H9" />
        </svg>
        <span>{{ signOutLoading ? t('mobile.settings.signingOut') : t('mobile.settings.signOut') }}</span>
      </button>

      <!-- Footer mono -->
      <div class="mset-footer">
        <span class="mset-footer-line">v1.0.0 · pgvector RAG · MIT</span>
        <span class="mset-footer-line mset-footer-mute">{{ t('mobile.settings.madeBy', { name: 'Vanja Modrinjak' }) }}</span>
      </div>

      <!-- Spacer to clear dock -->
      <div class="mset-spacer" />
    </div>
  </section>
</template>

<style scoped>
.mset {
  --mset-bg: var(--nc-bg);
  --mset-ink: var(--nc-ink);
  --mset-body: var(--nc-ink-soft);
  --mset-mute: var(--nc-ink-faint);
  --mset-mint: var(--nc-accent);
  --mset-surface: var(--nc-chip-bg);
  --mset-stroke: var(--nc-border);
  --mset-stroke-soft: var(--nc-border-subtle);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mset-bg);
  color: var(--mset-ink);
  font-family: var(--nc-font-body);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

/* Top bar */
.mset-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.mset-brand { display: flex; align-items: center; gap: 10px; }
.mset-wordmark {
  font-family: var(--nc-font-serif);
  font-weight: 400;
  font-size: calc(19px * var(--nc-text-scale, 1));
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--mset-ink);
}
.mset-wordmark-em {
  font-style: italic;
  color: var(--mset-mint);
}

/* Hero */
.mset-hero {
  display: flex; flex-direction: column;
  padding: 28px 20px 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.mset-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mset-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0; font-weight: 500;
}
.mset-hero-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--mset-ink);
}
.mset-hero-serif {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--nc-accent-text);
}
.mset-hero-meta {
  font-family: var(--nc-font-body);
  font-weight: 400; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 20px;
  color: var(--mset-body);
  margin-top: 10px;
}

/* Scroll */
.mset-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 20px 0 20px;
  box-sizing: border-box;
  scrollbar-width: none;
}
.mset-scroll::-webkit-scrollbar { display: none; }

/* Sign-in panel (guest) */
.mset-signin {
  display: flex; flex-direction: column; gap: 18px;
  padding: 22px 20px;
  background: var(--mset-surface);
  border: 1px solid var(--mset-stroke);
  border-radius: 0.5rem;
}
.mset-signin-head {
  display: flex; flex-direction: column; gap: 6px;
}
.mset-signin-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--nc-accent-text);
}
.mset-signin-title {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(24px * var(--nc-text-scale, 1)); line-height: 28px;
  letter-spacing: -0.01em;
  color: var(--mset-ink);
}
.mset-signin-sub {
  font-family: var(--nc-font-body);
  font-weight: 400; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 18px;
  color: var(--mset-body);
}
.mset-signin-grid {
  display: flex; flex-direction: column; gap: 8px;
}
.mset-signin-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mset-stroke);
  border-radius: 0.5rem;
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  color: var(--mset-ink);
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), border-color 150ms var(--nc-ease), transform 120ms var(--nc-ease), opacity 120ms var(--nc-ease);
}
.mset-signin-btn:active { background: var(--nc-surface-3); transform: scale(0.97); }
/* Sign in with Apple — required (Guideline 4.8) and at least as prominent.
   Ink pill treatment doubles as the HIG variant: white-on-dark, black-on-light. */
.mset-signin-btn--apple {
  background: var(--nc-text);
  border-color: var(--nc-text);
  color: var(--nc-bg);
  font-weight: 600;
}
.mset-signin-btn--apple:active { background: var(--nc-text); opacity: 0.92; }

/* Profile card */
.mset-profile {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: var(--mset-surface);
  border: 1px solid var(--mset-stroke);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: background-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mset-profile:active { background: var(--nc-surface-3); transform: scale(0.97); }
.mset-profile-avatar {
  width: 48px; height: 48px;
  border-radius: 999px;
  background: rgba(var(--nc-accent-rgb), 0.16);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.40);
  display: flex; align-items: center; justify-content: center;
  color: var(--nc-accent-text);
  font-weight: 500; font-size: calc(18px * var(--nc-text-scale, 1)); line-height: 20px;
  overflow: hidden;
  flex-shrink: 0;
}
.mset-profile-img { width: 100%; height: 100%; object-fit: cover; }
.mset-profile-info {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0;
  min-width: 0;
}
.mset-profile-name {
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 20px;
  letter-spacing: -0.01em;
  color: var(--mset-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mset-profile-email {
  font-family: var(--nc-font-mono);
  font-weight: 400; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.04em;
  color: var(--mset-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Attention note — coral is the sanctioned attention color (REDESIGN.md §1) */
.mset-hidden-note {
  margin: 12px 4px 0;
  padding: 10px 12px;
  border-radius: 0.5rem;
  background: rgba(var(--nc-coral-rgb), 0.08);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.22);
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 16px;
  letter-spacing: 0.02em;
  color: var(--nc-coral);
}

/* Section header */
.mset-section {
  display: flex; align-items: center;
  margin-top: 22px;
  padding: 0 4px;
}
.mset-section-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}

/* Settings group */
.mset-group {
  margin-top: 12px;
  background: var(--mset-surface);
  border: 1px solid var(--mset-stroke);
  border-radius: 0.5rem;
  overflow: hidden;
}
.mset-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: background-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mset-row:active { background: var(--nc-surface-3); transform: scale(0.97); }
.mset-row-icon {
  width: 32px; height: 32px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mset-stroke-soft);
  color: var(--nc-text);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mset-row-icon--mint {
  background: rgba(var(--nc-accent-rgb), 0.10);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.28);
  color: var(--nc-accent-text);
}
.mset-row-text {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0;
  min-width: 0;
}
.mset-row-titlebar {
  display: flex; align-items: center; gap: 8px;
}
.mset-row-title {
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.005em;
  color: var(--mset-ink);
}
.mset-row-hint {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.12em;
  color: var(--mset-mute);
}
/* Chip grammar (REDESIGN.md §5): mono accent on chip fill + hairline */
.mset-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px;
  padding: 0 5px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mset-stroke);
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  color: var(--nc-accent-text);
}
.mset-chev { flex-shrink: 0; color: var(--nc-text-dim); }
.mset-divider {
  height: 1px;
  background: var(--mset-stroke-soft);
  margin: 0 16px;
}

/* Sign out — destructive action in calm coral (REDESIGN.md §1) */
.mset-signout {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%;
  margin-top: 22px;
  padding: 14px 16px;
  background: rgba(var(--nc-coral-rgb), 0.06);
  border: 1px solid rgba(var(--nc-coral-rgb), 0.30);
  border-radius: 0.5rem;
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  color: var(--nc-coral);
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mset-signout:active { background: rgba(var(--nc-coral-rgb), 0.10); transform: scale(0.97); }
.mset-signout:disabled { opacity: 0.45; cursor: not-allowed; }

/* Footer */
.mset-footer {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  margin-top: 22px;
  padding: 0 4px;
}
.mset-footer-line {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.10em;
  color: var(--mset-mute);
}
.mset-footer-mute { color: var(--nc-text-dim); }

/* Spacer to clear dock (~88px dock + safe area) */
.mset-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}
</style>
