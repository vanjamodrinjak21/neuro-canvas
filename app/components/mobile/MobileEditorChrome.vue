<script setup lang="ts">
/**
 * Mobile Map Editor chrome — implementation of Paper artboards
 * GHM-0 (iOS) and GW7-0 (Android).
 * Renders top bar + editorial header card + Editor/Graph mode pill + AI FAB.
 * The body (MarkdownEditorView or graph canvas) renders separately below.
 */
import NcAiMark from '~/components/ui/NcAiMark.vue'

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

const { t } = useI18n()
// Alias for use inside helpers whose own params shadow `t` (e.g. splitTitle).
const tr = t

const emit = defineEmits<{
  back: []
  more: []
  'set-view': [view: 'editor' | 'graph']
  ai: []
  'generate-map': []
  rename: [name: string]
}>()

const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

function startRename() {
  titleDraft.value = (props.title || '').trim()
  editingTitle.value = true
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
function commitRename() {
  if (!editingTitle.value) return
  const next = titleDraft.value.trim()
  editingTitle.value = false
  if (next && next !== props.title.trim()) {
    emit('rename', next)
  }
}
function cancelRename() {
  editingTitle.value = false
  titleDraft.value = ''
}

function splitTitle(t: string): { head: string; tail: string } {
  const trimmed = (t || '').trim()
  if (!trimmed) return { head: tr('mobile.editor.untitledHead'), tail: '' }
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
  if (props.lastEditLabel) bits.push(t('mobile.editor.lastEdit', { label: props.lastEditLabel.toUpperCase() }))
  if (props.sectionsCount > 0) bits.push(t('mobile.editor.sectionsCount', { n: props.sectionsCount }))
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

  // Most reliable trigger across platforms: collapse the header whenever an
  // editable field in the BODY (the text/markdown editor) is focused. Keyboard
  // events don't fire consistently in WKWebView, so don't depend on them.
  // Focusing the title input (inside .medc) must NOT collapse — you're editing
  // the title there.
  if (typeof document !== 'undefined') {
    const isBodyEditable = (el: Element | null): boolean => {
      const e = el as HTMLElement | null
      if (!e || e.closest('.medc')) return false
      return e.isContentEditable
        || e.matches('textarea, input:not([type=button]):not([type=checkbox]), [contenteditable], [contenteditable="true"]')
    }
    const onFocusIn = (ev: FocusEvent) => { if (isBodyEditable(ev.target as Element)) compact.value = true }
    const onFocusOut = () => {
      // Defer so focus moving between editables doesn't flicker the header.
      setTimeout(() => { if (!isBodyEditable(document.activeElement)) compact.value = false }, 60)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    cleanups.push(
      () => document.removeEventListener('focusin', onFocusIn),
      () => document.removeEventListener('focusout', onFocusOut),
    )

    // Opening a map often auto-focuses the editor and raises the keyboard
    // BEFORE this listener attaches, so the initial focusin is missed. Sync
    // from the already-focused element on mount + a couple of deferred ticks
    // to catch async autofocus.
    const syncActive = () => { if (isBodyEditable(document.activeElement)) compact.value = true }
    syncActive()
    const t1 = setTimeout(syncActive, 150)
    const t2 = setTimeout(syncActive, 450)
    cleanups.push(() => clearTimeout(t1), () => clearTimeout(t2))
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
      <button class="medc-iconbtn" type="button" :aria-label="t('mobile.editor.back')" @click="emit('back')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button class="medc-iconbtn" type="button" :aria-label="t('mobile.editor.more')" @click="emit('more')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
    </div>

    <!-- Editorial header card -->
    <div class="medc-card">
      <span class="medc-eyebrow">{{ t('mobile.editor.eyebrow', { n: nodeCount }) }}</span>
      <h1 v-if="!editingTitle" class="medc-title" @click="startRename">
        <span class="medc-title-sans">{{ titleParts.head }}</span>
        <span v-if="titleParts.tail" class="medc-title-serif">{{ titleParts.tail }}</span>
      </h1>
      <input
        v-else
        ref="titleInputRef"
        v-model="titleDraft"
        class="medc-title-input"
        type="text"
        :placeholder="t('mobile.editor.titlePlaceholder')"
        autocomplete="off"
        autocapitalize="words"
        spellcheck="false"
        maxlength="120"
        enterkeyhint="done"
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="cancelRename"
        @blur="commitRename"
      >
      <span v-if="metaLine" class="medc-meta">{{ metaLine }}</span>
    </div>

    <!-- Generate with AI quick-action bar -->
    <button
      type="button"
      class="medc-genbar"
      :aria-label="t('mobile.editor.generateAriaLabel')"
      @click="emit('generate-map')"
    >
      <span class="medc-genbar-icon" aria-hidden="true">
        <NcAiMark :size="14" />
      </span>
      <span class="medc-genbar-label">{{ t('mobile.editor.generateLabel') }}</span>
      <span class="medc-genbar-meta">{{ t('mobile.editor.generateMeta') }}</span>
      <svg class="medc-genbar-chev" width="12" height="12" viewBox="0 0 14 14" fill="none">
        <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
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
          <path d="M2 2H12V11C12 11.5523 11.5523 12 11 12H3C2.44772 12 2 11.5523 2 11V2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          <path d="M5 5H9M5 7.5H9M5 10H7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <span>{{ t('mobile.editor.modeEditor') }}</span>
      </button>
      <button
        type="button"
        class="medc-pill-btn"
        :class="{ 'medc-pill-btn--active': isGraph }"
        @click="emit('set-view', 'graph')"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="4" r="2" stroke="currentColor" stroke-width="1.4" />
          <circle cx="3" cy="10" r="2" stroke="currentColor" stroke-width="1.4" />
          <circle cx="11" cy="10" r="2" stroke="currentColor" stroke-width="1.4" />
          <path d="M5.5 5.5L4.5 8.5M8.5 5.5L9.5 8.5M5 10H9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
        <span>{{ t('mobile.editor.modeGraph') }}</span>
      </button>
    </div>

  </header>
</template>

<style scoped>
.medc {
  --medc-bg: var(--nc-bg);
  --medc-ink: var(--nc-ink);
  --medc-body: var(--nc-ink-soft);
  --medc-mute: var(--nc-ink-faint);
  --medc-mint: var(--nc-accent);
  --medc-surface: var(--nc-chip-bg);
  --medc-stroke: var(--nc-border);
  --medc-stroke-soft: var(--nc-border-subtle);

  position: relative;
  z-index: 31;
  display: flex;
  flex-direction: column;
  width: 100%;
  background: var(--medc-bg);
  color: var(--medc-ink);
  font-family: var(--nc-font-body);
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
    min-height 240ms var(--nc-ease),
    padding 240ms var(--nc-ease);
}
.medc--compact .medc-top {
  min-height: 40px;
  padding-top: calc(env(safe-area-inset-top, 0px) + 6px);
  padding-bottom: 4px;
}
.medc-iconbtn {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px;
  border-radius: 0.5rem;
  background: var(--medc-surface);
  border: 1px solid var(--medc-stroke-soft);
  color: var(--medc-ink);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background-color 120ms var(--nc-ease), transform 120ms var(--nc-ease);
}
/* Expand hit area to the 44px minimum */
.medc-iconbtn::before {
  content: '';
  position: absolute;
  inset: -2px;
}
.medc-iconbtn:active { background: var(--nc-surface-3); transform: scale(0.97); }

/* Header card */
.medc-card {
  display: flex; flex-direction: column; gap: 16px;
  margin: 30px 18px 0 18px;
  padding: 26px 24px 26px 24px;
  background: var(--medc-surface);
  border: 1px solid var(--medc-stroke);
  border-radius: 0.5rem;
  transform-origin: top center;
  transition:
    max-height 280ms var(--nc-ease),
    opacity 220ms var(--nc-ease),
    margin 280ms var(--nc-ease),
    padding 280ms var(--nc-ease),
    border-color 220ms var(--nc-ease),
    transform 280ms var(--nc-ease);
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
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
}
.medc-title-input {
  width: 100%;
  margin: 0; padding: 4px 0;
  background: none;
  border: none;
  border-bottom: 1px dashed rgba(var(--nc-accent-rgb), 0.4);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(28px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--nc-ink);
  caret-color: var(--nc-accent);
}
.medc-title-input::placeholder { color: var(--nc-text-dim); }
.medc-title {
  display: flex; align-items: baseline; flex-wrap: wrap;
  gap: 8px;
  margin: 0; padding: 0;
  font-weight: 700;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.medc-title-sans {
  font-family: var(--nc-font-display);
  font-weight: 700; font-size: calc(28px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--medc-ink);
}
.medc-title-serif {
  font-family: var(--nc-font-serif);
  font-style: italic; font-weight: 400;
  font-size: calc(36px * var(--nc-text-scale, 1)); line-height: 32px;
  letter-spacing: -0.02em;
  color: var(--nc-accent-text);
}
.medc-meta {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.12em;
  color: var(--medc-mute);
}

/* Generate-with-AI quick-action bar */
.medc-genbar {
  display: flex; align-items: center; gap: 12px;
  margin: 14px 18px 0 18px;
  padding: 10px 14px;
  background: rgba(var(--nc-accent-rgb), 0.06);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.30);
  border-radius: 0.5rem;
  font-family: var(--nc-font-body);
  color: var(--medc-ink);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 150ms var(--nc-ease), border-color 150ms var(--nc-ease), transform 120ms var(--nc-ease),
    max-height 280ms var(--nc-ease),
    opacity 220ms var(--nc-ease),
    margin 280ms var(--nc-ease),
    padding 280ms var(--nc-ease);
  max-height: 60px;
  overflow: hidden;
}
.medc-genbar:active { transform: scale(0.97); background: rgba(var(--nc-accent-rgb), 0.10); }
.medc-genbar-icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 0.4rem;
  background: rgba(var(--nc-accent-rgb), 0.14);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.30);
  color: var(--nc-accent-text);
  flex-shrink: 0;
}
.medc-genbar-label {
  font-weight: 600; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.005em;
  color: var(--medc-ink);
  flex: 1 1 0;
  min-width: 0;
}
.medc-genbar-meta {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.14em;
  color: var(--nc-accent-text);
}
.medc-genbar-chev { flex-shrink: 0; color: var(--nc-accent-text); }
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
  border-radius: 0.5rem;
  transition:
    max-height 280ms var(--nc-ease),
    opacity 200ms var(--nc-ease),
    margin 280ms var(--nc-ease),
    padding 280ms var(--nc-ease),
    border-color 200ms var(--nc-ease);
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
  border-radius: 0.35rem;
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(13px * var(--nc-text-scale, 1)); line-height: 16px;
  letter-spacing: -0.005em;
  color: var(--medc-body);
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.medc-pill-btn:active { transform: scale(0.97); }
/* Selection treatment per REDESIGN.md §1: accent background + bg-ink text */
.medc-pill-btn--active {
  background: var(--medc-mint);
  color: var(--nc-bg);
  font-weight: 600;
}

/* Android refinements (slightly tighter top bar, Material radii) */
:root.platform-android .medc-top { padding: 8px 12px 0 12px; }
:root.platform-android .medc-iconbtn { border-radius: 999px; }
</style>
