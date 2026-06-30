<script setup lang="ts">
/**
 * Mobile Settings — Personal (Dark)
 * Paper artboard KTB-0 ("Mobile iOS — Settings: Personal").
 * Profile card with bio, Language card, Defaults card.
 */
import { computed, ref } from 'vue'
import { safeImageUrl } from '~/utils/safeUrl'

const { t } = useI18n()

interface UserLike {
  name?: string | null
  email?: string | null
  image?: string | null
}

const props = defineProps<{
  user: UserLike | null | undefined
  userInitial: string
  locale: string
  i18nLocales: Array<{ code: string; name: string }>
}>()

const emit = defineEmits<{
  back: []
  'set-locale': [code: string]
  'edit-profile': []
}>()

const avatarSrc = computed(() => safeImageUrl(props.user?.image))
const displayName = computed(() => props.user?.name || 'Guest')
const handle = computed(() => {
  const n = props.user?.name || ''
  return '@' + (n.split(' ')[0] || 'guest').toLowerCase()
})
const email = computed(() => props.user?.email || 'local@device')

const localeName = computed(() => {
  const found = props.i18nLocales.find(l => l.code === props.locale)
  return (found?.name || 'English').toUpperCase()
})

const localeLabel = computed(() => {
  if (props.locale === 'hr') return 'EN · HR'
  return 'EN'
})

const productLetters = ref(true)
const publicProfile = ref(false)
const layout = ref<'radial' | 'tree'>('radial')
</script>

<template>
  <section class="mper" :aria-label="t('mobile.settingsPersonal.ariaSection')">
    <header class="mper-top">
      <button class="mper-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ t('mobile.settingsPersonal.back') }}</span>
      </button>
      <div class="mper-live">
        <span class="mper-live-dot" />
        <span class="mper-live-label">{{ localeLabel }}</span>
      </div>
    </header>

    <div class="mper-hero">
      <span class="mper-eyebrow">03 — {{ t('mobile.settingsPersonal.eyebrow') }}</span>
      <h1 class="mper-hero-line">
        <span class="mper-hero-sans">{{ t('mobile.settingsPersonal.heroLineSans') }}</span>
        <span class="mper-hero-serif">{{ t('mobile.settingsPersonal.heroLineSerif') }}</span>
      </h1>
      <span class="mper-hero-meta">{{ t('mobile.settingsPersonal.heroMeta') }}</span>
    </div>

    <div class="mper-scroll">
      <!-- PROFILE -->
      <div class="mper-section-head">
        <span class="mper-section-label">{{ t('mobile.settingsPersonal.profileLabel') }}</span>
        <span class="mper-section-status">{{ t('mobile.settingsPersonal.profileStatus') }}</span>
      </div>
      <div class="mper-profile-card">
        <div class="mper-identity">
          <div class="mper-avatar">
            <img v-if="avatarSrc" :src="avatarSrc" :alt="displayName" class="mper-avatar-img" referrerpolicy="no-referrer">
            <span v-else class="mper-avatar-letter">{{ userInitial }}</span>
          </div>
          <div class="mper-identity-info">
            <span class="mper-identity-name">{{ displayName }}</span>
            <span class="mper-identity-handle">{{ handle }}</span>
            <span class="mper-identity-email">{{ email }}</span>
          </div>
        </div>

        <div class="mper-divider mper-divider--full" />

        <div class="mper-bio">
          <span class="mper-bio-label">{{ t('mobile.settingsPersonal.bioLabel') }}</span>
          <span class="mper-bio-text">{{ t('mobile.settingsPersonal.bioText') }}</span>
        </div>

        <div class="mper-actions">
          <button class="mper-action mper-action--primary" type="button" @click="emit('edit-profile')">{{ t('mobile.settingsPersonal.editProfile') }}</button>
          <button class="mper-action mper-action--icon" type="button" :aria-label="t('mobile.settingsPersonal.avatarAria')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="3" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M5 21V19C5 16.79 6.79 15 9 15H15C17.21 15 19 16.79 19 19V21" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <!-- LANGUAGE -->
      <div class="mper-section-head">
        <span class="mper-section-label">{{ t('mobile.settingsPersonal.languageLabel') }}</span>
        <span class="mper-section-status">{{ t('mobile.settingsPersonal.languageStatus') }}</span>
      </div>
      <div class="mper-card">
        <div class="mper-row">
          <div class="mper-icon">
            <span class="mper-icon-text">{{ locale.toUpperCase() }}</span>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">{{ t('mobile.settingsPersonal.interfaceTitle') }}</span>
            <span class="mper-row-hint">{{ localeName }}</span>
          </div>
          <select
            :value="locale"
            class="mper-select"
            @change="emit('set-locale', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="loc in i18nLocales" :key="loc.code" :value="loc.code">{{ loc.name }}</option>
          </select>
        </div>

        <div class="mper-divider" />

        <div class="mper-row">
          <div class="mper-icon mper-icon--mint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3L13.8 8.2L19 10L13.8 11.8L12 17L10.2 11.8L5 10L10.2 8.2L12 3Z" stroke="#00D2BE" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">
              {{ t('mobile.settingsPersonal.aiPromptsTitle') }}
              <span class="mper-row-italic">{{ t('mobile.settingsPersonal.aiPromptsAccent') }}</span>
            </span>
            <span class="mper-row-hint">{{ t('mobile.settingsPersonal.aiPromptsHint') }}</span>
          </div>
          <svg class="mper-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="mper-divider" />

        <div class="mper-row">
          <div class="mper-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M3 12H21M12 3C14.5 6 14.5 18 12 21C9.5 18 9.5 6 12 3Z" stroke="#A1A1AA" stroke-width="1.6" />
            </svg>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">{{ t('mobile.settingsPersonal.regionTitle') }}</span>
            <span class="mper-row-hint">{{ t('mobile.settingsPersonal.regionHint') }}</span>
          </div>
          <svg class="mper-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>

      <!-- DEFAULTS -->
      <div class="mper-section-head">
        <span class="mper-section-label">{{ t('mobile.settingsPersonal.defaultsLabel') }}</span>
        <span class="mper-section-status">{{ t('mobile.settingsPersonal.defaultsStatus') }}</span>
      </div>
      <div class="mper-card">
        <div class="mper-row">
          <div class="mper-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="2.5" stroke="#A1A1AA" stroke-width="1.6" />
              <circle cx="18" cy="6" r="2.5" stroke="#A1A1AA" stroke-width="1.6" />
              <circle cx="6" cy="18" r="2.5" stroke="#A1A1AA" stroke-width="1.6" />
              <circle cx="18" cy="18" r="2.5" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M6 8.5V15.5M8.5 6H15.5M8.5 18H15.5M18 8.5V15.5" stroke="#A1A1AA" stroke-width="1.6" />
            </svg>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">{{ t('mobile.settingsPersonal.defaultWorkspaceTitle') }}</span>
            <span class="mper-row-hint">{{ t('mobile.settingsPersonal.defaultWorkspaceHint', { n: 8 }) }}</span>
          </div>
          <svg class="mper-chev" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <div class="mper-divider" />

        <div class="mper-row">
          <div class="mper-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M3 9H21M9 21V9" stroke="#A1A1AA" stroke-width="1.6" />
            </svg>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">{{ t('mobile.settingsPersonal.layoutTitle') }}</span>
            <span class="mper-row-hint">{{ t('mobile.settingsPersonal.layoutHint') }}</span>
          </div>
          <div class="mper-seg">
            <button
              class="mper-seg-btn"
              :class="{ 'mper-seg-btn--on': layout === 'radial' }"
              type="button"
              @click="layout = 'radial'"
            >{{ t('mobile.settingsPersonal.layoutRadial') }}</button>
            <button
              class="mper-seg-btn"
              :class="{ 'mper-seg-btn--on': layout === 'tree' }"
              type="button"
              @click="layout = 'tree'"
            >{{ t('mobile.settingsPersonal.layoutTree') }}</button>
          </div>
        </div>

        <div class="mper-divider" />

        <div class="mper-row">
          <div class="mper-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M3 12H21M12 3C14.5 6 14.5 18 12 21C9.5 18 9.5 6 12 3Z" stroke="#A1A1AA" stroke-width="1.6" />
            </svg>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">{{ t('mobile.settingsPersonal.publicProfileTitle') }}</span>
            <span class="mper-row-hint">{{ t('mobile.settingsPersonal.publicProfileHint', { handle: handle.slice(1) }) }}</span>
          </div>
          <button
            class="mper-toggle"
            :class="{ 'mper-toggle--on': publicProfile }"
            type="button"
            @click="publicProfile = !publicProfile"
          >
            <span class="mper-toggle-knob" />
          </button>
        </div>

        <div class="mper-divider" />

        <div class="mper-row">
          <div class="mper-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="6" width="18" height="13" rx="2" stroke="#A1A1AA" stroke-width="1.6" />
              <path d="M4 7L12 13L20 7" stroke="#A1A1AA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="mper-row-text">
            <span class="mper-row-title">{{ t('mobile.settingsPersonal.productLettersTitle') }}</span>
            <span class="mper-row-hint">{{ t('mobile.settingsPersonal.productLettersHint') }}</span>
          </div>
          <button
            class="mper-toggle"
            :class="{ 'mper-toggle--on': productLetters }"
            type="button"
            @click="productLetters = !productLetters"
          >
            <span class="mper-toggle-knob" />
          </button>
        </div>
      </div>

      <div class="mper-spacer" />
    </div>
  </section>
</template>

<style scoped>
.mper button {
  -webkit-appearance: none;
  appearance: none;
  font: inherit;
  color: inherit;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.mper input, .mper select {
  -webkit-appearance: none;
  appearance: none;
  outline: none;
}
.mper {
  --mper-bg: var(--nc-bg);
  --mper-ink: var(--nc-ink);
  --mper-body: var(--nc-ink-soft);
  --mper-mute: var(--nc-ink-faint);
  --mper-mint: #00D2BE;
  --mper-surface: rgba(250, 250, 250, 0.04);
  --mper-stroke: rgba(250, 250, 250, 0.10);
  --mper-stroke-soft: rgba(250, 250, 250, 0.06);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mper-bg);
  color: var(--mper-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

.mper-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  flex-shrink: 0;
}
.mper-back {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 4px 4px 0;
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--mper-body);
}
.mper-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.mper-live-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mper-mint);
  animation: mper-pulse 2.4s ease-in-out infinite;
}
@keyframes mper-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.mper-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--mper-mint);
}

.mper-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px; flex-shrink: 0;
}
.mper-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--mper-mute);
}
.mper-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.mper-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.025em; color: var(--mper-ink);
}
.mper-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--mper-mint);
}
.mper-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 20px;
  color: var(--mper-body); margin-top: 10px;
}

.mper-scroll {
  flex: 1 1 0; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  padding: 0 20px;
  scrollbar-width: none;
}
.mper-scroll::-webkit-scrollbar { display: none; }

.mper-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 24px 4px 10px;
}
.mper-section-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--mper-mute);
}
.mper-section-status {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--mper-mute);
}

/* Profile card */
.mper-profile-card {
  display: flex; flex-direction: column; gap: 14px;
  padding: 18px;
  background: var(--mper-surface);
  border: 1px solid var(--mper-stroke-soft);
  border-radius: 16px;
}
.mper-identity { display: flex; align-items: center; gap: 14px; }
.mper-avatar {
  width: 64px; height: 64px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.16);
  border: 1px solid rgba(0, 210, 190, 0.30);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.mper-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.mper-avatar-letter {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic;
  font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 30px;
  color: var(--mper-mint);
}
.mper-identity-info {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0; min-width: 0;
}
.mper-identity-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: calc(18px * var(--nc-text-scale, 1)); line-height: 22px;
  letter-spacing: -0.015em; color: var(--mper-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mper-identity-handle {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-body);
}
.mper-identity-email {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-mute);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mper-divider { height: 1px; background: var(--mper-stroke-soft); margin: 0 16px; }
.mper-divider--full { margin: 0; }
.mper-bio { display: flex; flex-direction: column; gap: 6px; }
.mper-bio-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  color: var(--mper-mute);
}
.mper-bio-text {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-size: calc(17px * var(--nc-text-scale, 1)); line-height: 22px;
  color: var(--mper-ink);
}
.mper-actions { display: flex; gap: 8px; }
.mper-action {
  flex: 1 1 auto;
  padding: 10px;
  background: var(--mper-surface);
  border: 1px solid var(--mper-stroke);
  border-radius: 10px;
  cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 600; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.10em;
  color: var(--mper-body);
  text-align: center;
}
.mper-action--primary {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
  color: var(--mper-mint);
}
.mper-action--icon {
  flex: 0 0 auto; padding: 10px 14px;
  display: flex; align-items: center; justify-content: center;
}

/* Card */
.mper-card {
  background: var(--mper-surface);
  border: 1px solid var(--mper-stroke-soft);
  border-radius: 16px;
  overflow: hidden;
}
.mper-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
}
.mper-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mper-icon--mint {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
}
.mper-icon-text {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 700; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-ink);
}
.mper-row-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0; min-width: 0;
}
.mper-row-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em; color: var(--mper-ink);
}
.mper-row-italic {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; color: var(--mper-mint);
  margin-left: 4px;
}
.mper-row-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-mute);
}
.mper-chev { flex-shrink: 0; }

.mper-select {
  background: var(--mper-bg);
  border: 1px solid var(--mper-stroke);
  border-radius: 8px;
  padding: 6px 10px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-body);
  flex-shrink: 0;
}

.mper-seg {
  display: flex; padding: 3px;
  background: var(--mper-bg);
  border: 1px solid var(--mper-stroke);
  border-radius: 10px; flex-shrink: 0;
}
.mper-seg-btn {
  padding: 5px 10px;
  background: none; border: none; cursor: pointer;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--mper-mute);
  border-radius: 7px;
}
.mper-seg-btn--on {
  background: rgba(0, 210, 190, 0.10);
  border: 1px solid rgba(0, 210, 190, 0.28);
  color: var(--mper-mint);
  font-weight: 600;
}

.mper-toggle {
  position: relative;
  width: 40px; height: 23px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: #48484A;
  cursor: pointer; flex-shrink: 0;
  transition: background 220ms cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}
.mper-toggle-knob {
  position: absolute; left: 2px; top: 2px;
  width: 19px; height: 19px; border-radius: 999px;
  background: #FFFFFF;
  transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28), 0 1px 1px rgba(0, 0, 0, 0.12);
}
.mper-toggle--on { background: var(--mper-mint); }
.mper-toggle--on .mper-toggle-knob { transform: translateX(17px); }

.mper-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}

/* Light theme */
:root.light .mper {
  /* White-on-dark overlays read as invisible on warm paper — swap to dark-on-light */
  --mper-surface: rgba(17, 17, 17, 0.04);
  --mper-stroke: rgba(17, 17, 17, 0.12);
  --mper-stroke-soft: rgba(17, 17, 17, 0.07);
}
:root.light .mper-icon {
  background: rgba(17, 17, 17, 0.04);
  border-color: rgba(17, 17, 17, 0.08);
}
:root.light .mper-toggle {
  background: #E9E9EA;
}
</style>
