<script setup lang="ts">
/**
 * Mobile All Maps (Dark) — implementation of Paper artboards
 * G46-0 (iOS 390) and GMP-0 (Android 412).
 */
import { safeImageUrl } from '~/utils/safeUrl'

const { t } = useI18n()

interface MapItem {
  id: string
  title: string
  nodes?: unknown
  edges?: unknown
  updatedAt: number
  pinned?: boolean
}

interface UserLike {
  name?: string | null
  email?: string | null
  image?: string | null
}

const props = defineProps<{
  user: UserLike | null | undefined
  userInitials: string
  maps: MapItem[]
  totalCount: number
  pinnedCount?: number
  searchQuery: string
  sortLabel?: string
}>()

const avatarSrc = computed(() => safeImageUrl(props.user?.image))

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'open-map': [id: string]
  'delete-map': [id: string]
  'change-sort': []
  'change-filter': [filter: 'all' | 'recent' | 'pinned' | 'shared' | 'archived']
}>()

type Filter = 'all' | 'recent' | 'pinned' | 'shared' | 'archived'
const activeFilter = ref<Filter>('all')

function setFilter(f: Filter) {
  activeFilter.value = f
  emit('change-filter', f)
}

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

const totalNodes = computed(() =>
  props.maps.reduce((acc, m) => acc + countOf(m.nodes), 0)
)
const totalEdges = computed(() =>
  props.maps.reduce((acc, m) => acc + countOf(m.edges), 0)
)
</script>

<template>
  <section class="mmaps" :aria-label="t('mobile.maps.sectionLabel')">
    <!-- Top bar -->
    <header class="mmaps-top">
      <div class="mmaps-brand" aria-label="NeuroCanvas">
        <NcLogo :size="14" :container-size="26" :radius="6" />
        <span class="mmaps-wordmark">Neuro<span class="mmaps-wordmark-em">Canvas</span></span>
      </div>
      <div class="mmaps-top-right">
        <NuxtLink to="/settings" class="mmaps-avatar" :aria-label="t('mobile.maps.settings')">
          <img v-if="avatarSrc" :src="avatarSrc" :alt="user?.name || ''" class="mmaps-avatar-img" referrerpolicy="no-referrer">
          <span v-else>{{ userInitials }}</span>
        </NuxtLink>
      </div>
    </header>

    <!-- Editorial hero -->
    <div class="mmaps-hero">
      <span class="mmaps-eyebrow">{{ t('mobile.maps.eyebrow') }}</span>
      <h1 class="mmaps-hero-line">
        <span class="mmaps-hero-sans">{{ t('mobile.maps.heroSans') }}</span>
        <span class="mmaps-hero-serif">{{ t('mobile.maps.heroSerif') }}</span>
      </h1>
      <span class="mmaps-hero-meta">
        {{ t('mobile.maps.heroMeta', { maps: totalCount, nodes: totalNodes, edges: totalEdges }) }}
      </span>
    </div>

    <!-- Search + sort -->
    <div class="mmaps-search-row">
      <label class="mmaps-search-input">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4" />
          <path d="M14 14L11 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <input
          :value="searchQuery"
          type="text"
          :placeholder="$t('ui.search.maps_mobile_placeholder')"
          class="mmaps-search-field"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </label>
      <button type="button" class="mmaps-sort-btn" :aria-label="t('mobile.maps.sortAria', { label: sortLabel || t('mobile.maps.sortRecent') })" @click="emit('change-sort')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 4H13M5 8H11M7 12H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <!-- Filter pills (segmented) -->
    <div class="mmaps-pills">
      <button
        type="button"
        class="mmaps-pill"
        :class="{ 'mmaps-pill--active': activeFilter === 'all' }"
        @click="setFilter('all')"
      >
        <span>{{ t('mobile.maps.filterAll') }}</span>
        <span class="mmaps-pill-count">{{ totalCount }}</span>
      </button>
      <button
        type="button"
        class="mmaps-pill"
        :class="{ 'mmaps-pill--active': activeFilter === 'recent' }"
        @click="setFilter('recent')"
      >
        <span>{{ t('mobile.maps.filterRecent') }}</span>
      </button>
      <button
        type="button"
        class="mmaps-pill"
        :class="{ 'mmaps-pill--active': activeFilter === 'pinned' }"
        @click="setFilter('pinned')"
      >
        <span>{{ t('mobile.maps.filterPinned') }}</span>
        <span v-if="pinnedCount" class="mmaps-pill-count">{{ pinnedCount }}</span>
      </button>
      <button
        type="button"
        class="mmaps-pill"
        :class="{ 'mmaps-pill--active': activeFilter === 'shared' }"
        @click="setFilter('shared')"
      >
        <span>{{ t('mobile.maps.filterShared') }}</span>
      </button>
      <button
        type="button"
        class="mmaps-pill"
        :class="{ 'mmaps-pill--active': activeFilter === 'archived' }"
        @click="setFilter('archived')"
      >
        <span>{{ t('mobile.maps.filterArchived') }}</span>
      </button>
    </div>

    <!-- Section header -->
    <div class="mmaps-section">
      <div class="mmaps-section-left">
        <span class="mmaps-section-eyebrow">{{ t('mobile.maps.sortedBy') }}</span>
        <span class="mmaps-section-value">{{ sortLabel || t('mobile.maps.sortRecent') }}</span>
        <svg class="mmaps-section-caret" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <span class="mmaps-section-count">{{ t('mobile.maps.countOf', { shown: maps.length, total: totalCount }) }}</span>
    </div>

    <!-- Map rows -->
    <div class="mmaps-list">
      <div
        v-for="m in maps"
        :key="m.id"
        class="mmaps-row-wrap"
      >
      <button
        type="button"
        class="mmaps-row"
        @click="emit('open-map', m.id)"
      >
        <div class="mmaps-row-thumb">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
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
        <div class="mmaps-row-meta">
          <span class="mmaps-row-title-line">
            <span class="mmaps-row-title">{{ m.title || t('mobile.maps.untitledMap') }}</span>
            <svg v-if="m.pinned" class="mmaps-row-pin" width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 0L7.5 4L11.5 4.5L8.5 7.5L9.5 11.5L6 9.5L2.5 11.5L3.5 7.5L0.5 4.5L4.5 4L6 0Z" />
            </svg>
          </span>
          <span class="mmaps-row-sub">{{ t('mobile.maps.rowSub', { nodes: countOf(m.nodes), time: relTime(m.updatedAt) }) }}</span>
        </div>
      </button>
      <button
        type="button"
        class="mmaps-row-del"
        :aria-label="t('mobile.maps.deleteAria')"
        @click="emit('delete-map', m.id)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H7a1 1 0 01-1-1V6M10 11v6M14 11v6" />
        </svg>
      </button>
      </div>
      <div v-if="maps.length === 0" class="mmaps-empty">
        <span>{{ t('mobile.maps.emptyState') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.mmaps {
  --mmaps-bg: var(--nc-bg);
  --mmaps-ink: var(--nc-ink);
  --mmaps-body: var(--nc-ink-soft);
  --mmaps-mute: var(--nc-ink-faint);
  --mmaps-mint: var(--nc-accent);
  --mmaps-surface: var(--nc-chip-bg);
  --mmaps-stroke: var(--nc-border);
  --mmaps-stroke-soft: var(--nc-border-subtle);

  /* Pin the screen — only the list scrolls, dock stays fixed */
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mmaps-bg);
  color: var(--mmaps-ink);
  font-family: var(--nc-font-body);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  overscroll-behavior: none;
  z-index: 10;
}

/* Top bar */
.mmaps-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 26px) 20px 0 20px;
  box-sizing: border-box;
}
.mmaps-brand { display: flex; align-items: center; gap: 10px; }
.mmaps-wordmark {
  font-family: var(--nc-font-serif);
  font-weight: 400;
  font-size: calc(19px * var(--nc-text-scale, 1));
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--mmaps-ink);
}
.mmaps-wordmark-em {
  font-style: italic;
  color: var(--mmaps-mint);
}
.mmaps-top-right { display: flex; align-items: center; gap: 10px; }

.mmaps-avatar {
  position: relative;
  width: 32px; height: 32px;
  border-radius: 999px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mmaps-stroke);
  display: flex; align-items: center; justify-content: center;
  color: var(--mmaps-ink);
  font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 16px;
  text-decoration: none;
  flex-shrink: 0;
}
/* Expand hit area to the 44px minimum without growing the visual */
.mmaps-avatar::before {
  content: '';
  position: absolute;
  inset: -6px;
}
.mmaps-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 999px; }

/* Editorial hero */
.mmaps-hero { display: flex; flex-direction: column; padding: 28px 20px 0 20px; box-sizing: border-box; }
.mmaps-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mmaps-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0; font-weight: 500;
}
.mmaps-hero-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--mmaps-ink);
}
.mmaps-hero-serif {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--nc-accent-text);
}
.mmaps-hero-meta {
  font-family: var(--nc-font-body);
  font-weight: 400; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 20px;
  color: var(--mmaps-body);
  margin-top: 10px;
}

/* Search row */
.mmaps-search-row {
  display: flex; flex-direction: row; align-items: center; gap: 10px;
  padding: 22px 20px 0 20px;
  width: 100%;
  box-sizing: border-box;
}
.mmaps-search-input {
  display: flex; flex-direction: row; align-items: center; gap: 10px;
  flex: 1 1 0;
  padding: 12px 14px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mmaps-stroke);
  border-radius: 0.5rem;
  min-width: 0;
  cursor: text;
  color: var(--nc-text-dim);
  transition: border-color 150ms var(--nc-ease);
}
.mmaps-search-input:focus-within { border-color: var(--nc-accent); }
.mmaps-search-field {
  flex: 1 1 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 16px;
  letter-spacing: 0.04em;
  color: var(--mmaps-ink);
  caret-color: var(--mmaps-mint);
}
.mmaps-search-field::placeholder { color: var(--nc-text-dim); }
.mmaps-sort-btn {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px;
  border-radius: 0.5rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--mmaps-stroke);
  color: var(--nc-text-muted);
  flex-shrink: 0;
  cursor: pointer;
  transition: background-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mmaps-sort-btn:active { transform: scale(0.97); background: var(--nc-surface-3); }

/* Filter pills */
.mmaps-pills {
  display: flex; flex-direction: row; align-items: center; gap: 8px;
  padding: 14px 20px 0 20px;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  box-sizing: border-box;
}
.mmaps-pills::-webkit-scrollbar { display: none; }
.mmaps-pill {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--mmaps-stroke);
  flex-shrink: 0;
  cursor: pointer;
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 14px;
  color: var(--mmaps-body);
  transition: background-color 120ms var(--nc-ease), color 120ms var(--nc-ease), border-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Vertical hit-area extension to reach the 44px minimum (pills are ~30px) */
.mmaps-pill::before {
  content: '';
  position: absolute;
  inset: -8px 0;
}
.mmaps-pill:active { transform: scale(0.97); }
/* Selection treatment per REDESIGN.md §1: accent background + bg-ink text */
.mmaps-pill--active {
  background: var(--mmaps-mint);
  border-color: var(--mmaps-mint);
  color: var(--nc-bg);
  font-weight: 600;
}
.mmaps-pill-count {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  color: var(--mmaps-mute);
}
.mmaps-pill--active .mmaps-pill-count { color: rgba(var(--nc-bg-rgb), 0.55); }

/* Section header */
.mmaps-section {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  padding: 22px 20px 12px 20px;
  box-sizing: border-box;
}
.mmaps-section-left { display: flex; align-items: baseline; gap: 8px; }
.mmaps-section-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.mmaps-section-value {
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 14px;
  color: var(--mmaps-ink);
}
.mmaps-section-caret { color: var(--nc-text-muted); }
.mmaps-section-count {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  color: var(--mmaps-mute);
}

/* Map rows — the only scrollable area */
.mmaps-list {
  display: flex; flex-direction: column; gap: 10px;
  padding: 0 20px calc(env(safe-area-inset-bottom, 0px) + 96px);
  width: 100%;
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  box-sizing: border-box;
}
.mmaps-list::-webkit-scrollbar { width: 0; }
.mmaps-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--mmaps-surface);
  border: 1px solid var(--mmaps-stroke-soft);
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
  text-align: left;
  transition: background-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
  -webkit-tap-highlight-color: transparent;
}
.mmaps-row:active { transform: scale(0.97); background: var(--nc-surface-3); }
.mmaps-row-thumb {
  width: 42px; height: 42px;
  border-radius: 0.4rem;
  background: var(--mmaps-surface);
  border: 1px solid var(--mmaps-stroke-soft);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mmaps-row-thumb line { stroke: var(--nc-text-dim); }
.mmaps-row-thumb circle { fill: var(--nc-text-muted); }
.mmaps-row-thumb circle:first-of-type { fill: var(--nc-accent); }
.mmaps-row-thumb circle:nth-of-type(3) { fill: var(--nc-text); }
.mmaps-row-meta {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0;
  min-width: 0;
}
.mmaps-row-title-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mmaps-row-title {
  font-family: var(--nc-font-body);
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em;
  color: var(--mmaps-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mmaps-row-pin { flex-shrink: 0; color: var(--nc-accent-text); }
.mmaps-row-sub {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 13px;
  letter-spacing: 0.04em;
  color: var(--mmaps-mute);
}
.mmaps-row-wrap { position: relative; width: 100%; }
.mmaps-row-wrap .mmaps-row { width: 100%; padding-right: 52px; box-sizing: border-box; }
.mmaps-row-del {
  position: absolute; top: 50%; right: 4px; transform: translateY(-50%);
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: 0.4rem;
  color: var(--nc-text-muted); cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 120ms var(--nc-ease), background-color 120ms var(--nc-ease);
}
/* Destructive press — coral is the sanctioned attention color (REDESIGN.md §1) */
.mmaps-row-del:active { background: rgba(var(--nc-coral-rgb), 0.14); color: var(--nc-coral); }

.mmaps-empty {
  padding: 24px 0;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--mmaps-mute);
  text-align: center;
}
</style>
