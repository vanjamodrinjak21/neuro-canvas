<script setup lang="ts">
/**
 * Mobile Dashboard (Dark) — implementation of Paper artboards
 * G13-0 (iOS 390×844) and GJJ-0 (Android 412×915).
 *
 * Single layout, platform-tuned via :root.platform-ios / :root.platform-android.
 */

import { safeImageUrl } from '~/utils/safeUrl'
import { resolveDisplayName } from '~/utils/userDisplay'
import { useQuickCapture } from '~/composables/useQuickCapture'

interface MapItem {
  id: string
  title: string
  nodes?: unknown
  edges?: unknown
  updatedAt: number
}

interface UserLike {
  name?: string | null
  email?: string | null
  image?: string | null
}

const props = defineProps<{
  user: UserLike | null | undefined
  userInitials: string
  recentMaps: MapItem[]
  totalMaps: number
  totalNodes: number
  isCreatingMap?: boolean
  isLoading?: boolean
}>()

const avatarSrc = computed(() => safeImageUrl(props.user?.image))

const emit = defineEmits<{
  newMap: []
  openMap: [id: string]
  openAi: []
  openSettings: []
  seeAll: []
}>()

const { t } = useI18n()
const { haptics } = usePlatform()

// First map = "Currently editing" highlight card; rest = recent list
const continueMap = computed<MapItem | null>(() => props.recentMaps[0] ?? null)
const recentRows = computed<MapItem[]>(() => props.recentMaps.slice(1, 3))

function countOf(items: unknown): number {
  if (Array.isArray(items)) return items.length
  if (items && typeof items === 'object') return Object.keys(items).length
  return 0
}

function relTime(ts: number): string {
  const ms = Date.now() - ts
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(ms / 86_400_000)
  if (h < 1) return 'JUST NOW'
  if (h < 24) return `${h}H AGO`
  if (d === 1) return 'YESTERDAY'
  if (d < 7) return `${d}D AGO`
  if (d < 30) return `${Math.floor(d / 7)}W AGO`
  return new Date(ts).toLocaleDateString().toUpperCase()
}

const sinceEdit = computed(() => {
  const latest = props.recentMaps[0]?.updatedAt
  if (!latest) return '—'
  const ms = Date.now() - latest
  const min = Math.floor(ms / 60_000)
  const h = Math.floor(ms / 3_600_000)
  const d = Math.floor(ms / 86_400_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return `${Math.floor(d / 7)}w`
})

function onNew() {
  haptics.impact('medium')
  emit('newMap')
}
function onResume() {
  if (continueMap.value) {
    haptics.selection()
    emit('openMap', continueMap.value.id)
  }
}
function onRow(id: string) {
  haptics.selection()
  emit('openMap', id)
}

const quickCapture = useQuickCapture()
function onCapture() {
  haptics.selection()
  quickCapture.open()
}
</script>

<template>
  <section class="mdash" :aria-label="t('mobile.dashboard.dashboardAria')">
    <!-- 01. Top bar — brand mark + quick capture + avatar -->
    <header class="mdash-top">
      <div class="mdash-brand" aria-label="NeuroCanvas">
        <NcLogo :size="14" :container-size="26" :radius="6" />
        <span class="mdash-wordmark">Neuro<span class="mdash-wordmark-em">Canvas</span></span>
      </div>
      <div class="mdash-top-right">
        <!-- Quick-capture (AER-70): drop a thought / link into the Inbox map.
             Opens the globally-mounted MobileQuickCaptureSheet via shared state. -->
        <button
          type="button"
          class="mdash-capture"
          :aria-label="t('mobile.capture.action')"
          @click="onCapture"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 3V17M3 10H17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>
        <NuxtLink to="/settings" class="mdash-avatar" :aria-label="t('common.nav.settings')">
          <img v-if="avatarSrc" :src="avatarSrc" :alt="user?.name || ''" class="mdash-avatar-img" referrerpolicy="no-referrer">
          <span v-else>{{ userInitials }}</span>
        </NuxtLink>
      </div>
    </header>

    <!-- 02. Editorial hero — mono breadcrumb + Welcome / Vanja. + inline stats -->
    <div class="mdash-hero">
      <div class="mdash-eyebrow">01 — {{ t('common.nav.maps').toUpperCase() }}</div>
      <h1 class="mdash-hero-line">
        <span class="mdash-hero-sans">{{ t('mobile.dashboard.welcomeBack') }}</span>
        <span class="mdash-hero-serif">{{ resolveDisplayName(user, t('mobile.dashboard.fallbackName')).split(' ')[0] }}.</span>
      </h1>
      <div class="mdash-stats">
        <div class="mdash-stat">
          <span class="mdash-stat-num">{{ totalMaps }}</span>
          <span class="mdash-stat-label">{{ t('mobile.dashboard.maps') }}</span>
        </div>
        <span class="mdash-stat-sep" />
        <div class="mdash-stat">
          <span class="mdash-stat-num">{{ totalNodes }}</span>
          <span class="mdash-stat-label">{{ t('mobile.dashboard.nodes') }}</span>
        </div>
        <span class="mdash-stat-sep" />
        <div class="mdash-stat">
          <span class="mdash-stat-num">{{ sinceEdit }}</span>
          <span class="mdash-stat-label">{{ t('mobile.dashboard.sinceEdit') }}</span>
        </div>
      </div>
    </div>

    <!-- 03a. Skeleton state — server pull in flight -->
    <template v-if="isLoading && !continueMap">
      <div class="mdash-skel mdash-skel-continue" aria-hidden="true">
        <div class="mdash-skel-thumb mdash-skel-shimmer" />
        <div class="mdash-skel-meta">
          <div class="mdash-skel-line mdash-skel-shimmer mdash-skel-line-a" />
          <div class="mdash-skel-line mdash-skel-shimmer mdash-skel-line-b" />
          <div class="mdash-skel-line mdash-skel-shimmer mdash-skel-line-c" />
        </div>
      </div>
      <div class="mdash-section">
        <div class="mdash-section-eyebrow">
          <span class="mdash-eyebrow-strong">{{ t('mobile.dashboard.recentEyebrow') }}</span>
          <span class="mdash-eyebrow-faint">{{ t('mobile.dashboard.loading') }}</span>
        </div>
      </div>
      <div class="mdash-list">
        <div v-for="n in 3" :key="`sk-${n}`" class="mdash-skel-row">
          <div class="mdash-skel-thumb mdash-skel-thumb-sm mdash-skel-shimmer" />
          <div class="mdash-skel-meta">
            <div class="mdash-skel-line mdash-skel-shimmer mdash-skel-line-d" />
            <div class="mdash-skel-line mdash-skel-shimmer mdash-skel-line-e" />
          </div>
        </div>
      </div>
    </template>

    <!-- 03. Accent "Currently editing" card -->
    <button
      v-if="!isLoading && continueMap"
      type="button"
      class="mdash-continue"
      @click="onResume"
    >
      <div class="mdash-continue-thumb">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
          <line x1="9" y1="11" x2="16" y2="16" stroke-width="1.2" />
          <line x1="23" y1="9" x2="16" y2="16" stroke-width="1.2" />
          <line x1="16" y1="16" x2="11" y2="23" stroke-width="1.2" />
          <line x1="16" y1="16" x2="22" y2="22" stroke-width="1.2" />
          <circle cx="9" cy="11" r="2" />
          <circle cx="23" cy="9" r="2" />
          <circle cx="16" cy="16" r="2.5" />
          <circle cx="11" cy="23" r="2" />
          <circle cx="22" cy="22" r="2" />
        </svg>
      </div>
      <div class="mdash-continue-body">
        <span class="mdash-continue-eyebrow">{{ t('mobile.dashboard.currentlyEditing') }}</span>
        <span class="mdash-continue-title">{{ continueMap.title || t('mobile.dashboard.untitledMap') }}</span>
        <span class="mdash-continue-meta">
          {{ t('mobile.dashboard.nodesResume', { n: countOf(continueMap.nodes) }) }}
        </span>
      </div>
      <div class="mdash-continue-resume" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </button>

    <!-- 04. Section header — RECENT · X of Y · See all -->
    <div v-if="!isLoading" class="mdash-section">
      <div class="mdash-section-eyebrow">
        <span class="mdash-eyebrow-strong">{{ t('mobile.dashboard.recentEyebrow') }}</span>
        <span class="mdash-eyebrow-faint">{{ t('mobile.dashboard.countOf', { count: Math.min(recentRows.length, totalMaps), total: totalMaps }) }}</span>
      </div>
      <button type="button" class="mdash-see-all" @click="emit('seeAll')">{{ t('mobile.dashboard.seeAll') }}</button>
    </div>

    <!-- 05. Recent list — flat surface rows + hairline -->
    <div v-if="!isLoading" class="mdash-list">
      <button
        v-for="m in recentRows"
        :key="m.id"
        type="button"
        class="mdash-row"
        @click="onRow(m.id)"
      >
        <div class="mdash-row-thumb">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <line x1="9" y1="11" x2="16" y2="16" />
            <line x1="23" y1="9" x2="16" y2="16" />
            <line x1="16" y1="16" x2="11" y2="23" />
            <line x1="16" y1="16" x2="22" y2="22" />
            <circle cx="9" cy="11" r="2" />
            <circle cx="23" cy="9" r="2" />
            <circle cx="16" cy="16" r="2.5" />
            <circle cx="11" cy="23" r="2" />
            <circle cx="22" cy="22" r="2" />
          </svg>
        </div>
        <div class="mdash-row-meta">
          <span class="mdash-row-title">{{ m.title || t('mobile.dashboard.untitledMap') }}</span>
          <span class="mdash-row-sub">{{ t('mobile.dashboard.nodesCount', { n: countOf(m.nodes) }) }} · {{ relTime(m.updatedAt) }}</span>
        </div>
        <svg class="mdash-row-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Empty state -->
      <div v-if="recentRows.length === 0 && !continueMap" class="mdash-empty">
        <span>{{ t('mobile.dashboard.emptyState') }}</span>
      </div>
    </div>

    <!-- 06. Floating accent FAB ( + new map ) -->
    <button
      type="button"
      class="mdash-fab"
      :disabled="isCreatingMap"
      :aria-label="t('dashboard.buttons.new_map')"
      @click="onNew"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 4V16M4 10H16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      </svg>
    </button>
  </section>
</template>

<style scoped>
/* ──────────────────────────────────────────────────────────────────────
 * Tokens — all values flow from tokens.css (REDESIGN.md §1/§2), so the
 * component is theme-aware without per-mode override blocks.
 * ────────────────────────────────────────────────────────────────────── */
.mdash {
  --mdash-bg: var(--nc-bg);
  --mdash-ink: var(--nc-ink);
  --mdash-body: var(--nc-ink-soft);
  --mdash-mute: var(--nc-ink-faint);
  --mdash-mint: var(--nc-accent);
  --mdash-surface: var(--nc-chip-bg);
  --mdash-stroke: var(--nc-border);
  --mdash-stroke-soft: var(--nc-border-subtle);

  /* Pin the screen — header sticks, only the recent list scrolls, dock fixed */
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mdash-bg);
  color: var(--mdash-ink);
  font-family: var(--nc-font-body);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  overscroll-behavior: none;
  z-index: 10;
}

/* ── 01. Top bar ─────────────────────────────────────────────────────── */
.mdash-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  box-sizing: border-box;
}
.mdash-brand { display: flex; align-items: center; gap: 10px; }
.mdash-wordmark {
  font-family: var(--nc-font-serif);
  font-weight: 400;
  font-size: calc(19px * var(--nc-text-scale, 1));
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--mdash-ink);
}
.mdash-wordmark-em {
  font-style: italic;
  color: var(--mdash-mint);
}
.mdash-top-right { display: flex; align-items: center; gap: 10px; }

.mdash-capture {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 999px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  color: var(--mdash-mint);
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), border-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Expand hit area to the 44px minimum without growing the visual */
.mdash-capture::before {
  content: '';
  position: absolute;
  inset: -6px;
}
.mdash-capture:active { transform: scale(0.97); background: var(--nc-surface-3); }

.mdash-avatar {
  position: relative;
  width: 32px; height: 32px;
  border-radius: 999px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mdash-stroke);
  display: flex; align-items: center; justify-content: center;
  color: var(--mdash-ink);
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 16px;
  text-decoration: none;
  flex-shrink: 0;
}
/* Expand hit area to the 44px minimum (clipping lives on the img, not the link) */
.mdash-avatar::before {
  content: '';
  position: absolute;
  inset: -6px;
}
.mdash-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 999px; }

/* ── 02. Editorial hero ──────────────────────────────────────────────── */
.mdash-hero {
  display: flex; flex-direction: column;
  width: 100%;
  padding: 36px 20px 0 20px;
  box-sizing: border-box;
}
.mdash-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mdash-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 0 0;
  padding: 0;
  font-weight: 500;
}
.mdash-hero-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(34px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em;
  color: var(--mdash-ink);
}
.mdash-hero-serif {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(44px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em;
  color: var(--nc-accent-text);
}

.mdash-stats {
  display: flex; align-items: center; gap: 14px;
  margin-top: 18px;
}
.mdash-stat { display: flex; align-items: baseline; gap: 6px; }
.mdash-stat-num {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  color: var(--mdash-ink);
}
.mdash-stat-label {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.08em;
  color: var(--mdash-mute);
}
.mdash-stat-sep {
  width: 1px; height: 12px;
  background: var(--mdash-stroke);
  flex-shrink: 0;
}

/* ── 03. Accent "Currently editing" card ─────────────────────────────── */
.mdash-continue {
  display: flex; align-items: center; gap: 14px;
  margin: 28px 20px 0 20px;
  padding: 14px 16px;
  background: var(--mdash-mint);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  width: auto;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms var(--nc-ease);
}
.mdash-continue:active { transform: scale(0.97); }

.mdash-continue-thumb {
  width: 52px; height: 52px;
  border-radius: 0.4rem;
  background: rgba(var(--nc-bg-rgb), 0.12);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mdash-continue-thumb line { stroke: rgba(var(--nc-bg-rgb), 0.55); }
.mdash-continue-thumb circle { fill: var(--nc-bg); }
.mdash-continue-body {
  display: flex; flex-direction: column;
  flex: 1 1 0;
  gap: 3px;
  min-width: 0;
}
.mdash-continue-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(var(--nc-bg-rgb), 0.65);
}
.mdash-continue-title {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(16px * var(--nc-text-scale, 1)); line-height: 20px;
  letter-spacing: -0.015em;
  color: var(--nc-bg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mdash-continue-meta {
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 16px;
  color: rgba(var(--nc-bg-rgb), 0.65);
}
.mdash-continue-resume {
  width: 36px; height: 36px;
  border-radius: 999px;
  background: var(--nc-bg);
  color: var(--nc-accent-text);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* ── 04. Section header ──────────────────────────────────────────────── */
.mdash-section {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  padding: 32px 20px 14px 20px;
  box-sizing: border-box;
}
.mdash-section-eyebrow { display: flex; align-items: baseline; gap: 8px; }
.mdash-eyebrow-strong {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mdash-eyebrow-faint {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  color: var(--mdash-mute);
}
.mdash-see-all {
  position: relative;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--nc-accent-text);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.mdash-see-all::before {
  content: '';
  position: absolute;
  inset: -13px -8px;
}

/* ── 05. Recent list — only scrollable area ─────────────────────────── */
.mdash-list {
  display: flex; flex-direction: column;
  width: 100%;
  padding: 0 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
  gap: 12px;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  box-sizing: border-box;
}
.mdash-list::-webkit-scrollbar { width: 0; }
.mdash-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px;
  background: var(--mdash-surface);
  border: 1px solid var(--mdash-stroke-soft);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mdash-row:active { transform: scale(0.97); background: var(--nc-surface-3); }
.mdash-row-thumb {
  width: 44px; height: 44px;
  border-radius: 0.4rem;
  background: var(--mdash-surface);
  border: 1px solid var(--mdash-stroke-soft);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mdash-row-thumb line { stroke: var(--nc-text-dim); }
.mdash-row-thumb circle { fill: var(--nc-text-muted); }
.mdash-row-thumb circle:first-of-type { fill: var(--nc-accent); }
.mdash-row-thumb circle:nth-of-type(3) { fill: var(--nc-text); }
.mdash-row-meta {
  display: flex; flex-direction: column;
  flex: 1 1 0;
  gap: 2px;
  min-width: 0;
}
.mdash-row-title {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em;
  color: var(--mdash-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mdash-row-sub {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 13px;
  letter-spacing: 0.04em;
  color: var(--mdash-mute);
}
.mdash-row-chevron { flex-shrink: 0; color: var(--nc-text-dim); }

.mdash-empty {
  padding: 24px 0;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  letter-spacing: 0.06em;
  color: var(--mdash-mute);
  text-align: center;
}

/* ── Skeleton (loading) state ────────────────────────────────────────── */
.mdash-skel-continue {
  display: flex; align-items: center; gap: 14px;
  margin: 28px 20px 0 20px;
  padding: 14px 16px;
  background: var(--mdash-surface);
  border: 1px solid var(--mdash-stroke-soft);
  border-radius: 0.5rem;
}
.mdash-skel-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px;
  background: var(--mdash-surface);
  border: 1px solid var(--mdash-stroke-soft);
  border-radius: 0.5rem;
}
.mdash-skel-thumb {
  width: 52px; height: 52px;
  border-radius: 0.4rem;
  flex-shrink: 0;
}
.mdash-skel-thumb-sm { width: 44px; height: 44px; }
.mdash-skel-meta {
  display: flex; flex-direction: column;
  flex: 1 1 0;
  gap: 6px;
  min-width: 0;
}
.mdash-skel-line {
  height: 11px;
  border-radius: 4px;
}
.mdash-skel-line-a { width: 35%; }
.mdash-skel-line-b { width: 70%; height: 16px; }
.mdash-skel-line-c { width: 45%; }
.mdash-skel-line-d { width: 60%; }
.mdash-skel-line-e { width: 30%; height: 9px; }
.mdash-skel-shimmer {
  background:
    linear-gradient(
      90deg,
      var(--nc-chip-bg) 0%,
      var(--nc-border-subtle) 50%,
      var(--nc-chip-bg) 100%
    );
  background-size: 200% 100%;
  animation: mdash-shimmer 1.4s linear infinite;
}
@keyframes mdash-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mdash-skel-shimmer { animation: none; }
}

/* ── 06. Floating FAB ────────────────────────────────────────────────── */
.mdash-fab {
  position: fixed;
  right: 20px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 108px);
  width: 52px; height: 52px;
  border-radius: 999px;
  background: var(--mdash-mint);
  color: var(--nc-bg);
  border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: var(--nc-shadow-lg);
  z-index: 150;
  transition: transform 150ms var(--nc-ease);
}
.mdash-fab:active { transform: scale(0.97); }
.mdash-fab:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
