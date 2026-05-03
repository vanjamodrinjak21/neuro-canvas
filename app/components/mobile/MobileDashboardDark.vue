<script setup lang="ts">
/**
 * Mobile Dashboard (Dark) — implementation of Paper artboards
 * G13-0 (iOS 390×844) and GJJ-0 (Android 412×915).
 *
 * Single layout, platform-tuned via :root.platform-ios / :root.platform-android.
 */

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
}>()

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
</script>

<template>
  <section class="mdash" aria-label="Dashboard">
    <!-- 01. Top bar — brand mark + LIVE chip + avatar -->
    <header class="mdash-top">
      <div class="mdash-brand">
        <div class="mdash-mark">
          <div class="mdash-mark-dot" />
        </div>
      </div>
      <div class="mdash-top-right">
        <div class="mdash-live-chip">
          <span class="mdash-live-dot" />
          <span class="mdash-live-label">SYNCED</span>
        </div>
        <NuxtLink to="/settings" class="mdash-avatar" :aria-label="t('common.nav.settings')">
          <img v-if="user?.image" :src="user.image" :alt="user.name || ''" class="mdash-avatar-img">
          <span v-else>{{ userInitials }}</span>
        </NuxtLink>
      </div>
    </header>

    <!-- 02. Editorial hero — mono breadcrumb + Welcome / Vanja. + inline stats -->
    <div class="mdash-hero">
      <div class="mdash-eyebrow">01 — {{ t('common.nav.maps').toUpperCase() }}</div>
      <h1 class="mdash-hero-line">
        <span class="mdash-hero-sans">Welcome back,</span>
        <span class="mdash-hero-serif">{{ (user?.name || user?.email?.split('@')[0] || 'there').split(' ')[0] }}.</span>
      </h1>
      <div class="mdash-stats">
        <div class="mdash-stat">
          <span class="mdash-stat-num">{{ totalMaps }}</span>
          <span class="mdash-stat-label">MAPS</span>
        </div>
        <span class="mdash-stat-sep" />
        <div class="mdash-stat">
          <span class="mdash-stat-num">{{ totalNodes }}</span>
          <span class="mdash-stat-label">NODES</span>
        </div>
        <span class="mdash-stat-sep" />
        <div class="mdash-stat">
          <span class="mdash-stat-num">{{ sinceEdit }}</span>
          <span class="mdash-stat-label">SINCE EDIT</span>
        </div>
      </div>
    </div>

    <!-- 03. Mint "Currently editing" card -->
    <button
      v-if="continueMap"
      type="button"
      class="mdash-continue"
      @click="onResume"
    >
      <div class="mdash-continue-thumb">
        <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
          <line x1="9" y1="11" x2="16" y2="16" stroke="rgba(9,9,11,0.55)" stroke-width="1.2" />
          <line x1="23" y1="9" x2="16" y2="16" stroke="rgba(9,9,11,0.55)" stroke-width="1.2" />
          <line x1="16" y1="16" x2="11" y2="23" stroke="rgba(9,9,11,0.55)" stroke-width="1.2" />
          <line x1="16" y1="16" x2="22" y2="22" stroke="rgba(9,9,11,0.55)" stroke-width="1.2" />
          <circle cx="9" cy="11" r="2" fill="#09090B" />
          <circle cx="23" cy="9" r="2" fill="#09090B" />
          <circle cx="16" cy="16" r="2.5" fill="#09090B" />
          <circle cx="11" cy="23" r="2" fill="#09090B" />
          <circle cx="22" cy="22" r="2" fill="#09090B" />
        </svg>
      </div>
      <div class="mdash-continue-body">
        <span class="mdash-continue-eyebrow">CURRENTLY EDITING</span>
        <span class="mdash-continue-title">{{ continueMap.title || 'Untitled map' }}</span>
        <span class="mdash-continue-meta">
          {{ countOf(continueMap.nodes) }} nodes · resume →
        </span>
      </div>
      <div class="mdash-continue-resume" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </button>

    <!-- 04. Section header — RECENT · X of Y · See all -->
    <div class="mdash-section">
      <div class="mdash-section-eyebrow">
        <span class="mdash-eyebrow-strong">02 — RECENT</span>
        <span class="mdash-eyebrow-faint">· {{ Math.min(recentRows.length, totalMaps) }} of {{ totalMaps }}</span>
      </div>
      <button type="button" class="mdash-see-all" @click="emit('seeAll')">See all →</button>
    </div>

    <!-- 05. Recent list — soft surface cards -->
    <div class="mdash-list">
      <button
        v-for="m in recentRows"
        :key="m.id"
        type="button"
        class="mdash-row"
        @click="onRow(m.id)"
      >
        <div class="mdash-row-thumb">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
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
        <div class="mdash-row-meta">
          <span class="mdash-row-title">{{ m.title || 'Untitled map' }}</span>
          <span class="mdash-row-sub">{{ countOf(m.nodes) }} NODES · {{ relTime(m.updatedAt) }}</span>
        </div>
        <svg class="mdash-row-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3L9 7L5 11" stroke="#52525B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <!-- Empty state -->
      <div v-if="recentRows.length === 0 && !continueMap" class="mdash-empty">
        <span>No maps yet — tap + to start.</span>
      </div>
    </div>

    <!-- 06. Floating mint FAB ( + new map ) -->
    <button
      type="button"
      class="mdash-fab"
      :disabled="isCreatingMap"
      :aria-label="t('dashboard.buttons.new_map')"
      @click="onNew"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 4V16M4 10H16" stroke="#09090B" stroke-width="2.2" stroke-linecap="round" />
      </svg>
    </button>
  </section>
</template>

<style scoped>
/* ──────────────────────────────────────────────────────────────────────
 * Tokens (mirrors Paper Try-Free / G13-0 / GJJ-0)
 * ────────────────────────────────────────────────────────────────────── */
.mdash {
  --mdash-bg: #09090B;
  --mdash-ink: #FAFAFA;
  --mdash-body: #A1A1AA;
  --mdash-mute: #52525B;
  --mdash-mint: #00D2BE;
  --mdash-surface: rgba(250, 250, 250, 0.04);
  --mdash-surface-2: rgba(250, 250, 250, 0.06);
  --mdash-stroke: rgba(250, 250, 250, 0.10);
  --mdash-stroke-soft: rgba(250, 250, 250, 0.06);

  /* Pin the screen — header sticks, only the recent list scrolls, dock fixed */
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  background: var(--mdash-bg);
  color: var(--mdash-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
  z-index: 10;
}

/* ── 01. Top bar ─────────────────────────────────────────────────────── */
.mdash-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 44px;
  padding: 4px 20px 0 20px;
  box-sizing: border-box;
}
.mdash-brand { display: flex; align-items: center; gap: 8px; }
.mdash-mark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--mdash-mint);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mdash-mark-dot {
  width: 9px; height: 9px;
  border-radius: 2px;
  background: var(--mdash-bg);
}
.mdash-top-right { display: flex; align-items: center; gap: 10px; }

.mdash-live-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.mdash-live-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--mdash-mint);
  animation: mdash-pulse 2.4s ease-in-out infinite;
}
@keyframes mdash-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.mdash-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--mdash-mint);
}

.mdash-avatar {
  width: 32px; height: 32px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.06);
  border: 1px solid var(--mdash-stroke);
  display: flex; align-items: center; justify-content: center;
  color: var(--mdash-ink);
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 13px; line-height: 16px;
  text-decoration: none;
  overflow: hidden;
  flex-shrink: 0;
}
.mdash-avatar-img { width: 100%; height: 100%; object-fit: cover; }

/* ── 02. Editorial hero ──────────────────────────────────────────────── */
.mdash-hero {
  display: flex; flex-direction: column;
  width: 100%;
  padding: 18px 20px 0 20px;
  box-sizing: border-box;
}
.mdash-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.12em;
  color: var(--mdash-mute);
}
.mdash-hero-line {
  display: flex; align-items: baseline; flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 0 0;
  padding: 0;
  font-weight: 500;
}
.mdash-hero-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 34px; line-height: 38px;
  letter-spacing: -0.025em;
  color: var(--mdash-ink);
}
.mdash-hero-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 44px; line-height: 38px;
  letter-spacing: -0.02em;
  color: var(--mdash-mint);
}

.mdash-stats {
  display: flex; align-items: center; gap: 14px;
  margin-top: 18px;
}
.mdash-stat { display: flex; align-items: baseline; gap: 6px; }
.mdash-stat-num {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 14px; line-height: 18px;
  color: var(--mdash-ink);
}
.mdash-stat-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.08em;
  color: var(--mdash-mute);
}
.mdash-stat-sep {
  width: 1px; height: 12px;
  background: var(--mdash-stroke);
  flex-shrink: 0;
}

/* ── 03. Mint "Currently editing" card ───────────────────────────────── */
.mdash-continue {
  display: flex; align-items: center; gap: 14px;
  margin: 28px 20px 0 20px;
  padding: 14px 16px;
  background: var(--mdash-mint);
  border: none;
  border-radius: 18px;
  cursor: pointer;
  text-align: left;
  width: auto;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease;
}
.mdash-continue:active { transform: scale(0.98); }

.mdash-continue-thumb {
  width: 52px; height: 52px;
  border-radius: 12px;
  background: rgba(9, 9, 11, 0.12);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mdash-continue-body {
  display: flex; flex-direction: column;
  flex: 1 1 0;
  gap: 3px;
  min-width: 0;
}
.mdash-continue-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  letter-spacing: 0.12em;
  color: rgba(9, 9, 11, 0.65);
}
.mdash-continue-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 16px; line-height: 20px;
  letter-spacing: -0.015em;
  color: #09090B;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mdash-continue-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 12px; line-height: 16px;
  color: rgba(9, 9, 11, 0.65);
}
.mdash-continue-resume {
  width: 36px; height: 36px;
  border-radius: 999px;
  background: #09090B;
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
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.12em;
  color: var(--mdash-mute);
}
.mdash-eyebrow-faint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  color: var(--mdash-mute);
}
.mdash-see-all {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 13px; line-height: 18px;
  color: var(--mdash-mint);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
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
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: inherit;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 120ms ease, transform 120ms ease;
}
.mdash-row:active { transform: scale(0.99); background: rgba(250, 250, 250, 0.06); }
.mdash-row-thumb {
  width: 44px; height: 44px;
  border-radius: 10px;
  background: var(--mdash-surface);
  border: 1px solid rgba(250, 250, 250, 0.08);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mdash-row-meta {
  display: flex; flex-direction: column;
  flex: 1 1 0;
  gap: 2px;
  min-width: 0;
}
.mdash-row-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600; font-size: 14px; line-height: 18px;
  letter-spacing: -0.01em;
  color: var(--mdash-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mdash-row-sub {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 13px;
  letter-spacing: 0.04em;
  color: var(--mdash-mute);
}
.mdash-row-chevron { flex-shrink: 0; }

.mdash-empty {
  padding: 24px 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--mdash-mute);
  text-align: center;
}

/* ── 06. Floating FAB ────────────────────────────────────────────────── */
.mdash-fab {
  position: fixed;
  right: 20px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 108px);
  width: 52px; height: 52px;
  border-radius: 999px;
  background: var(--mdash-mint);
  border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow:
    0 12px 32px rgba(0, 210, 190, 0.35),
    0 4px 12px rgba(0, 0, 0, 0.45);
  z-index: 150;
  transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mdash-fab:active { transform: scale(0.92); }
.mdash-fab:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
