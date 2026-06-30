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
          <circle cx="7" cy="7" r="5" stroke="#52525B" stroke-width="1.4" />
          <path d="M14 14L11 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" />
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
          <path d="M3 4H13M5 8H11M7 12H9" stroke="#A1A1AA" stroke-width="1.5" stroke-linecap="round" />
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
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2.5 4L5 6.5L7.5 4" stroke="#A1A1AA" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
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
            <line x1="9" y1="11" x2="16" y2="16" stroke="#52525B" />
            <line x1="23" y1="9" x2="16" y2="16" stroke="#52525B" />
            <line x1="16" y1="16" x2="11" y2="23" stroke="#52525B" />
            <line x1="16" y1="16" x2="22" y2="22" stroke="#52525B" />
            <circle cx="9" cy="11" r="2" fill="#00D2BE" />
            <circle cx="23" cy="9" r="2" fill="#A1A1AA" />
            <circle cx="16" cy="16" r="2.5" fill="#FAFAFA" />
            <circle cx="11" cy="23" r="2" fill="#A1A1AA" />
            <circle cx="22" cy="22" r="2" fill="#A1A1AA" />
          </svg>
        </div>
        <div class="mmaps-row-meta">
          <span class="mmaps-row-title-line">
            <span class="mmaps-row-title">{{ m.title || t('mobile.maps.untitledMap') }}</span>
            <svg v-if="m.pinned" class="mmaps-row-pin" width="10" height="10" viewBox="0 0 12 12" fill="#00D2BE">
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
  --mmaps-mint: #00D2BE;
  --mmaps-surface: rgba(250, 250, 250, 0.04);
  --mmaps-stroke: rgba(250, 250, 250, 0.10);
  --mmaps-stroke-soft: rgba(250, 250, 250, 0.06);

  /* Pin the screen — only the list scrolls, dock stays fixed */
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mmaps-bg);
  color: var(--mmaps-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
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
.mmaps-mark {
  width: 26px; height: 26px;
  border-radius: 7px;
  display: block;
  flex-shrink: 0;
}
.mmaps-wordmark {
  font-family: 'Instrument Serif', Georgia, serif;
  font-weight: 400;
  font-size: calc(19px * var(--nc-text-scale, 1));
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--mmaps-ink, var(--nc-ink));
}
.mmaps-wordmark-em {
  font-style: italic;
  color: var(--mmaps-mint, #00D2BE);
}
.mmaps-top-right { display: flex; align-items: center; gap: 10px; }

.mmaps-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.mmaps-live-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--mmaps-mint);
  animation: mmaps-pulse 2.4s ease-in-out infinite;
}
@keyframes mmaps-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.mmaps-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mmaps-mint);
}

.mmaps-avatar {
  width: 32px; height: 32px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.06);
  border: 1px solid var(--mmaps-stroke);
  display: flex; align-items: center; justify-content: center;
  color: var(--mmaps-ink);
  font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 16px;
  text-decoration: none;
  overflow: hidden;
  flex-shrink: 0;
}
.mmaps-avatar-img { width: 100%; height: 100%; object-fit: cover; }

/* Editorial hero */
.mmaps-hero { display: flex; flex-direction: column; padding: 28px 20px 0 20px; box-sizing: border-box; }
.mmaps-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.12em; color: var(--mmaps-mute);
}
.mmaps-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px;
  margin: 14px 0 0 0; padding: 0; font-weight: 500;
}
.mmaps-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.025em; color: var(--mmaps-ink);
}
.mmaps-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: calc(46px * var(--nc-text-scale, 1)); line-height: 38px;
  letter-spacing: -0.02em; color: var(--mmaps-mint);
}
.mmaps-hero-meta {
  font-family: 'Inter', system-ui, sans-serif;
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
  background: var(--mmaps-surface);
  border: 1px solid rgba(250, 250, 250, 0.08);
  border-radius: 14px;
  min-width: 0;
  cursor: text;
}
.mmaps-search-field {
  flex: 1 1 0;
  background: transparent;
  border: none;
  outline: none;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 16px;
  letter-spacing: 0.04em;
  color: var(--mmaps-ink);
  caret-color: var(--mmaps-mint);
}
.mmaps-search-field::placeholder { color: var(--mmaps-mute); }
.mmaps-sort-btn {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px;
  border-radius: 14px;
  background: var(--mmaps-surface);
  border: 1px solid rgba(250, 250, 250, 0.08);
  flex-shrink: 0;
  cursor: pointer;
}

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
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--mmaps-stroke);
  flex-shrink: 0;
  cursor: pointer;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 14px;
  color: var(--mmaps-body);
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.mmaps-pill--active {
  background: var(--mmaps-mint);
  border-color: var(--mmaps-mint);
  color: #09090B;
  font-weight: 600;
}
.mmaps-pill-count {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 12px;
  color: var(--mmaps-mute);
}
.mmaps-pill--active .mmaps-pill-count { color: rgba(9, 9, 11, 0.55); }

/* Section header */
.mmaps-section {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  padding: 22px 20px 12px 20px;
  box-sizing: border-box;
}
.mmaps-section-left { display: flex; align-items: baseline; gap: 8px; }
.mmaps-section-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.12em; color: var(--mmaps-mute);
}
.mmaps-section-value {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: calc(12px * var(--nc-text-scale, 1)); line-height: 14px;
  color: var(--mmaps-ink);
}
.mmaps-section-count {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
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
  border-radius: 14px;
  cursor: pointer;
  font-family: inherit;
  color: inherit;
  text-align: left;
  transition: background 120ms ease, transform 120ms ease;
  -webkit-tap-highlight-color: transparent;
}
.mmaps-row:active { transform: scale(0.99); background: rgba(250, 250, 250, 0.06); }
.mmaps-row-thumb {
  width: 42px; height: 42px;
  border-radius: 10px;
  background: var(--mmaps-surface);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mmaps-row-meta {
  display: flex; flex-direction: column; gap: 2px;
  flex: 1 1 0;
  min-width: 0;
}
.mmaps-row-title-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mmaps-row-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.01em;
  color: var(--mmaps-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mmaps-row-pin { flex-shrink: 0; }
.mmaps-row-sub {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 13px;
  letter-spacing: 0.04em;
  color: var(--mmaps-mute);
}
.mmaps-row-wrap { position: relative; width: 100%; }
.mmaps-row-wrap .mmaps-row { width: 100%; padding-right: 50px; box-sizing: border-box; }
.mmaps-row-del {
  position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; border-radius: 10px;
  color: #71717A; cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 120ms ease, background 120ms ease;
}
.mmaps-row-del:active { background: rgba(244, 63, 94, 0.14); color: #fb7185; }

.mmaps-empty {
  padding: 24px 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--mmaps-mute);
  text-align: center;
}

/* Light theme — the white-based surface/stroke overlays vanish on a light
   background, so remap the local surface/stroke vars to opaque light tokens. */
:root.light .mmaps {
  --mmaps-surface: var(--nc-surface);
  --mmaps-stroke: var(--nc-border-active);
  --mmaps-stroke-soft: var(--nc-border);
}
:root.light .mmaps-search-input,
:root.light .mmaps-sort-btn,
:root.light .mmaps-row-thumb {
  border-color: var(--nc-border);
}
:root.light .mmaps-avatar {
  background: var(--nc-surface);
}
:root.light .mmaps-row:active {
  background: var(--nc-surface-3);
}
</style>
