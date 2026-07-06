<script setup lang="ts">
/**
 * Mobile More sheet — replaces the desktop ••• overflow menu on mobile.
 * Editorial nocturnal language: drag handle, mono breadcrumb, soft surface rows.
 */
import NcAiMark from '~/components/ui/NcAiMark.vue'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  isSaving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: []
  share: []
  'version-history': []
  comments: []
  'export-pdf': []
  'export-json': []
  'export-markdown': []
  'open-shortcuts': []
  settings: []
  'generate-map': []
}>()

type DispatchEvent = 'save' | 'share' | 'version-history' | 'comments' | 'export-pdf' | 'export-json' | 'export-markdown' | 'open-shortcuts' | 'settings' | 'generate-map'

function dispatch(event: DispatchEvent) {
  switch (event) {
    case 'save': emit('save'); break
    case 'share': emit('share'); break
    case 'version-history': emit('version-history'); break
    case 'comments': emit('comments'); break
    case 'export-pdf': emit('export-pdf'); break
    case 'export-json': emit('export-json'); break
    case 'export-markdown': emit('export-markdown'); break
    case 'open-shortcuts': emit('open-shortcuts'); break
    case 'settings': emit('settings'); break
    case 'generate-map': emit('generate-map'); break
  }
  emit('close')
}

// Lock body scroll while open
watch(() => props.visible, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="mms-fade">
      <div v-if="visible" class="mms-backdrop" @click="emit('close')" />
    </Transition>
    <Transition name="mms-slide">
      <section v-if="visible" class="mms" role="dialog" aria-modal="true" :aria-label="t('mobile.more.dialogLabel')">
        <button class="mms-handle" type="button" :aria-label="t('mobile.more.close')" @click="emit('close')">
          <span class="mms-handle-bar" />
        </button>
        <span class="mms-eyebrow">{{ t('mobile.more.eyebrow', { n: 9 }) }}</span>

        <div class="mms-group">
          <button class="mms-row" type="button" @click="dispatch('generate-map')">
            <div class="mms-icon mms-icon--mint">
              <NcAiMark :size="18" />
            </div>
            <div class="mms-text">
              <span class="mms-title">{{ t('mobile.more.generateMapTitle') }}</span>
              <span class="mms-hint">{{ t('mobile.more.generateMapHint') }}</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('save')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" />
                <path d="M17 21V13H7V21M7 3V8H15" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">{{ t('mobile.more.saveTitle') }}</span>
              <span class="mms-hint">{{ isSaving ? t('mobile.more.savingHint') : t('mobile.more.saveHint') }}</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('share')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">{{ t('mobile.more.shareTitle') }}</span>
              <span class="mms-hint">{{ t('mobile.more.shareHint') }}</span>
            </div>
          </button>

        </div>

        <span class="mms-section">{{ t('mobile.more.exportSection') }}</span>
        <div class="mms-group">
          <button class="mms-row" type="button" @click="dispatch('export-pdf')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" />
                <path d="M14 2V8H20" />
                <path d="M8.5 13H10C10.8 13 11.5 13.7 11.5 14.5C11.5 15.3 10.8 16 10 16H8.5V13ZM8.5 16V18M14 13H15.5V18M14 15.5H15.2" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">{{ t('mobile.more.pdfTitle') }}</span>
              <span class="mms-hint">{{ t('mobile.more.pdfHint') }}</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('export-markdown')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" />
                <path d="M14 2V8H20" />
                <path d="M8 13H16M8 17H13" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Markdown</span>
              <span class="mms-hint">{{ t('mobile.more.markdownHint') }}</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('export-json')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H7C5.89543 3 5 3.89543 5 5V8C5 9.10457 4.10457 10 3 10V14C4.10457 14 5 14.8954 5 16V19C5 20.1046 5.89543 21 7 21H8" />
                <path d="M16 3H17C18.1046 3 19 3.89543 19 5V8C19 9.10457 19.8954 10 21 10V14C19.8954 14 19 14.8954 19 16V19C19 20.1046 18.1046 21 17 21H16" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">JSON</span>
              <span class="mms-hint">{{ t('mobile.more.jsonHint') }}</span>
            </div>
          </button>
        </div>

        <span class="mms-section">{{ t('mobile.more.supportSection') }}</span>
        <div class="mms-group">
          <button class="mms-row" type="button" @click="dispatch('settings')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.43 12.98C19.47 12.66 19.5 12.34 19.5 12C19.5 11.66 19.47 11.34 19.43 11.02L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.97 19.05 5.05L16.56 6.05C16.04 5.65 15.48 5.32 14.87 5.07L14.49 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.51 2.42L9.13 5.07C8.52 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.72 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11.02C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.66 4.57 12.98L2.46 14.63C2.27 14.78 2.22 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.95C7.96 18.35 8.52 18.68 9.13 18.93L9.51 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.49 21.58L14.87 18.93C15.48 18.68 16.04 18.34 16.56 17.95L19.05 18.95C19.28 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98ZM12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12C15.5 13.93 13.93 15.5 12 15.5Z" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">{{ $t('common.nav.settings') }}</span>
              <span class="mms-hint">{{ $t('settings.general.theme').toUpperCase() }} · {{ $t('settings.tabs.ai_providers').toUpperCase() }} · {{ $t('settings.tabs.account').toUpperCase() }}</span>
            </div>
          </button>
        </div>

        <div class="mms-bottom-spacer" />
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Flat scrim — no blur in chrome (REDESIGN.md §5) */
.mms-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
}

/* Sheet grammar: flat surface-2 + hairline top (REDESIGN.md §5) */
.mms {
  position: fixed;
  left: 0; right: 0; bottom: var(--kbd-h, 0px);
  z-index: 201;
  display: flex; flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  padding: 0 18px;
  /* Clear the mobile tab dock (~70px) so the bottom actions sit above it. */
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 82px);
  transition: bottom 220ms var(--nc-ease);
  background: var(--nc-surface-2);
  border-top: 1px solid var(--nc-border);
  border-radius: 0.5rem 0.5rem 0 0;
  font-family: var(--nc-font-body);
  color: var(--nc-text);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  overflow-y: auto;
  box-sizing: border-box;
  scrollbar-width: none;
}
.mms::-webkit-scrollbar { display: none; }

.mms-handle {
  display: flex; justify-content: center; align-items: center;
  width: 100%; height: 28px;
  margin-top: 8px;
  background: transparent; border: none; padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}
/* Drag handle in --nc-border color (REDESIGN.md sheet grammar) */
.mms-handle-bar {
  width: 44px; height: 5px;
  border-radius: 999px;
  background: var(--nc-border);
}

.mms-eyebrow {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  margin: 6px 4px 14px;
  flex-shrink: 0;
}

.mms-section {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(10px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  margin: 22px 4px 10px;
  flex-shrink: 0;
}

.mms-group {
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  overflow: hidden;
  flex-shrink: 0;
}

.mms-row {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent; border: none;
  font-family: inherit; color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms var(--nc-ease), transform 120ms var(--nc-ease);
}
.mms-row:active { background: var(--nc-surface-3); transform: scale(0.97); }

.mms-icon {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 0.4rem;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  color: var(--nc-text);
  flex-shrink: 0;
}
.mms-icon--mint {
  background: rgba(var(--nc-accent-rgb), 0.10);
  border-color: rgba(var(--nc-accent-rgb), 0.28);
  color: var(--nc-accent-text);
}

.mms-text {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0;
  min-width: 0;
}
.mms-title {
  font-family: var(--nc-font-body);
  font-weight: 500; font-size: calc(14px * var(--nc-text-scale, 1)); line-height: 18px;
  letter-spacing: -0.005em;
  color: var(--nc-text);
}
.mms-hint {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(9px * var(--nc-text-scale, 1)); line-height: 12px;
  letter-spacing: 0.12em;
  color: var(--nc-text-muted);
}
.mms-shortcut {
  font-family: var(--nc-font-mono);
  font-weight: 500; font-size: calc(11px * var(--nc-text-scale, 1)); line-height: 14px;
  letter-spacing: 0.06em;
  color: var(--nc-text-muted);
  flex-shrink: 0;
  padding: 4px 8px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-subtle);
  border-radius: 0.4rem;
}

.mms-divider {
  height: 1px;
  background: var(--nc-border-subtle);
  margin: 0 16px;
}

.mms-bottom-spacer { height: 8px; flex-shrink: 0; }

/* Slide + fade transitions — single ease, percent-based translateY (§6) */
.mms-fade-enter-active, .mms-fade-leave-active { transition: opacity 220ms var(--nc-ease); }
.mms-fade-enter-from, .mms-fade-leave-to { opacity: 0; }

.mms-slide-enter-active { transition: transform 280ms var(--nc-ease); }
.mms-slide-leave-active { transition: transform 220ms var(--nc-ease); }
.mms-slide-enter-from, .mms-slide-leave-to { transform: translateY(100%); }
@media (prefers-reduced-motion: reduce) {
  .mms-slide-enter-active, .mms-slide-leave-active { transition: none; }
}
</style>
