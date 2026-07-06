<script setup lang="ts">
/**
 * Mobile Settings — Personal (Dark)
 * Paper artboard KTB-0 ("Mobile iOS — Settings: Personal").
 * Profile identity card and Language card.
 */
import { computed } from 'vue'
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
</script>

<template>
  <section class="mper" :aria-label="t('mobile.settingsPersonal.ariaSection')">
    <header class="mper-top">
      <button class="mper-back" type="button" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ t('mobile.settingsPersonal.back') }}</span>
      </button>
      <div class="mper-live">
        <span class="mper-live-dot" />
        <span class="mper-live-label">{{ localeLabel }}</span>
      </div>
    </header>

    <div class="mper-hero">
      <span class="mper-eyebrow">{{ t('mobile.settingsPersonal.eyebrow') }}</span>
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
/* The reset above kills the UA ring — restore keyboard focus visibility
   per base.css grammar (REDESIGN.md §1). */
.mper button:focus-visible,
.mper select:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 2px;
}
.mper {
  --mper-bg: var(--nc-bg);
  --mper-ink: var(--nc-ink);
  --mper-body: var(--nc-ink-soft);
  --mper-mute: var(--nc-ink-faint);
  --mper-mint: var(--nc-accent);
  --mper-surface: var(--nc-chip-bg);
  --mper-stroke: var(--nc-border);
  --mper-stroke-soft: var(--nc-border-subtle);

  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mper-bg);
  color: var(--mper-ink);
  font-family: var(--nc-font-body);
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
  min-height: 44px;
  padding: 4px 4px 4px 0;
  background: none; border: none; cursor: pointer;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mper-body);
}
.mper-back svg { color: var(--nc-text-muted); }
/* Locale chip — chip grammar (REDESIGN.md §5): chip fill + hairline + accent text */
.mper-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px; border-radius: 999px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mper-stroke);
}
.mper-live-dot {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--mper-mint);
  animation: mper-pulse 2.4s ease-in-out infinite;
}
@keyframes mper-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@media (prefers-reduced-motion: reduce) {
  .mper-live-dot { animation: none; }
}
.mper-live-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--nc-accent-text);
}

.mper-hero {
  display: flex; flex-direction: column;
  padding: 18px 20px 0 20px; flex-shrink: 0;
}
.mper-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mper-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0;
}
.mper-hero-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--mper-ink);
}
.mper-hero-serif {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--nc-accent-text);
}
.mper-hero-meta {
  font-family: var(--nc-font-body);
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
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mper-section-status {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.08em;
  color: var(--mper-mute);
}

/* Profile card */
.mper-profile-card {
  display: flex; flex-direction: column; gap: 14px;
  padding: 18px;
  background: var(--mper-surface);
  border: 1px solid var(--mper-stroke-soft);
  border-radius: 0.5rem;
}
.mper-identity { display: flex; align-items: center; gap: 14px; }
.mper-avatar {
  width: 64px; height: 64px;
  border-radius: 999px;
  background: rgba(var(--nc-accent-rgb), 0.16);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.30);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.mper-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.mper-avatar-letter {
  font-family: var(--nc-font-serif);
  font-style: italic;
  font-size: calc(30px * var(--nc-text-scale, 1)); line-height: 30px;
  color: var(--nc-accent-text);
}
.mper-identity-info {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0; min-width: 0;
}
.mper-identity-name {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(18px * var(--nc-text-scale, 1)); line-height: 22px;
  letter-spacing: -0.015em; color: var(--mper-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mper-identity-handle {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-body);
}
.mper-identity-email {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-mute);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* Card */
.mper-card {
  background: var(--mper-surface);
  border: 1px solid var(--mper-stroke-soft);
  border-radius: 0.5rem;
  overflow: hidden;
}
.mper-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
}
.mper-icon {
  width: 36px; height: 36px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mper-stroke-soft);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mper-icon-text {
  font-family: var(--nc-font-mono);
  font-weight: 700; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-ink);
}
.mper-row-text {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0; min-width: 0;
}
.mper-row-title {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em; color: var(--mper-ink);
}
.mper-row-hint {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-mute);
}

/* Select — input grammar: chip fill + hairline, accent focus border */
.mper-select {
  min-height: 44px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mper-stroke);
  border-radius: 0.5rem;
  padding: 6px 10px;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); letter-spacing: 0.04em;
  color: var(--mper-body);
  flex-shrink: 0;
  cursor: pointer;
  transition: border-color 150ms var(--nc-ease);
}
.mper-select:focus { border-color: var(--nc-accent); }

.mper-spacer {
  height: calc(96px + env(safe-area-inset-bottom, 0px));
  flex-shrink: 0;
}
</style>
