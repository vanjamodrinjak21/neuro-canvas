<script setup lang="ts">
/**
 * Mobile Settings — Account (Dark)
 * Paper artboard KXU-0 ("Mobile iOS — Settings: Account").
 * Security · Danger zone. (No sign-out — that lives on the home screen.)
 */
import { computed, ref } from 'vue'

const { t } = useI18n()

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
  'delete-account': []
}>()

const provider = computed(() => (props.provider || 'CREDENTIALS').toUpperCase())

// ── Export all maps — web downloads a JSON file; native writes it and opens
// the share sheet (Capacitor Filesystem + Share). Works on Android + iOS.
const db = useDatabase()
const platform = usePlatform()
const exporting = ref(false)
async function exportMaps() {
  if (exporting.value) return
  exporting.value = true
  try {
    const maps = await db.getAllMaps()
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), maps }, null, 2)
    const filename = `neurocanvas-maps-${new Date().toISOString().slice(0, 10)}.json`
    if (platform.isCapacitor.value) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const res = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
      // Share a FILE — must use `files`, not `url` (which is for sharing a link;
      // passing a file:// there silently shares nothing on iOS).
      await Share.share({ title: 'NeuroCanvas maps', files: [res.uri] })
    } else if (typeof document !== 'undefined') {
      // Web Share Level 2 (files) first — on iOS Safari/PWA the <a download>
      // trick silently does nothing, but navigator.share with a File works.
      const file = new File([json], filename, { type: 'application/json' })
      const nav = navigator as Navigator & {
        canShare?: (data?: unknown) => boolean
        share?: (data?: unknown) => Promise<void>
      }
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({ files: [file], title: 'NeuroCanvas maps' })
          return
        } catch (err) {
          // User cancelled the share sheet — done, don't also download.
          if (err instanceof DOMException && err.name === 'AbortError') return
          // Otherwise fall through to the download fallback.
        }
      }
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }
  } catch (e) {
    console.error('[settings] export maps failed:', e)
  } finally {
    exporting.value = false
  }
}

// ── Change password (email/password accounts only — OAuth accounts have none) ──
const canChangePassword = computed(() => {
  const p = (props.provider || 'credentials').toLowerCase()
  return p === 'credentials' || p === 'email'
})
const showPwForm = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const pwError = ref('')
const pwSaving = ref(false)
const pwSaved = ref(false)
async function submitPassword() {
  if (pwSaving.value || !currentPassword.value || !newPassword.value) return
  pwSaving.value = true
  pwError.value = ''
  pwSaved.value = false
  try {
    await $fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value }
    })
    pwSaved.value = true
    currentPassword.value = ''
    newPassword.value = ''
    setTimeout(() => { showPwForm.value = false; pwSaved.value = false }, 1500)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    pwError.value = err?.data?.statusMessage || 'Failed to change password'
  } finally {
    pwSaving.value = false
  }
}
</script>

<template>
  <section class="macc" :aria-label="t('mobile.settingsAccount.sectionAriaLabel')">
    <header class="macc-top">
      <button class="macc-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ t('mobile.settingsAccount.backToSettings') }}</span>
      </button>
      <div class="macc-live">
        <span class="macc-live-dot" />
        <span class="macc-live-label">{{ provider }}</span>
      </div>
    </header>

    <div class="macc-hero">
      <span class="macc-eyebrow">04 — {{ t('mobile.settingsAccount.eyebrowLabel') }}</span>
      <h1 class="macc-hero-line">
        <span class="macc-hero-sans">{{ t('mobile.settingsAccount.heroLineSans') }}</span>
        <span class="macc-hero-serif">{{ t('mobile.settingsAccount.heroLineSerif') }}</span>
      </h1>
      <span class="macc-hero-meta">{{ t('mobile.settingsAccount.heroMeta') }}</span>
    </div>

    <div class="macc-scroll">
      <!-- SECURITY -->
      <div class="macc-section-head">
        <span class="macc-section-label">{{ t('mobile.settingsAccount.securityLabel') }}</span>
        <span class="macc-section-status macc-section-status--mint">{{ provider }}</span>
      </div>
      <div class="macc-card">
        <div class="macc-row">
          <div class="macc-icon macc-icon--mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L4 6V12C4 16.5 7.5 20.5 12 22C16.5 20.5 20 16.5 20 12V6L12 2Z" stroke="#00D2BE" stroke-width="1.6" stroke-linejoin="round" />
              <path d="M9 12L11 14L15 10" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">{{ provider }}</span>
            <span class="macc-row-hint">{{ props.user?.email }}</span>
          </div>
        </div>

        <template v-if="canChangePassword">
          <div class="macc-sep" />
          <button class="macc-row macc-row--action" type="button" @click="showPwForm = !showPwForm">
            <div class="macc-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" stroke="#A1A1AA" stroke-width="1.6" />
                <path d="M8 11V8a4 4 0 018 0v3" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="macc-row-text">
              <span class="macc-row-title">{{ t('mobile.settingsAccount.changePassword') }}</span>
              <span class="macc-row-hint">{{ t('mobile.settingsAccount.changePasswordHint') }}</span>
            </div>
          </button>
          <div v-if="showPwForm" class="macc-pwform">
            <input v-model="currentPassword" type="password" class="macc-pw-input" :placeholder="t('mobile.settingsAccount.currentPwPlaceholder')" autocomplete="current-password">
            <input v-model="newPassword" type="password" class="macc-pw-input" :placeholder="t('mobile.settingsAccount.newPwPlaceholder')" autocomplete="new-password">
            <p v-if="pwError" class="macc-pw-error">{{ pwError }}</p>
            <button class="macc-pw-submit" type="button" :disabled="pwSaving || !currentPassword || !newPassword" @click="submitPassword">
              {{ pwSaved ? t('mobile.settingsAccount.passwordSaved') : pwSaving ? t('mobile.settingsAccount.saving') : t('mobile.settingsAccount.savePassword') }}
            </button>
          </div>
        </template>
      </div>

      <!-- DATA -->
      <div class="macc-section-head">
        <span class="macc-section-label">{{ t('mobile.settingsAccount.dataLabel') }}</span>
      </div>
      <div class="macc-card">
        <button class="macc-row macc-row--action" type="button" :disabled="exporting" @click="exportMaps">
          <div class="macc-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v12m0 0l4-4m-4 4l-4-4" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="macc-row-text">
            <span class="macc-row-title">{{ exporting ? t('mobile.settingsAccount.exporting') : t('mobile.settingsAccount.exportTitle') }}</span>
            <span class="macc-row-hint">{{ t('mobile.settingsAccount.exportHint') }}</span>
          </div>
        </button>
      </div>

      <!-- DANGER ZONE -->
      <button class="macc-danger" type="button" @click="emit('delete-account')">
        <div class="macc-danger-head">
          <span class="macc-danger-label">{{ t('mobile.settingsAccount.dangerLabel') }}</span>
          <span class="macc-danger-meta">{{ t('mobile.settingsAccount.dangerMeta') }}</span>
        </div>
        <div class="macc-danger-body">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 6H21M8 6V4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V6M5 6L6 20C6 20.55 6.45 21 7 21H17C17.55 21 18 20.55 18 20L19 6" stroke="#EF4444" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="macc-danger-info">
            <span class="macc-danger-title">{{ t('mobile.settingsAccount.deleteTitle') }}</span>
            <span class="macc-danger-italic">{{ t('mobile.settingsAccount.deleteItalic', { n: 30 }) }}</span>
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
  --macc-bg: var(--nc-bg);
  --macc-ink: var(--nc-ink);
  --macc-body: var(--nc-ink-soft);
  --macc-mute: var(--nc-ink-faint);
  --macc-mint: #00D2BE;
  --macc-red: #EF4444;
  --macc-surface: rgba(250, 250, 250, 0.04);
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
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
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
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--macc-mint);
}

.macc-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px; flex-shrink: 0;
}
.macc-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--macc-mute);
}
.macc-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.macc-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.025em; color: var(--macc-ink);
}
.macc-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--macc-mint);
}
.macc-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 20px;
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
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--macc-mute);
}
.macc-section-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--macc-mute);
}
.macc-section-status--mint { color: var(--macc-mint); }

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
.macc-row--action:disabled { opacity: 0.5; cursor: default; }
.macc-sep { height: 1px; background: rgba(250, 250, 250, 0.07); margin: 0 16px; }
.macc-pwform { display: flex; flex-direction: column; gap: 10px; padding: 4px 16px 16px; }
.macc-pw-input {
  width: 100%; box-sizing: border-box; padding: 12px 14px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 10px; color: var(--nc-ink);
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(14px * var(--nc-text-scale, 1)); outline: none;
}
.macc-pw-input:focus { border-color: rgba(0, 210, 190, 0.40); }
.macc-pw-error {
  margin: 0; color: #fb7185;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 15px;
}
.macc-pw-submit {
  width: 100%; padding: 12px; border: none; border-radius: 10px;
  background: #00D2BE; color: #06201D; cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1));
}
.macc-pw-submit:disabled { opacity: 0.5; cursor: default; }
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
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em; color: var(--macc-ink);
}
.macc-row-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--macc-mute);
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
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--macc-red);
}
.macc-danger-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: rgba(239, 68, 68, 0.55);
}
.macc-danger-body { display: flex; align-items: center; gap: 12px; }
.macc-danger-info { display: flex; flex-direction: column; gap: 2px; flex: 1 1 0; min-width: 0; }
.macc-danger-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em; color: var(--macc-ink);
}
.macc-danger-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-size: calc(13px * var(--nc-text-scale, 1)); color: var(--macc-body);
}

.macc-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}

/* Light theme */
:root.light .macc {
  /* White-on-dark overlays disappear on a light surface — flip to dark-ink overlays */
  --macc-surface: rgba(17, 17, 17, 0.04);
  --macc-stroke-soft: rgba(17, 17, 17, 0.08);
}
:root.light .macc-row:active { background: rgba(17, 17, 17, 0.04); }
:root.light .macc-icon {
  background: rgba(17, 17, 17, 0.04);
  border: 1px solid rgba(17, 17, 17, 0.08);
}
</style>
