<script setup lang="ts">
/**
 * Mobile Settings — Account (Dark)
 * Paper artboard KXU-0 ("Mobile iOS — Settings: Account").
 * Security · Sessions · Data · Danger zone. (No sign-out — that lives on the home screen.)
 */
import { computed, ref } from 'vue'

interface UserLike {
  name?: string | null
  email?: string | null
  image?: string | null
}

const props = defineProps<{
  user: UserLike | null | undefined
  provider?: string | null
}>()

const emit = defineEmits<{
  back: []
  'open-password': []
  'open-passkeys': []
  'open-apps': []
  'export-data': []
  'import-data': []
  'delete-account': []
  'revoke-session': [id: string]
  'revoke-others': []
}>()

const twoFactorOn = ref(true)

const sessions = computed(() => [
  { id: 'current', device: 'iPhone 17 Pro', italic: '— this device', meta: 'ZAGREB · NOW', current: true },
  { id: 'macbook', device: 'MacBook Pro · Tauri', meta: 'ZAGREB · 14M AGO' },
  { id: 'ipad', device: 'iPad Air · Safari', meta: 'SPLIT, HR · 4D AGO · IDLE' }
])

const provider = computed(() => (props.provider || 'CREDENTIALS').toUpperCase())
</script>

<template>
  <section class="macc" aria-label="Account settings">
    <header class="macc-top">
      <button class="macc-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>SETTINGS</span>
      </button>
      <div class="macc-live">
        <span class="macc-live-dot" />
        <span class="macc-live-label">{{ twoFactorOn ? '2FA ON' : '2FA OFF' }}</span>
      </div>
    </header>

    <div class="macc-hero">
      <span class="macc-eyebrow">04 — ACCOUNT</span>
      <h1 class="macc-hero-line">
        <span class="macc-hero-sans">Lock the</span>
        <span class="macc-hero-serif">door.</span>
      </h1>
      <span class="macc-hero-meta">Security, your data, where you're signed in. Take all three with you.</span>
    </div>

    <div class="macc-scroll">
      <!-- SECURITY -->
      <div class="macc-section-head">
        <span class="macc-section-label">SECURITY</span>
        <span class="macc-section-status macc-section-status--mint">{{ provider }}</span>
      </div>
      <div class="macc-card">
        <button class="macc-row" type="button" @click="emit('open-password')">
          <div class="macc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="8" cy="14" r="4" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M11 13L20 4M16 6L20 10M14 8L18 12" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">Password</span>
            <span class="macc-row-hint">CHANGE · STRONG</span>
          </div>
          <svg class="macc-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="macc-divider" />

        <div class="macc-row">
          <div class="macc-icon macc-icon--mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L4 6V12C4 16.5 7.5 20.5 12 22C16.5 20.5 20 16.5 20 12V6L12 2Z" stroke="#00D2BE" stroke-width="1.6" stroke-linejoin="round" />
              <path d="M9 12L11 14L15 10" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">
              Two-factor
              <span class="macc-row-italic">— authenticator</span>
            </span>
            <span class="macc-row-hint">TOTP · 6 BACKUP CODES</span>
          </div>
          <button
            class="macc-toggle"
            :class="{ 'macc-toggle--on': twoFactorOn }"
            type="button"
            @click="twoFactorOn = !twoFactorOn"
          >
            <span class="macc-toggle-knob" />
          </button>
        </div>

        <div class="macc-divider" />

        <button class="macc-row" type="button" @click="emit('open-passkeys')">
          <div class="macc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="8" cy="12" r="4" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M12 12H22M18 9V15M22 9V15" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">Passkeys</span>
            <span class="macc-row-hint">2 KEYS · IPHONE 17 PRO · MACBOOK</span>
          </div>
          <svg class="macc-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="macc-divider" />

        <button class="macc-row" type="button" @click="emit('open-apps')">
          <div class="macc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#A1A1AA" stroke-width="1.6" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#A1A1AA" stroke-width="1.6" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#A1A1AA" stroke-width="1.6" />
              <circle cx="17.5" cy="17.5" r="3.5" stroke="#A1A1AA" stroke-width="1.6" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">Connected apps</span>
            <span class="macc-row-hint">GITHUB · LINEAR · OBSIDIAN</span>
          </div>
          <svg class="macc-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <!-- SESSIONS -->
      <div class="macc-section-head">
        <span class="macc-section-label">SESSIONS</span>
        <button class="macc-section-action" type="button" @click="emit('revoke-others')">REVOKE OTHERS</button>
      </div>
      <div class="macc-card">
        <template v-for="(session, idx) in sessions" :key="session.id">
          <div
            class="macc-row"
            :class="{ 'macc-row--current': session.current }"
          >
            <div class="macc-icon" :class="{ 'macc-icon--mint': session.current }">
              <svg v-if="idx === 0" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="6" y="3" width="12" height="18" rx="2" :stroke="session.current ? '#00D2BE' : '#A1A1AA'" stroke-width="1.6" />
                <circle cx="12" cy="18" r="0.8" :fill="session.current ? '#00D2BE' : '#A1A1AA'" />
              </svg>
              <svg v-else-if="idx === 1" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="11" rx="1.5" stroke="#A1A1AA" stroke-width="1.6" />
                <path d="M2 19H22" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" stroke="#A1A1AA" stroke-width="1.6" />
                <path d="M10 18H14" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="macc-row-text">
              <span class="macc-row-title">
                {{ session.device }}
                <span v-if="session.italic" class="macc-row-italic">{{ session.italic }}</span>
              </span>
              <span class="macc-row-hint">{{ session.meta }}</span>
            </div>
            <div v-if="session.current" class="macc-pill macc-pill--mint">ACTIVE</div>
            <button
              v-else
              class="macc-pill"
              type="button"
              @click="emit('revoke-session', session.id)"
            >REVOKE</button>
          </div>
          <div v-if="idx < sessions.length - 1" class="macc-divider" />
        </template>
      </div>

      <!-- DATA -->
      <div class="macc-section-head">
        <span class="macc-section-label">DATA</span>
        <span class="macc-section-status">YOURS TO TAKE</span>
      </div>
      <div class="macc-card">
        <button class="macc-row" type="button" @click="emit('export-data')">
          <div class="macc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4V16M12 16L7 11M12 16L17 11" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 20H20" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">Export everything</span>
            <span class="macc-row-hint">JSON · MARKDOWN · CRDT SNAPSHOTS</span>
          </div>
          <svg class="macc-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="macc-divider" />

        <button class="macc-row" type="button" @click="emit('import-data')">
          <div class="macc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 20H20" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">Import maps</span>
            <span class="macc-row-hint">FROM OBSIDIAN · MIRO · MARKDOWN</span>
          </div>
          <svg class="macc-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <!-- DANGER ZONE -->
      <button class="macc-danger" type="button" @click="emit('delete-account')">
        <div class="macc-danger-head">
          <span class="macc-danger-label">DANGER ZONE</span>
          <span class="macc-danger-meta">PERMANENT</span>
        </div>
        <div class="macc-danger-body">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6H21M8 6V4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V6M5 6L6 20C6 20.55 6.45 21 7 21H17C17.55 21 18 20.55 18 20L19 6" stroke="#EF4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="macc-danger-info">
            <span class="macc-danger-title">Delete account</span>
            <span class="macc-danger-italic">all your maps, every comment — gone in 30 days.</span>
          </div>
        </div>
      </button>

      <div class="macc-spacer" />
    </div>
  </section>
</template>

<style scoped>
.macc button {
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  color: inherit;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.macc input, .macc select {
  -webkit-appearance: none;
  appearance: none;
  outline: none;
}
.macc {
  --macc-bg: #09090B;
  --macc-ink: #FAFAFA;
  --macc-body: #A1A1AA;
  --macc-mute: #52525B;
  --macc-mint: #00D2BE;
  --macc-red: #EF4444;
  --macc-surface: rgba(250, 250, 250, 0.04);
  --macc-stroke: rgba(250, 250, 250, 0.10);
  --macc-stroke-soft: rgba(250, 250, 250, 0.06);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--macc-bg);
  color: var(--macc-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

.macc-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  flex-shrink: 0;
}
.macc-back {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 4px 4px 0;
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--macc-body);
}
.macc-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.macc-live-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--macc-mint);
  animation: macc-pulse 2.4s ease-in-out infinite;
}
@keyframes macc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.macc-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.08em;
  color: var(--macc-mint);
}

.macc-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px; flex-shrink: 0;
}
.macc-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--macc-mute);
}
.macc-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.macc-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 36px; line-height: 38px;
  letter-spacing: -0.025em; color: var(--macc-ink);
}
.macc-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 46px; line-height: 38px;
  letter-spacing: -0.02em; color: var(--macc-mint);
}
.macc-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px; line-height: 20px;
  color: var(--macc-body); margin-top: 10px;
}

.macc-scroll {
  flex: 1 1 0; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 0 20px;
  scrollbar-width: none;
}
.macc-scroll::-webkit-scrollbar { display: none; }

.macc-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 4px 10px;
}
.macc-section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; letter-spacing: 0.12em;
  color: var(--macc-mute);
}
.macc-section-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.08em;
  color: var(--macc-mute);
}
.macc-section-status--mint { color: var(--macc-mint); }
.macc-section-action {
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.08em;
  color: var(--macc-mint);
}

.macc-card {
  background: var(--macc-surface);
  border: 1px solid var(--macc-stroke-soft);
  border-radius: 16px;
  overflow: hidden;
}
.macc-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent; border: none;
  cursor: pointer; text-align: left;
  font-family: inherit; color: inherit;
  transition: background 150ms ease;
}
.macc-row:active { background: rgba(250, 250, 250, 0.04); }
.macc-row--current { background: rgba(0, 210, 190, 0.04); }
.macc-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.macc-icon--mint {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
}
.macc-row-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0; min-width: 0;
}
.macc-row-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 14px; line-height: 18px;
  letter-spacing: -0.01em; color: var(--macc-ink);
}
.macc-row-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; color: var(--macc-mint);
  margin-left: 4px;
}
.macc-row-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.04em;
  color: var(--macc-mute);
}
.macc-chev { flex-shrink: 0; }
.macc-divider { height: 1px; background: var(--macc-stroke-soft); margin: 0 16px; }

.macc-toggle {
  position: relative;
  width: 44px; height: 26px;
  padding: 0;
  border: 1px solid rgba(250, 250, 250, 0.06);
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.10);
  cursor: pointer; flex-shrink: 0;
  transition: background 150ms ease, border-color 150ms ease;
  display: inline-block;
}
.macc-toggle-knob {
  position: absolute; left: 2px; top: 2px;
  width: 20px; height: 20px; border-radius: 999px;
  background: #52525B;
  transition: transform 180ms ease, background 150ms ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.30);
}
.macc-toggle--on { background: var(--macc-mint); border-color: var(--macc-mint); }
.macc-toggle--on .macc-toggle-knob { transform: translateX(18px); background: #FAFAFA; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.40); }

.macc-pill {
  padding: 5px 9px;
  background: var(--macc-surface);
  border: 1px solid var(--macc-stroke);
  border-radius: 999px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: 9px; letter-spacing: 0.10em;
  color: var(--macc-body);
  flex-shrink: 0;
  cursor: pointer;
}
.macc-pill--mint {
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
  color: var(--macc-mint);
  cursor: default;
}

/* Danger zone */
.macc-danger {
  display: flex; flex-direction: column; gap: 10px;
  width: 100%;
  margin-top: 18px;
  padding: 14px 16px;
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.30);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  font-family: inherit; color: inherit;
  transition: background 150ms ease;
}
.macc-danger:active { background: rgba(239, 68, 68, 0.08); }
.macc-danger-head {
  display: flex; align-items: center; justify-content: space-between;
}
.macc-danger-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; letter-spacing: 0.12em;
  color: var(--macc-red);
}
.macc-danger-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; letter-spacing: 0.08em;
  color: rgba(239, 68, 68, 0.55);
}
.macc-danger-body { display: flex; align-items: center; gap: 12px; }
.macc-danger-info { display: flex; flex-direction: column; gap: 2px; flex: 1 1 0; min-width: 0; }
.macc-danger-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 14px; line-height: 18px;
  letter-spacing: -0.01em; color: var(--macc-ink);
}
.macc-danger-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-size: 13px; color: var(--macc-body);
}

.macc-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}
</style>
