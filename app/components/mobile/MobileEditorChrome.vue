<script setup lang="ts">
/**
 * Mobile Map Editor chrome — implementation of Paper artboards
 * GHM-0 (iOS) and GW7-0 (Android).
 * Renders top bar + editorial header card + Editor/Graph mode pill + AI FAB.
 * The body (MarkdownEditorView or graph canvas) renders separately below.
 */

interface Props {
  title: string
  nodeCount: number
  sectionsCount?: number
  lastEditLabel?: string
  viewMode: 'editor' | 'graph' | 'canvas'
  isSynced?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  sectionsCount: 0,
  lastEditLabel: '',
  isSynced: true,
})

const emit = defineEmits<{
  back: []
  more: []
  'set-view': [view: 'editor' | 'graph']
  ai: []
}>()

function splitTitle(t: string): { head: string; tail: string } {
  const trimmed = (t || '').trim()
  if (!trimmed) return { head: 'Untitled', tail: '' }
  const parts = trimmed.split(/\s+/)
  if (parts.length <= 1) return { head: trimmed, tail: '' }
  return {
    head: parts.slice(0, -1).join(' '),
    tail: parts[parts.length - 1] + (trimmed.endsWith('.') ? '' : '.'),
  }
}

const titleParts = computed(() => splitTitle(props.title))
const isEditor = computed(() => props.viewMode === 'editor')
const isGraph = computed(() => props.viewMode === 'graph')

const metaLine = computed(() => {
  const bits: string[] = []
  if (props.lastEditLabel) bits.push(`LAST EDIT · ${props.lastEditLabel.toUpperCase()}`)
  if (props.sectionsCount > 0) bits.push(`${props.sectionsCount} SECTIONS`)
  return bits.join(' · ')
})
</script>

<template>
  <header class="medc">
    <!-- Top bar -->
    <div class="medc-top">
      <button class="medc-iconbtn" type="button" :aria-label="'Back'" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div v-if="isSynced" class="medc-live">
        <span class="medc-live-dot" />
        <span class="medc-live-label">SYNCED</span>
      </div>
      <div v-else class="medc-live medc-live--offline">
        <span class="medc-live-dot" />
        <span class="medc-live-label">OFFLINE</span>
      </div>
      <button class="medc-iconbtn" type="button" :aria-label="'More'" @click="emit('more')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
    </div>

    <!-- Editorial header card -->
    <div class="medc-card">
      <span class="medc-eyebrow">MAP — {{ nodeCount }} NODES · LIVE</span>
      <h1 class="medc-title">
        <span class="medc-title-sans">{{ titleParts.head }}</span>
        <span v-if="titleParts.tail" class="medc-title-serif">{{ titleParts.tail }}</span>
      </h1>
      <span v-if="metaLine" class="medc-meta">{{ metaLine }}</span>
    </div>

    <!-- Mode pill -->
    <div class="medc-pill">
      <button
        type="button"
        class="medc-pill-btn"
        :class="{ 'medc-pill-btn--active': isEditor }"
        @click="emit('set-view', 'editor')"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2H12V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V2Z" :stroke="isEditor ? '#09090B' : '#A1A1AA'" stroke-width="1.4" stroke-linejoin="round" />
          <path d="M5 5H9M5 7.5H9M5 10H7" :stroke="isEditor ? '#09090B' : '#A1A1AA'" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <span>Editor</span>
      </button>
      <button
        type="button"
        class="medc-pill-btn"
        :class="{ 'medc-pill-btn--active': isGraph }"
        @click="emit('set-view', 'graph')"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4" r="2" :stroke="isGraph ? '#09090B' : '#A1A1AA'" stroke-width="1.4" />
          <circle cx="3" cy="10" r="2" :stroke="isGraph ? '#09090B' : '#A1A1AA'" stroke-width="1.4" />
          <circle cx="11" cy="10" r="2" :stroke="isGraph ? '#09090B' : '#A1A1AA'" stroke-width="1.4" />
          <path d="M5.5 5.5L4.5 8.5M8.5 5.5L9.5 8.5M5 10H9" :stroke="isGraph ? '#09090B' : '#A1A1AA'" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <span>Graph</span>
      </button>
    </div>

    <!-- AI FAB (fixed, escapes header flow) -->
    <button class="medc-fab" type="button" aria-label="AI suggestions" @click="emit('ai')">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" stroke="#09090B" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M19 17L19.7 19L21.5 19.5L19.7 20L19 22L18.3 20L16.5 19.5L18.3 19L19 17Z" stroke="#09090B" stroke-width="1.4" stroke-linejoin="round" />
      </svg>
    </button>
  </header>
</template>

<style scoped>
.medc {
  --medc-bg: #09090B;
  --medc-ink: #FAFAFA;
  --medc-body: #A1A1AA;
  --medc-mute: #52525B;
  --medc-mint: #00D2BE;
  --medc-surface: rgba(250, 250, 250, 0.04);
  --medc-stroke: rgba(250, 250, 250, 0.10);
  --medc-stroke-soft: rgba(250, 250, 250, 0.08);

  position: relative;
  z-index: 31;
  display: flex;
  flex-direction: column;
  width: 100%;
  background: var(--medc-bg);
  color: var(--medc-ink);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}

/* Top bar */
.medc-top {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%;
  height: 52px;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 18px 0 18px;
  box-sizing: content-box;
}
.medc-iconbtn {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border-radius: 12px;
  background: var(--medc-surface);
  border: 1px solid var(--medc-stroke-soft);
  color: var(--medc-ink);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}
.medc-iconbtn:active { background: rgba(250, 250, 250, 0.08); }

.medc-live {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(0, 210, 190, 0.08);
  border: 1px solid rgba(0, 210, 190, 0.30);
}
.medc-live--offline {
  background: rgba(161, 161, 170, 0.08);
  border-color: rgba(161, 161, 170, 0.30);
}
.medc-live-dot {
  width: 6px; height: 6px;
  border-radius: 999px;
  background: var(--medc-mint);
  animation: medc-pulse 2.4s ease-in-out infinite;
}
.medc-live--offline .medc-live-dot { background: var(--medc-body); animation: none; }
@keyframes medc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.medc-live-label {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 12px;
  letter-spacing: 0.08em;
  color: var(--medc-mint);
}
.medc-live--offline .medc-live-label { color: var(--medc-body); }

/* Header card */
.medc-card {
  display: flex; flex-direction: column; gap: 16px;
  margin: 30px 18px 0 18px;
  padding: 26px 24px 26px 24px;
  background: var(--medc-surface);
  border: 1px solid var(--medc-stroke);
  border-radius: 22px;
}
.medc-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.12em;
  color: var(--medc-mint);
}
.medc-title {
  display: flex; align-items: baseline; flex-wrap: wrap;
  gap: 8px;
  margin: 0; padding: 0;
  font-weight: 500;
}
.medc-title-sans {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 28px; line-height: 32px;
  letter-spacing: -0.025em;
  color: var(--medc-ink);
}
.medc-title-serif {
  font-family: 'Instrument Serif', Georgia, serif;
  font-style: italic; font-weight: 400;
  font-size: 36px; line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--medc-mint);
}
.medc-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.12em;
  color: var(--medc-mute);
}

/* Mode pill */
.medc-pill {
  display: flex; align-items: center; gap: 6px;
  margin: 18px 18px 22px 18px;
  padding: 6px;
  background: var(--medc-surface);
  border: 1px solid var(--medc-stroke-soft);
  border-radius: 14px;
}
.medc-pill-btn {
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  flex: 1 1 0;
  padding: 11px 14px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 13px; line-height: 16px;
  letter-spacing: -0.005em;
  color: var(--medc-body);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}
.medc-pill-btn--active {
  background: var(--medc-mint);
  color: #09090B;
  font-weight: 600;
}

/* AI FAB */
.medc-fab {
  position: fixed;
  right: 20px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
  display: flex; align-items: center; justify-content: center;
  width: 56px; height: 56px;
  border-radius: 18px;
  background: var(--medc-mint);
  border: none;
  box-shadow: 0 8px 24px rgba(0, 210, 190, 0.32), 0 2px 8px rgba(0, 0, 0, 0.40);
  cursor: pointer;
  z-index: 60;
  padding: 0;
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.medc-fab:active { transform: scale(0.92); }

/* Light mode */
:root.light .medc {
  --medc-bg: #FAFAF9;
  --medc-ink: #18181B;
  --medc-body: #52525B;
  --medc-mute: #71717A;
  --medc-surface: rgba(0, 0, 0, 0.03);
  --medc-stroke: rgba(0, 0, 0, 0.10);
  --medc-stroke-soft: rgba(0, 0, 0, 0.08);
}
:root.light .medc-pill-btn--active { color: #09090B; }
:root.light .medc-iconbtn { color: var(--medc-ink); }

/* Android refinements (slightly tighter top bar, Material radii) */
:root.platform-android .medc-top { padding: 8px 12px 0 12px; }
:root.platform-android .medc-iconbtn { border-radius: 999px; }
:root.platform-android .medc-fab { border-radius: 16px; }
</style>
