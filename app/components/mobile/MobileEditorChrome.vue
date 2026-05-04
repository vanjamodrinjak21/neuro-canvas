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
  'generate-map': []
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

// Collapse the editorial header + mode pill while the on-screen keyboard
// is up. Uses Capacitor Keyboard on native, visualViewport as web fallback.
const compact = ref(false)
let cleanups: Array<() => void> = []

onMounted(async () => {
  try {
    const mod = await import('@capacitor/keyboard')
    const Keyboard = mod.Keyboard
    const showHandle = await Keyboard.addListener('keyboardWillShow', () => { compact.value = true })
    const hideHandle = await Keyboard.addListener('keyboardWillHide', () => { compact.value = false })
    cleanups.push(() => showHandle.remove(), () => hideHandle.remove())
  } catch { /* not native — fall through to visualViewport */ }

  if (typeof window !== 'undefined' && window.visualViewport) {
    const vv = window.visualViewport
    const baseline = vv.height
    const onResize = () => {
      compact.value = vv.height < baseline * 0.78
    }
    vv.addEventListener('resize', onResize)
    cleanups.push(() => vv.removeEventListener('resize', onResize))
  }
})

onBeforeUnmount(() => {
  cleanups.forEach(fn => { try { fn() } catch { /* noop */ } })
  cleanups = []
})
</script>

<template>
  <header class="medc" :class="{ 'medc--compact': compact }">
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

    <!-- Generate with AI quick-action bar -->
    <button
      type="button"
      class="medc-genbar"
      :aria-label="'Generate map with AI'"
      @click="emit('generate-map')"
    >
      <span class="medc-genbar-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D2BE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
          <path d="M19 17L19.7 19L21.5 19.5L19.7 20L19 22L18.3 20L16.5 19.5L18.3 19L19 17Z" />
        </svg>
      </span>
      <span class="medc-genbar-label">Generate with AI</span>
      <span class="medc-genbar-meta">TOPIC · STREAM</span>
      <svg class="medc-genbar-chev" width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M5 3L9 7L5 11" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

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
  min-height: 52px;
  padding: calc(env(safe-area-inset-top, 0px) + 12px) 18px 0 18px;
  box-sizing: border-box;
  transition:
    min-height 240ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 240ms cubic-bezier(0.4, 0, 0.2, 1);
}
.medc--compact .medc-top {
  min-height: 40px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 6px);
  padding-bottom: 4px;
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
  transform-origin: top center;
  transition:
    max-height 280ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 220ms ease,
    margin 280ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 280ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 220ms ease,
    transform 280ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 360px;
  overflow: hidden;
}
.medc--compact .medc-card {
  max-height: 0;
  opacity: 0;
  margin: 0 18px;
  padding-top: 0;
  padding-bottom: 0;
  border-color: transparent;
  transform: translateY(-12px) scale(0.96);
  pointer-events: none;
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

/* Generate-with-AI quick-action bar */
.medc-genbar {
  display: flex; align-items: center; gap: 12px;
  margin: 14px 18px 0 18px;
  padding: 10px 14px;
  background: rgba(0, 210, 190, 0.06);
  border: 1px solid rgba(0, 210, 190, 0.30);
  border-radius: 14px;
  font-family: 'Inter', system-ui, sans-serif;
  color: var(--medc-ink);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background 150ms ease, border-color 150ms ease, transform 120ms ease,
    max-height 280ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 220ms ease,
    margin 280ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 280ms cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 60px;
  overflow: hidden;
}
.medc-genbar:active { transform: scale(0.99); background: rgba(0, 210, 190, 0.10); }
.medc-genbar-icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(0, 210, 190, 0.14);
  border: 1px solid rgba(0, 210, 190, 0.30);
  flex-shrink: 0;
}
.medc-genbar-label {
  font-weight: 600; font-size: 13px; line-height: 18px;
  letter-spacing: -0.005em;
  color: var(--medc-ink);
  flex: 1 1 0;
  min-width: 0;
}
.medc-genbar-meta {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; line-height: 12px;
  letter-spacing: 0.14em;
  color: rgba(0, 210, 190, 0.78);
  flex-shrink: 0;
}
.medc-genbar-chev { flex-shrink: 0; }
.medc--compact .medc-genbar {
  max-height: 0;
  opacity: 0;
  margin: 0 18px;
  padding: 0;
  border-color: transparent;
  pointer-events: none;
}

/* Mode pill */
.medc-pill {
  display: flex; align-items: center; gap: 6px;
  margin: 18px 18px 22px 18px;
  padding: 6px;
  background: var(--medc-surface);
  border: 1px solid var(--medc-stroke-soft);
  border-radius: 14px;
  transition:
    max-height 280ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 200ms ease,
    margin 280ms cubic-bezier(0.4, 0, 0.2, 1),
    padding 280ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 200ms ease;
  max-height: 70px;
  overflow: hidden;
}
.medc--compact .medc-pill {
  max-height: 0;
  opacity: 0;
  margin: 0 18px;
  padding: 0;
  border-color: transparent;
  pointer-events: none;
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
</style>
