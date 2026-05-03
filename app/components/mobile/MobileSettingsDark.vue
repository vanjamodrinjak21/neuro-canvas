<script setup lang="ts">
/**
 * Mobile Settings (Dark) — implementation of Paper artboards
 * GCX-0 (iOS) and GT1-0 (Android).
 */

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
}>()

const displayName = computed(() => props.user?.name || 'Guest')
const displayEmail = computed(() => props.user?.email || 'local@device')
</script>

<template>
  <section class="mset" aria-label="Settings">
    <!-- Top bar -->
    <header class="mset-top">
      <div class="mset-mark">
        <div class="mset-mark-dot" />
      </div>
      <div class="mset-live">
        <span class="mset-live-dot" />
        <span class="mset-live-label">SYNCED</span>
      </div>
    </header>

    <!-- Editorial hero -->
    <div class="mset-hero">
      <span class="mset-eyebrow">04 — SETTINGS</span>
      <h1 class="mset-hero-line">
        <span class="mset-hero-sans">Make it</span>
        <span class="mset-hero-serif">yours.</span>
      </h1>
      <span class="mset-hero-meta">Theme, AI providers, language, account.</span>
    </div>

    <!-- Scrollable body -->
    <div class="mset-scroll">
      <!-- Profile card -->
      <button class="mset-profile" type="button" @click="emit('open-account')">
        <div class="mset-profile-avatar">
          <img v-if="user?.image" :src="user.image" :alt="displayName" class="mset-profile-img">
          <span v-else>{{ userInitial }}</span>
        </div>
        <div class="mset-profile-info">
          <span class="mset-profile-name">{{ displayName }}</span>
          <span class="mset-profile-email">{{ displayEmail }}</span>
        </div>
        <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Section header -->
      <div class="mset-section">
        <span class="mset-section-label">PREFERENCES</span>
      </div>

      <!-- Settings group -->
      <div class="mset-group">
        <button class="mset-row" type="button" @click="emit('open-general')">
          <div class="mset-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2V4M12 20V22M4.93 4.93L6.34 6.34M17.66 17.66L19.07 19.07M2 12H4M20 12H22M4.93 19.07L6.34 17.66M17.66 6.34L19.07 4.93" />
            </svg>
          </div>
          <div class="mset-row-text">
            <span class="mset-row-title">General</span>
            <span class="mset-row-hint">THEME · FONT · AUTO-SAVE</span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mset-divider" />

        <button class="mset-row" type="button" @click="emit('open-ai-providers')">
          <div class="mset-row-icon mset-row-icon--mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
              <path d="M19 17L19.7 19L21.5 19.5L19.7 20L19 22L18.3 20L16.5 19.5L18.3 19L19 17Z" />
            </svg>
          </div>
          <div class="mset-row-text mset-row-text--ai">
            <div class="mset-row-titlebar">
              <span class="mset-row-title">AI Providers</span>
              <span v-if="connectedProvidersCount > 0" class="mset-badge">{{ connectedProvidersCount }}</span>
            </div>
            <span class="mset-row-hint">
              <template v-if="connectedProvidersCount > 0">{{ connectedProvidersCount }} CONNECTED</template>
              <template v-else>NO PROVIDERS</template>
            </span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mset-divider" />

        <button class="mset-row" type="button" @click="emit('open-personal')">
          <div class="mset-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21C4 16.5817 7.58172 13 12 13C16.4183 13 20 16.5817 20 21" />
            </svg>
          </div>
          <div class="mset-row-text">
            <span class="mset-row-title">Personal</span>
            <span class="mset-row-hint">PROFILE · LANGUAGE · PREFS</span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="mset-divider" />

        <button class="mset-row" type="button" @click="emit('open-account')">
          <div class="mset-row-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3L4 6V11C4 15.97 7.5 20.61 12 22C16.5 20.61 20 15.97 20 11V6L12 3Z" />
              <path d="M9 12L11 14L15 10" />
            </svg>
          </div>
          <div class="mset-row-text">
            <span class="mset-row-title">Account</span>
            <span class="mset-row-hint">SECURITY · DATA · SESSIONS</span>
          </div>
          <svg class="mset-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H9" />
          <path d="M16 17L21 12L16 7" />
          <path d="M21 12H9" />
        </svg>
        <span>{{ signOutLoading ? 'Signing out...' : 'Sign out' }}</span>
      </button>

      <!-- Footer mono -->
      <div class="mset-footer">
        <span class="mset-footer-line">v1.0.0 · pgvector RAG · MIT</span>
        <span class="mset-footer-line mset-footer-mute">made by Vanja Modrinjak</span>
      </div>

      <!-- Spacer to clear dock -->
      <div class="mset-spacer" />
    </div>
  </section>
</template>

<style scoped>
.mset {
  --mset-bg: #09090B;
  --mset-ink: #FAFAFA;
  --mset-body: #A1A1AA;
  --mset-mute: #52525B;
  --mset-mint: #00D2BE;
  --mset-surface: rgba(250, 250, 250, 0.04);
  --mset-stroke: rgba(250, 250, 250, 0.10);
  --mset-stroke-soft: rgba(250, 250, 250, 0.06);
  --mset-red: #EF4444;

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mset-bg);
  color: var(--mset-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

/* Top bar */
.mset-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  height: 44px;
  padding: 4px 20px 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.mset-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--mset-mint);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mset-mark-dot { width: 9px; height: 9px; border-radius: 2px; background: var(--mset-bg); }
.mset-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.mset-live-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--mset-mint);
  animation: mset-pulse 2.4s ease-in-out infinite;
}
@keyframes mset-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.mset-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mset-mint);
}

/* Hero */
.mset-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.mset-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.12em; color: var(--mset-mute);
}
.mset-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0; font-weight: 500;
}
.mset-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 36px; line-height: 38px;
  letter-spacing: -0.025em; color: var(--mset-ink);
}
.mset-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 46px; line-height: 38px;
  letter-spacing: -0.02em; color: var(--mset-mint);
}
.mset-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 400; font-size: 13px; line-height: 20px;
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

/* Profile card */
.mset-profile {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: var(--mset-surface);
  border: 1px solid var(--mset-stroke);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  transition: background 150ms ease;
}
.mset-profile:active { background: rgba(250, 250, 250, 0.06); }
.mset-profile-avatar {
  width: 48px; height: 48px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.16);
  border: 1px solid rgba(0, 210, 190, 0.40);
  display: flex; align-items: center; justify-content: center;
  color: var(--mset-mint);
  font-weight: 500; font-size: 18px; line-height: 20px;
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
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 16px; line-height: 20px;
  letter-spacing: -0.01em;
  color: var(--mset-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mset-profile-email {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 400; font-size: 11px; line-height: 14px;
  letter-spacing: 0.04em;
  color: var(--mset-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Section header */
.mset-section {
  display: flex; align-items: center;
  margin-top: 22px;
  padding: 0 4px;
}
.mset-section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.14em;
  color: var(--mset-mute);
}

/* Settings group */
.mset-group {
  margin-top: 12px;
  background: var(--mset-surface);
  border: 1px solid var(--mset-stroke);
  border-radius: 14px;
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
  transition: background 150ms ease;
}
.mset-row:active { background: rgba(250, 250, 250, 0.04); }
.mset-row-icon {
  width: 32px; height: 32px;
  border-radius: 9px;
  background: rgba(250, 250, 250, 0.05);
  border: 1px solid var(--mset-stroke-soft);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mset-row-icon--mint {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
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
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 14px; line-height: 18px;
  letter-spacing: -0.005em;
  color: var(--mset-ink);
}
.mset-row-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; line-height: 12px;
  letter-spacing: 0.12em;
  color: var(--mset-mute);
}
.mset-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  background: rgba(0, 210, 190, 0.14);
  border: 1px solid rgba(0, 210, 190, 0.30);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  color: var(--mset-mint);
}
.mset-chev { flex-shrink: 0; }
.mset-divider {
  height: 1px;
  background: var(--mset-stroke-soft);
  margin: 0 16px;
}

/* Sign out */
.mset-signout {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%;
  margin-top: 22px;
  padding: 14px 16px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.30);
  border-radius: 14px;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 14px; line-height: 18px;
  color: var(--mset-red);
  cursor: pointer;
  transition: background 150ms ease;
}
.mset-signout:active { background: rgba(239, 68, 68, 0.10); }
.mset-signout:disabled { opacity: 0.6; cursor: not-allowed; }

/* Footer */
.mset-footer {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  margin-top: 22px;
  padding: 0 4px;
}
.mset-footer-line {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.10em;
  color: var(--mset-mute);
}
.mset-footer-mute { color: rgba(82, 82, 91, 0.7); }

/* Spacer to clear dock (~88px dock + safe area) */
.mset-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}
</style>
