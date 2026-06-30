<script setup lang="ts">
/**
 * Mobile Settings — General (Dark)
 * Paper artboard KL8-0 ("Mobile iOS — Settings: General").
 * Theme tiles, Typography card (font / slider / density), Behavior card.
 */
import { computed, ref } from 'vue'
import { useUserStore } from '~/stores/userStore'
import { useAppUpdates, useAutoUpdateToggle } from '~/composables/useAppUpdates'

defineProps<{
  signOutLoading?: boolean
}>()

const emit = defineEmits<{
  back: []
}>()

const { t } = useI18n()

const userStore = useUserStore()
const prefs = userStore.preferences

const theme = computed(() => prefs.value.theme)
const fontSize = computed(() => prefs.value.fontSize)
const density = computed(() => prefs.value.density)

function setTheme(value: 'light' | 'dark' | 'system') {
  userStore.setPreference('theme', value)
}
function setDensity(value: 'cozy' | 'compact') {
  userStore.setPreference('density', value)
}
type FontSize = 'xs' | 'small' | 'medium' | 'large' | 'xl'

const FONT_SIZE_STEPS: ReadonlyArray<FontSize> = ['xs', 'small', 'medium', 'large', 'xl']
const FONT_SIZE_PX: Record<FontSize, number> = {
  xs: 13,
  small: 14,
  medium: 16,
  large: 18,
  xl: 20
}

function setFontSize(value: FontSize) {
  userStore.setPreference('fontSize', value)
}
function toggle(key: 'autoSave' | 'reducedMotion' | 'showGrid' | 'showMinimap') {
  userStore.setPreference(key, !prefs.value[key])
}

const fontSizePx = computed(() => FONT_SIZE_PX[fontSize.value as FontSize] ?? 16)
const sliderPercent = computed(() => {
  const idx = FONT_SIZE_STEPS.indexOf(fontSize.value as FontSize)
  if (idx < 0) return 50
  return (idx / (FONT_SIZE_STEPS.length - 1)) * 100
})

const themeStatus = computed(() => {
  if (theme.value === 'system') return t('mobile.settingsGeneral.themeStatusSystem')
  if (theme.value === 'light') return t('mobile.settingsGeneral.themeStatusLight')
  return t('mobile.settingsGeneral.themeStatusDark')
})

// ── Updates (AER-14) ────────────────────────────────────────────────────
// Mirrors the desktop Settings → General toggle so mobile users can opt
// out of automatic update checks and trigger a manual one. On iOS/Android
// `appUpdates.action()` opens the store via @capacitor/browser; here we
// only expose the toggle + manual check.
const autoUpdate = useAutoUpdateToggle()
const appUpdates = useAppUpdates()
const checkingForUpdates = ref(false)
const updateStatus = computed(() => {
  if (checkingForUpdates.value) return t('mobile.settingsGeneral.updateChecking')
  if (appUpdates.updateAvailable.value && appUpdates.latestVersion.value) {
    return `v${appUpdates.currentVersion} → v${appUpdates.latestVersion.value}`
  }
  return t('mobile.settingsGeneral.updateUpToDate', { v: appUpdates.currentVersion })
})
async function manualUpdateCheck() {
  if (checkingForUpdates.value) return
  checkingForUpdates.value = true
  try {
    await appUpdates.check()
  } finally {
    checkingForUpdates.value = false
  }
}
</script>

<template>
  <section class="mgen" :aria-label="t('mobile.settingsGeneral.sectionAriaLabel')">
    <!-- Top bar -->
    <header class="mgen-top">
      <button class="mgen-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ t('mobile.settingsGeneral.backToSettings') }}</span>
      </button>
      <div class="mgen-live">
        <span class="mgen-live-dot" />
        <span class="mgen-live-label">{{ t('mobile.settingsGeneral.synced') }}</span>
      </div>
    </header>

    <!-- Editorial hero -->
    <div class="mgen-hero">
      <span class="mgen-eyebrow">01 — {{ t('mobile.settingsGeneral.eyebrowGeneral') }}</span>
      <h1 class="mgen-hero-line">
        <span class="mgen-hero-sans">{{ t('mobile.settingsGeneral.heroSans') }}</span>
        <span class="mgen-hero-serif">{{ t('mobile.settingsGeneral.heroSerif') }}</span>
      </h1>
      <span class="mgen-hero-meta">{{ t('mobile.settingsGeneral.heroMeta') }}</span>
    </div>

    <!-- Scroll body -->
    <div class="mgen-scroll">
      <!-- THEME -->
      <div class="mgen-section-head">
        <span class="mgen-section-label">{{ t('mobile.settingsGeneral.themeLabel') }}</span>
        <span class="mgen-section-status">{{ themeStatus }}</span>
      </div>
      <div class="mgen-tiles">
        <button
          class="mgen-tile"
          :class="{ 'mgen-tile--on': theme === 'light' }"
          type="button"
          @click="setTheme('light')"
        >
          <div class="mgen-tile-preview mgen-tile-preview--light">
            <span class="mgen-tile-line mgen-tile-line--head" />
            <span class="mgen-tile-line mgen-tile-line--body" />
            <span class="mgen-tile-line mgen-tile-line--body mgen-tile-line--short" />
          </div>
          <span class="mgen-tile-label" :class="{ 'mgen-tile-label--on': theme === 'light' }">{{ theme === 'light' ? t('mobile.settingsGeneral.tileLightOn') : t('mobile.settingsGeneral.tileLight') }}</span>
        </button>

        <button
          class="mgen-tile"
          :class="{ 'mgen-tile--on': theme === 'dark' }"
          type="button"
          @click="setTheme('dark')"
        >
          <div class="mgen-tile-preview mgen-tile-preview--dark">
            <span class="mgen-tile-line mgen-tile-line--head mgen-tile-line--head-dark" />
            <span class="mgen-tile-line mgen-tile-line--body mgen-tile-line--body-dark" />
            <span class="mgen-tile-line mgen-tile-line--body mgen-tile-line--short mgen-tile-line--body-dark" />
          </div>
          <span class="mgen-tile-label" :class="{ 'mgen-tile-label--on': theme === 'dark' }">{{ theme === 'dark' ? t('mobile.settingsGeneral.tileDarkOn') : t('mobile.settingsGeneral.tileDark') }}</span>
        </button>

        <button
          class="mgen-tile"
          :class="{ 'mgen-tile--on': theme === 'system' }"
          type="button"
          @click="setTheme('system')"
        >
          <div class="mgen-tile-preview mgen-tile-preview--auto">
            <span class="mgen-tile-half mgen-tile-half--light" />
            <span class="mgen-tile-half mgen-tile-half--dark" />
          </div>
          <span class="mgen-tile-label" :class="{ 'mgen-tile-label--on': theme === 'system' }">{{ theme === 'system' ? t('mobile.settingsGeneral.tileAutoOn') : t('mobile.settingsGeneral.tileAuto') }}</span>
        </button>
      </div>

      <!-- TYPOGRAPHY -->
      <div class="mgen-section-head">
        <span class="mgen-section-label">{{ t('mobile.settingsGeneral.typographyLabel') }}</span>
        <span class="mgen-section-status">{{ t('mobile.settingsGeneral.typographyStatus', { n: fontSizePx }) }}</span>
      </div>
      <div class="mgen-card">
        <div class="mgen-row">
          <div class="mgen-tile-mini">
            <span class="mgen-tile-mini-text">Aa</span>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ t('mobile.settingsGeneral.editorFont') }}</span>
            <span class="mgen-row-hint">{{ t('mobile.settingsGeneral.editorFontHint') }}</span>
          </div>
          <svg class="mgen-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="mgen-divider" />

        <div class="mgen-row mgen-row--col">
          <div class="mgen-row-head">
            <span class="mgen-row-title">{{ t('mobile.settingsGeneral.textSize') }}</span>
            <span class="mgen-row-value">{{ t('mobile.settingsGeneral.textSizeValue', { n: fontSizePx }) }}</span>
          </div>
          <div class="mgen-slider">
            <button class="mgen-slider-cap mgen-slider-cap--sm" type="button" @click="setFontSize('xs')">A</button>
            <div class="mgen-slider-track">
              <div class="mgen-slider-fill" :style="{ width: sliderPercent + '%' }" />
              <div class="mgen-slider-knob" :style="{ left: 'calc(' + sliderPercent + '% - 8px)' }" />
              <button
                v-for="(step, i) in FONT_SIZE_STEPS"
                :key="step"
                class="mgen-slider-step"
                :style="{ left: ((i / (FONT_SIZE_STEPS.length - 1)) * 100) + '%' }"
                type="button"
                :aria-label="step"
                @click="setFontSize(step)"
              />
            </div>
            <button class="mgen-slider-cap mgen-slider-cap--lg" type="button" @click="setFontSize('xl')">A</button>
          </div>
        </div>

        <div class="mgen-divider" />

        <div class="mgen-row">
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ t('mobile.settingsGeneral.density') }}</span>
            <span class="mgen-row-hint">{{ t('mobile.settingsGeneral.densityHint') }}</span>
          </div>
          <div class="mgen-seg">
            <button class="mgen-seg-btn" :class="{ 'mgen-seg-btn--on': density === 'cozy' }" type="button" @click="setDensity('cozy')">{{ t('mobile.settingsGeneral.densityCozy') }}</button>
            <button class="mgen-seg-btn" :class="{ 'mgen-seg-btn--on': density === 'compact' }" type="button" @click="setDensity('compact')">{{ t('mobile.settingsGeneral.densityCompact') }}</button>
          </div>
        </div>
      </div>

      <!-- BEHAVIOR -->
      <div class="mgen-section-head">
        <span class="mgen-section-label">{{ t('mobile.settingsGeneral.behaviorLabel') }}</span>
        <span class="mgen-section-status mgen-section-status--mint">{{ t('mobile.settingsGeneral.behaviorSaved') }}</span>
      </div>
      <div class="mgen-card">
        <div class="mgen-row">
          <div class="mgen-icon mgen-icon--mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C15 3 17.5 4.5 19 6.5" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" />
              <path d="M21 3V7H17" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ t('mobile.settingsGeneral.autoSave') }}</span>
            <span class="mgen-row-hint">{{ t('mobile.settingsGeneral.autoSaveHint') }}</span>
          </div>
          <button
            class="mgen-toggle"
            :class="{ 'mgen-toggle--on': prefs.autoSave }"
            type="button"
            @click="toggle('autoSave')"
          >
            <span class="mgen-toggle-knob" />
          </button>
        </div>

        <div class="mgen-divider" />

        <div class="mgen-row">
          <div class="mgen-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M8 12H16" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ t('mobile.settingsGeneral.reduceMotion') }}</span>
            <span class="mgen-row-hint">{{ t('mobile.settingsGeneral.reduceMotionHint') }}</span>
          </div>
          <button
            class="mgen-toggle"
            :class="{ 'mgen-toggle--on': prefs.reducedMotion }"
            type="button"
            @click="toggle('reducedMotion')"
          >
            <span class="mgen-toggle-knob" />
          </button>
        </div>

        <div class="mgen-divider" />

        <div class="mgen-row">
          <div class="mgen-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M3 9H21M9 21V9" stroke="#A1A1AA" stroke-width="1.6" />
            </svg>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ t('mobile.settingsGeneral.canvasGrid') }}</span>
            <span class="mgen-row-hint">{{ t('mobile.settingsGeneral.canvasGridHint') }}</span>
          </div>
          <button
            class="mgen-toggle"
            :class="{ 'mgen-toggle--on': prefs.showGrid }"
            type="button"
            @click="toggle('showGrid')"
          >
            <span class="mgen-toggle-knob" />
          </button>
        </div>

        <div class="mgen-divider" />

        <div class="mgen-row">
          <div class="mgen-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="14" rx="2" stroke="#A1A1AA" stroke-width="1.6" />
              <rect x="14" y="11" width="6" height="5" rx="1" stroke="#A1A1AA" stroke-width="1.6" fill="none" />
            </svg>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">
              {{ t('mobile.settingsGeneral.minimap') }}
              <span class="mgen-row-italic">{{ t('mobile.settingsGeneral.minimapAside') }}</span>
            </span>
            <span class="mgen-row-hint">{{ t('mobile.settingsGeneral.minimapHint') }}</span>
          </div>
          <button
            class="mgen-toggle"
            :class="{ 'mgen-toggle--on': prefs.showMinimap }"
            type="button"
            @click="toggle('showMinimap')"
          >
            <span class="mgen-toggle-knob" />
          </button>
        </div>
      </div>

      <!-- UPDATES (AER-14) -->
      <div class="mgen-section-head">
        <span class="mgen-section-label">{{ $t('settings.section_labels.updates') }}</span>
        <span class="mgen-section-status">{{ updateStatus }}</span>
      </div>
      <div class="mgen-card">
        <div class="mgen-row">
          <div class="mgen-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C15 3 17.5 4.5 19 6.5" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
              <path d="M21 3V7H17" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ $t('settings.general.auto_check_updates') }}</span>
            <span class="mgen-row-hint">{{ $t('settings.general.auto_check_updates_desc') }}</span>
          </div>
          <button
            class="mgen-toggle"
            :class="{ 'mgen-toggle--on': autoUpdate.enabled.value }"
            :aria-pressed="autoUpdate.enabled.value"
            type="button"
            @click="autoUpdate.setEnabled(!autoUpdate.enabled.value)"
          >
            <span class="mgen-toggle-knob" />
          </button>
        </div>

        <div class="mgen-divider" />

        <div class="mgen-row">
          <div class="mgen-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v9m0 0l4-4m-4 4l-4-4" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </div>
          <div class="mgen-row-text">
            <span class="mgen-row-title">{{ $t('settings.general.current_version') }}</span>
            <span class="mgen-row-hint">{{ updateStatus }}</span>
          </div>
          <button
            class="mgen-update-btn"
            type="button"
            :disabled="checkingForUpdates"
            @click="manualUpdateCheck"
          >
            {{ $t('settings.general.check_now') }}
          </button>
        </div>
      </div>

      <div class="mgen-spacer" />
    </div>
  </section>
</template>

<style scoped>
.mgen button {
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  color: inherit;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.mgen input, .mgen select {
  -webkit-appearance: none;
  appearance: none;
  outline: none;
}
.mgen {
  --mgen-bg: var(--nc-bg);
  --mgen-ink: var(--nc-ink);
  --mgen-body: var(--nc-ink-soft);
  --mgen-mute: var(--nc-ink-faint);
  --mgen-mint: #00D2BE;
  --mgen-surface: rgba(250, 250, 250, 0.04);
  --mgen-stroke: rgba(250, 250, 250, 0.10);
  --mgen-stroke-soft: rgba(250, 250, 250, 0.06);
  --mgen-stroke-icon: rgba(250, 250, 250, 0.08);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mgen-bg);
  color: var(--mgen-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

/* Top bar */
.mgen-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.mgen-back {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 4px 4px 0;
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.12em;
  color: var(--mgen-body);
}
.mgen-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.mgen-live-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mgen-mint);
  animation: mgen-pulse 2.4s ease-in-out infinite;
}
@keyframes mgen-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.mgen-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mgen-mint);
}

/* Hero */
.mgen-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px;
  flex-shrink: 0;
}
.mgen-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.12em; color: var(--mgen-mute);
}
.mgen-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.mgen-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.025em; color: var(--mgen-ink);
}
.mgen-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--mgen-mint);
}
.mgen-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 400; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 20px;
  color: var(--mgen-body);
  margin-top: 10px;
}

/* Scroll */
.mgen-scroll {
  flex: 1 1 0; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 0 20px;
  scrollbar-width: none;
}
.mgen-scroll::-webkit-scrollbar { display: none; }

/* Section header */
.mgen-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 4px 10px;
}
.mgen-section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.12em; color: var(--mgen-mute);
}
.mgen-section-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.08em; color: var(--mgen-mute);
}
.mgen-section-status--mint { color: var(--mgen-mint); }

/* Theme tiles */
.mgen-tiles {
  display: flex; gap: 10px;
}
.mgen-tile {
  flex: 1 1 0;
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px;
  background: var(--mgen-surface);
  border: 1px solid var(--mgen-stroke-soft);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
}
.mgen-tile--on {
  background: rgba(0, 210, 190, 0.08);
  border: 1.5px solid var(--mgen-mint);
}
.mgen-tile-preview {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px; height: 60px;
  border-radius: 8px;
}
.mgen-tile-preview--light { background: #FAFAFA; }
.mgen-tile-preview--dark {
  background: #09090B;
  border: 1px solid var(--mgen-stroke);
}
.mgen-tile-preview--auto {
  display: flex; flex-direction: row; gap: 0;
  height: 60px; padding: 0;
  border-radius: 8px; overflow: hidden;
}
.mgen-tile-half { flex: 1 1 0; }
.mgen-tile-half--light { background: #FAFAFA; }
.mgen-tile-half--dark { background: #09090B; border-left: 1px solid var(--mgen-stroke); }
.mgen-tile-line { display: block; height: 4px; border-radius: 2px; }
.mgen-tile-line--head { width: 40%; background: #09090B; height: 4px; }
.mgen-tile-line--head-dark { background: #FAFAFA; }
.mgen-tile-line--body { width: 70%; background: #D4D4D8; height: 3px; }
.mgen-tile-line--body-dark { background: #3F3F46; }
.mgen-tile-line--short { width: 55%; }
.mgen-tile-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mgen-mute);
  text-align: center;
}
.mgen-tile-label--on { color: var(--mgen-mint); font-weight: 600; }

/* Card group */
.mgen-card {
  background: var(--mgen-surface);
  border: 1px solid var(--mgen-stroke-soft);
  border-radius: 16px;
  overflow: hidden;
}
.mgen-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: var(--nc-density-row-y, 14px) 16px;
  background: transparent; border: none;
  text-align: left;
  font-family: inherit; color: inherit;
}
.mgen-row--col { flex-direction: column; align-items: stretch; gap: 12px; }
.mgen-row-head {
  display: flex; align-items: center; justify-content: space-between;
}
.mgen-row-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0; min-width: 0;
}
.mgen-row-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em; color: var(--mgen-ink);
}
.mgen-row-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  color: var(--mgen-mint);
  margin-left: 4px;
}
.mgen-row-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 13px;
  letter-spacing: 0.04em; color: var(--mgen-mute);
}
.mgen-row-value {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.04em; color: var(--mgen-body);
  font-variant-numeric: tabular-nums;
}
.mgen-divider { height: 1px; background: var(--mgen-stroke-soft); margin: 0 16px; }

.mgen-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mgen-icon--mint {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.22);
}
.mgen-tile-mini {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mgen-tile-mini-text {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-size: calc(18px * var(--nc-text-scale, 1)); line-height: 18px; color: var(--mgen-ink);
}
.mgen-chev { flex-shrink: 0; }

/* Toggle */
.mgen-toggle {
  position: relative;
  /* Native iOS UISwitch / SwiftUI Toggle geometry: 51×31 pill, 27px knob. */
  width: 51px; height: 31px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #39393D; /* iOS dark off-track */
  cursor: pointer;
  transition: background 200ms cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  display: inline-block;
}
.mgen-toggle-knob {
  position: absolute; left: 2px; top: 2px;
  width: 27px; height: 27px; border-radius: 999px;
  background: #FFFFFF;
  transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16);
}
.mgen-toggle--on {
  background: var(--mgen-mint);
}
.mgen-toggle--on .mgen-toggle-knob {
  transform: translateX(20px);
}

/* Slider */
.mgen-slider {
  display: flex; align-items: center; gap: 12px;
}
.mgen-slider-cap {
  background: none; border: none; cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--mgen-mute);
  flex-shrink: 0;
}
.mgen-slider-cap--sm { font-size: calc(11px * var(--nc-text-scale, 1)); font-weight: 600; }
.mgen-slider-cap--lg { font-size: calc(17px * var(--nc-text-scale, 1)); font-weight: 700; color: var(--mgen-ink); }
.mgen-slider-track {
  position: relative; flex: 1 1 0;
  height: 4px; border-radius: 999px;
  background: rgba(250, 250, 250, 0.08);
}
.mgen-slider-fill {
  position: absolute; left: 0; top: 0;
  height: 4px; border-radius: 999px;
  background: var(--mgen-mint);
  transition: width 180ms ease;
}
.mgen-slider-knob {
  position: absolute; top: -6px;
  width: 16px; height: 16px;
  border-radius: 999px; background: #FAFAFA;
  box-shadow: 0 0 0 4px rgba(0, 210, 190, 0.22);
  transition: left 180ms ease;
}
.mgen-slider-step {
  position: absolute; top: -10px;
  width: 24px; height: 24px;
  background: transparent; border: none; cursor: pointer;
  margin-left: -12px;
}
.mgen-slider-step:nth-of-type(1) { left: 0; }
.mgen-slider-step--mid { left: 50%; }
.mgen-slider-step--end { left: 100%; }

/* Segmented */
.mgen-seg {
  display: flex; padding: 3px;
  background: var(--mgen-bg);
  border: 1px solid var(--mgen-stroke);
  border-radius: 10px;
  flex-shrink: 0;
}
.mgen-seg-btn {
  padding: 5px 11px;
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mgen-mute);
  border-radius: 7px;
}
.mgen-seg-btn--on {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.22);
  color: var(--mgen-mint);
  font-weight: 600;
}

/* Updates — Check now button (AER-14) */
.mgen-update-btn {
  flex-shrink: 0;
  padding: 7px 12px;
  background: var(--mgen-bg);
  border: 1px solid var(--mgen-stroke);
  border-radius: 8px;
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500;
  font-size: calc(10px * var(--nc-text-scale, 1));
  line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mgen-body);
  text-transform: uppercase;
  transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
}
.mgen-update-btn:hover:not(:disabled) {
  color: var(--mgen-mint);
  border-color: rgba(0, 210, 190, 0.30);
  background: rgba(0, 210, 190, 0.06);
}
.mgen-update-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mgen-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}

/* Light theme */
:root.light .mgen {
  /* White-on-dark overlays become black-on-light so subtle surfaces/strokes
     stay legible against the warm-paper background. */
  --mgen-surface: rgba(17, 17, 17, 0.03);
  --mgen-stroke: rgba(17, 17, 17, 0.10);
  --mgen-stroke-soft: rgba(17, 17, 17, 0.06);
  --mgen-stroke-icon: rgba(17, 17, 17, 0.08);
}
:root.light .mgen-icon,
:root.light .mgen-tile-mini {
  background: rgba(17, 17, 17, 0.03);
  border-color: rgba(17, 17, 17, 0.08);
}
:root.light .mgen-toggle {
  background: rgba(120, 120, 128, 0.28);
}
:root.light .mgen-slider-track {
  background: rgba(17, 17, 17, 0.08);
}
</style>
