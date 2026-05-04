<script setup lang="ts">
/**
 * Mobile More sheet — replaces the desktop ••• overflow menu on mobile.
 * Editorial nocturnal language: drag handle, mono breadcrumb, soft surface rows.
 */

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
  'export-png': []
  'export-json': []
  'export-markdown': []
  'open-shortcuts': []
  settings: []
  'generate-map': []
}>()

type DispatchEvent = 'save' | 'share' | 'version-history' | 'comments' | 'export-png' | 'export-json' | 'export-markdown' | 'open-shortcuts' | 'settings' | 'generate-map'

function dispatch(event: DispatchEvent) {
  switch (event) {
    case 'save': emit('save'); break
    case 'share': emit('share'); break
    case 'version-history': emit('version-history'); break
    case 'comments': emit('comments'); break
    case 'export-png': emit('export-png'); break
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
      <section v-if="visible" class="mms" role="dialog" aria-modal="true" aria-label="More actions">
        <button class="mms-handle" type="button" :aria-label="'Close'" @click="emit('close')">
          <span class="mms-handle-bar" />
        </button>
        <span class="mms-eyebrow">MORE — 9 OPTIONS</span>

        <div class="mms-group">
          <button class="mms-row" type="button" @click="dispatch('generate-map')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
                <path d="M19 17L19.7 19L21.5 19.5L19.7 20L19 22L18.3 20L16.5 19.5L18.3 19L19 17Z" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Generate map with AI</span>
              <span class="mms-hint">TOPIC · BRANCHES · STREAMING</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('save')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16L21 8V19C21 20.1046 20.1046 21 19 21Z" />
                <path d="M17 21V13H7V21M7 3V8H15" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Save</span>
              <span class="mms-hint">{{ isSaving ? 'SAVING…' : 'CMD · S' }}</span>
            </div>
            <span class="mms-shortcut">⌘S</span>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('share')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Share</span>
              <span class="mms-hint">LINK · COLLAB · PUBLIC</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('version-history')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C8.5 3 5.5 5 4 7.5" />
                <path d="M3 4V8H7" />
                <path d="M12 7V12L15 14" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Version history</span>
              <span class="mms-hint">RESTORE · COMPARE · BRANCH</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('comments')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5C21 16.7467 16.7467 21 11.5 21C9.97186 21 8.5314 20.6398 7.25 20H3L4.5 16.0625C3.5314 14.7186 3 13.1719 3 11.5C3 6.25329 7.25329 2 12.5 2C16.7467 2 21 6.25329 21 11.5Z" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Comments</span>
              <span class="mms-hint">DISCUSS · ANNOTATE · MENTION</span>
            </div>
          </button>
        </div>

        <span class="mms-section">EXPORT</span>
        <div class="mms-group">
          <button class="mms-row" type="button" @click="dispatch('export-png')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15L16 10L5 21" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">PNG image</span>
              <span class="mms-hint">CANVAS · 2× RETINA</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('export-markdown')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" />
                <path d="M14 2V8H20" />
                <path d="M8 13H16M8 17H13" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Markdown</span>
              <span class="mms-hint">.MD · OBSIDIAN COMPATIBLE</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('export-json')">
            <div class="mms-icon mms-icon--mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D2BE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H7C5.89543 3 5 3.89543 5 5V8C5 9.10457 4.10457 10 3 10V14C4.10457 14 5 14.8954 5 16V19C5 20.1046 5.89543 21 7 21H8" />
                <path d="M16 3H17C18.1046 3 19 3.89543 19 5V8C19 9.10457 19.8954 10 21 10V14C19.8954 14 19 14.8954 19 16V19C19 20.1046 18.1046 21 17 21H16" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">JSON</span>
              <span class="mms-hint">.JSON · FULL FIDELITY</span>
            </div>
          </button>
        </div>

        <span class="mms-section">SUPPORT</span>
        <div class="mms-group">
          <button class="mms-row" type="button" @click="dispatch('open-shortcuts')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FAFAFA" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10H6.01M10 10H10.01M14 10H14.01M18 10H18.01M6 14H6.01M18 14H18.01M10 14H14" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Keyboard shortcuts</span>
              <span class="mms-hint">REFERENCE · SEARCHABLE</span>
            </div>
          </button>

          <div class="mms-divider" />

          <button class="mms-row" type="button" @click="dispatch('settings')">
            <div class="mms-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#FAFAFA">
                <path d="M19.43 12.98C19.47 12.66 19.5 12.34 19.5 12C19.5 11.66 19.47 11.34 19.43 11.02L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.97 19.05 5.05L16.56 6.05C16.04 5.65 15.48 5.32 14.87 5.07L14.49 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.51 2.42L9.13 5.07C8.52 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.72 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.21 8.95 2.27 9.22 2.46 9.37L4.57 11.02C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.66 4.57 12.98L2.46 14.63C2.27 14.78 2.22 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.95C7.96 18.35 8.52 18.68 9.13 18.93L9.51 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.49 21.58L14.87 18.93C15.48 18.68 16.04 18.34 16.56 17.95L19.05 18.95C19.28 19.04 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.98ZM12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12C15.5 13.93 13.93 15.5 12 15.5Z" />
              </svg>
            </div>
            <div class="mms-text">
              <span class="mms-title">Settings</span>
              <span class="mms-hint">THEME · AI · ACCOUNT</span>
            </div>
          </button>
        </div>

        <div class="mms-bottom-spacer" />
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mms-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  z-index: 200;
}

.mms {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 201;
  display: flex; flex-direction: column;
  width: 100%;
  max-height: 90dvh;
  padding: 0 18px;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
  background: #09090B;
  border-top: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 24px 24px 0 0;
  font-family: 'Inter', system-ui, sans-serif;
  color: #FAFAFA;
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
.mms-handle-bar {
  width: 44px; height: 5px;
  border-radius: 999px;
  background: rgba(250, 250, 250, 0.18);
}

.mms-eyebrow {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.14em;
  color: #00D2BE;
  margin: 6px 4px 14px;
  flex-shrink: 0;
}

.mms-section {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 10px; line-height: 14px;
  letter-spacing: 0.14em;
  color: #52525B;
  margin: 22px 4px 10px;
  flex-shrink: 0;
}

.mms-group {
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.10);
  border-radius: 16px;
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
  transition: background 150ms ease;
}
.mms-row:active { background: rgba(250, 250, 250, 0.05); }

.mms-icon {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border-radius: 9px;
  background: rgba(250, 250, 250, 0.05);
  border: 1px solid rgba(250, 250, 250, 0.08);
  flex-shrink: 0;
}
.mms-icon--mint {
  background: rgba(0, 210, 190, 0.10);
  border-color: rgba(0, 210, 190, 0.28);
}

.mms-text {
  display: flex; flex-direction: column; gap: 4px;
  flex: 1 1 0;
  min-width: 0;
}
.mms-title {
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 500; font-size: 14px; line-height: 18px;
  letter-spacing: -0.005em;
  color: #FAFAFA;
}
.mms-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 9px; line-height: 12px;
  letter-spacing: 0.12em;
  color: #52525B;
}
.mms-shortcut {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-weight: 500; font-size: 11px; line-height: 14px;
  letter-spacing: 0.06em;
  color: #71717A;
  flex-shrink: 0;
  padding: 4px 8px;
  background: rgba(250, 250, 250, 0.04);
  border: 1px solid rgba(250, 250, 250, 0.08);
  border-radius: 6px;
}

.mms-divider {
  height: 1px;
  background: rgba(250, 250, 250, 0.06);
  margin: 0 16px;
}

.mms-bottom-spacer { height: 8px; flex-shrink: 0; }

/* Slide + fade transitions */
.mms-fade-enter-active, .mms-fade-leave-active { transition: opacity 220ms ease; }
.mms-fade-enter-from, .mms-fade-leave-to { opacity: 0; }

.mms-slide-enter-active { transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1); }
.mms-slide-leave-active { transition: transform 220ms cubic-bezier(0.32, 0.72, 0, 1); }
.mms-slide-enter-from, .mms-slide-leave-to { transform: translateY(100%); }

/* Light mode */
:root.light .mms {
  background: #FAFAF9;
  color: #18181B;
  border-top-color: rgba(0, 0, 0, 0.08);
}
:root.light .mms-handle-bar { background: rgba(0, 0, 0, 0.18); }
:root.light .mms-group { background: rgba(0, 0, 0, 0.03); border-color: rgba(0, 0, 0, 0.10); }
:root.light .mms-icon { background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.08); }
:root.light .mms-divider { background: rgba(0, 0, 0, 0.06); }
:root.light .mms-title { color: #18181B; }
:root.light .mms-shortcut { background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.08); color: #52525B; }

/* Android: snappier radii */
:root.platform-android .mms { border-radius: 20px 20px 0 0; }
:root.platform-android .mms-group { border-radius: 14px; }
</style>
