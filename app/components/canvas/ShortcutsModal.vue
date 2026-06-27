<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

interface ShortcutItem {
  description: string
  keys: string[]
}

interface ShortcutGroup {
  label: string
  items: ShortcutItem[]
}

const SHORTCUT_GROUPS = computed<ShortcutGroup[]>(() => [
  {
    label: t('canvas.shortcuts.navigation'),
    items: [
      { description: t('canvas.shortcuts.pan_canvas'), keys: ['Space', 'Drag'] },
      { description: t('canvas.shortcuts.zoom_in'), keys: ['⌘', '+'] },
      { description: t('canvas.shortcuts.zoom_out'), keys: ['⌘', '−'] },
      { description: t('canvas.shortcuts.fit_to_screen'), keys: ['F'] },
      { description: t('canvas.shortcuts.arrow_pan'), keys: ['←', '→', '↑', '↓'] },
      { description: t('canvas.shortcuts.reset_zoom'), keys: ['1'] },
    ]
  },
  {
    label: t('canvas.shortcuts.tools'),
    items: [
      { description: t('canvas.shortcuts.select_tool_desc'), keys: ['V'] },
      { description: t('canvas.shortcuts.pan_tool_desc'), keys: ['H'] },
      { description: t('canvas.shortcuts.add_node_desc'), keys: ['N'] },
      { description: t('canvas.shortcuts.connect_desc'), keys: ['C'] },
      { description: t('canvas.shortcuts.templates_desc'), keys: ['T'] },
    ]
  },
  {
    label: t('canvas.shortcuts.editing'),
    items: [
      { description: t('canvas.shortcuts.delete'), keys: ['⌫'] },
      { description: t('canvas.shortcuts.edit_node'), keys: ['Double-click'] },
      { description: t('canvas.shortcuts.duplicate'), keys: ['⌘', 'D'] },
      { description: t('canvas.shortcuts.select_all'), keys: ['⌘', 'A'] },
      { description: t('canvas.overflow_menu.undo'), keys: ['⌘', 'Z'] },
      { description: t('canvas.overflow_menu.redo'), keys: ['⌘', '⇧', 'Z'] },
    ]
  },
  {
    label: t('canvas.shortcuts.graph_links'),
    items: [
      { description: t('canvas.shortcuts.open_graph'), keys: ['⌘', 'G'] },
      { description: t('canvas.shortcuts.toggle_backlinks'), keys: ['⌘', 'B'] },
      { description: t('canvas.shortcuts.toggle_semantic'), keys: ['S'] },
    ]
  },
  {
    label: t('canvas.shortcuts.ai_features'),
    items: [
      { description: t('canvas.shortcuts.ai_expand_desc'), keys: ['⌘', 'E'] },
      { description: t('canvas.shortcuts.accept_suggestion'), keys: ['⌘', '↵'] },
    ]
  }
])

const query = ref('')

const FILTERED_GROUPS = computed<ShortcutGroup[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return SHORTCUT_GROUPS.value
  return SHORTCUT_GROUPS.value
    .map(group => ({
      label: group.label,
      items: group.items.filter(it =>
        it.description.toLowerCase().includes(q) ||
        it.keys.some(k => k.toLowerCase().includes(q))
      )
    }))
    .filter(g => g.items.length > 0)
})

const totalShown = computed(() =>
  FILTERED_GROUPS.value.reduce((acc, g) => acc + g.items.length, 0)
)

// Close on escape
onKeyStroke('Escape', () => emit('close'))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal sm-shortcuts-backdrop"
        @click="emit('close')"
      >
        <Transition
          enter-active-class="transition-all duration-250 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 translate-y-2 scale-[0.98]"
          leave-to-class="opacity-0 translate-y-1 scale-[0.99]"
          appear
        >
          <div
            v-if="visible"
            class="sm-shortcuts-card"
            @click.stop
          >
            <header class="sm-shortcuts-header">
              <div class="sm-shortcuts-eyebrow">{{ $t('canvas.shortcuts.title') }}</div>
              <h2 class="sm-shortcuts-title">
                <span>Speed up your</span>
                <em>flow.</em>
              </h2>
              <button
                class="sm-shortcuts-close"
                :aria-label="$t('canvas.shortcuts.close') || 'Close'"
                @click="emit('close')"
              >
                <span class="i-lucide-x text-base" />
              </button>
            </header>

            <div class="sm-shortcuts-search">
              <span class="i-lucide-search sm-shortcuts-search-icon" />
              <input
                v-model="query"
                type="text"
                :placeholder="$t('canvas.shortcuts.search') || 'Search shortcuts'"
                class="sm-shortcuts-search-input"
              >
              <kbd v-if="!query" class="sm-shortcuts-search-hint">/</kbd>
            </div>

            <div class="sm-shortcuts-body">
              <template v-if="totalShown > 0">
                <section
                  v-for="group in FILTERED_GROUPS"
                  :key="group.label"
                  class="sm-shortcuts-group"
                >
                  <div class="sm-shortcuts-section">
                    <span class="sm-shortcuts-section-tick" />
                    <span class="sm-shortcuts-section-label">{{ group.label }}</span>
                  </div>
                  <ul class="sm-shortcuts-list">
                    <li
                      v-for="item in group.items"
                      :key="item.description"
                      class="sm-shortcuts-row"
                    >
                      <span class="sm-shortcuts-desc">{{ item.description }}</span>
                      <span class="sm-shortcuts-keys">
                        <template v-for="(key, idx) in item.keys" :key="idx">
                          <kbd class="sm-shortcuts-kbd">{{ key }}</kbd>
                          <span
                            v-if="idx < item.keys.length - 1"
                            class="sm-shortcuts-sep"
                            aria-hidden="true"
                          >+</span>
                        </template>
                      </span>
                    </li>
                  </ul>
                </section>
              </template>
              <div v-else class="sm-shortcuts-empty">
                <span class="i-lucide-search-x text-2xl" />
                <p>{{ $t('canvas.shortcuts.no_results') || 'No shortcuts match your search.' }}</p>
              </div>
            </div>

            <footer class="sm-shortcuts-footer">
              <span class="sm-shortcuts-footer-hint">
                <kbd class="sm-shortcuts-kbd sm-shortcuts-kbd-quiet">?</kbd>
                {{ $t('canvas.shortcuts.toggle_hint') || 'Toggle this panel anytime' }}
              </span>
              <button
                class="sm-shortcuts-footer-link"
                @click="emit('close')"
              >
                {{ $t('canvas.shortcuts.got_it') || 'Got it' }}
                <span class="i-lucide-arrow-right text-sm" />
              </button>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sm-shortcuts-backdrop {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.sm-shortcuts-card {
  position: relative;
  width: min(640px, calc(100vw - 32px));
  max-height: min(86vh, 880px);
  display: flex;
  flex-direction: column;
  background: var(--nc-surface, #111114);
  border: 1px solid var(--nc-border, #1E1E22);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.sm-shortcuts-header {
  position: relative;
  padding: 28px 32px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.sm-shortcuts-eyebrow {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-ink-soft, #A1A1AA);
  font-weight: 500;
  margin-bottom: 10px;
}

.sm-shortcuts-title {
  font-size: calc(28px * var(--nc-text-scale, 1));
  line-height: 1.05;
  font-weight: 600;
  letter-spacing: -0.022em;
  color: #FAFAFA;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.sm-shortcuts-title em {
  font-family: 'Instrument Serif', 'Times New Roman', serif;
  font-style: italic;
  font-weight: 400;
  font-size: 1.05em;
  letter-spacing: -0.01em;
  color: #00D2BE;
}

.sm-shortcuts-close {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #A1A1AA;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease;
}

.sm-shortcuts-close:hover {
  color: #FAFAFA;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.10);
}

/* Search */
.sm-shortcuts-search {
  position: relative;
  margin: 16px 24px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: border-color 160ms ease, background 160ms ease;
}

.sm-shortcuts-search:focus-within {
  border-color: rgba(0, 210, 190, 0.35);
  background: rgba(0, 210, 190, 0.04);
}

.sm-shortcuts-search-icon {
  color: #71717A;
  flex-shrink: 0;
  font-size: calc(16px * var(--nc-text-scale, 1));
}

.sm-shortcuts-search-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  color: #FAFAFA;
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-family: inherit;
  letter-spacing: -0.005em;
}

.sm-shortcuts-search-input::placeholder {
  color: #52525B;
}

.sm-shortcuts-search-hint {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: #71717A;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 5px;
  font-weight: 500;
}

/* Body / scrollable area */
.sm-shortcuts-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.sm-shortcuts-body::-webkit-scrollbar {
  width: 8px;
}
.sm-shortcuts-body::-webkit-scrollbar-track {
  background: transparent;
}
.sm-shortcuts-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
}
.sm-shortcuts-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

.sm-shortcuts-group {
  padding: 12px 0;
}

.sm-shortcuts-group + .sm-shortcuts-group {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.sm-shortcuts-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 0 8px;
}

.sm-shortcuts-section-tick {
  width: 14px;
  height: 1px;
  background: rgba(0, 210, 190, 0.7);
  flex-shrink: 0;
}

.sm-shortcuts-section-label {
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #A1A1AA;
  font-weight: 600;
}

.sm-shortcuts-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.sm-shortcuts-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 140ms ease;
}

.sm-shortcuts-row:hover {
  background: rgba(255, 255, 255, 0.025);
}

.sm-shortcuts-desc {
  font-size: calc(13.5px * var(--nc-text-scale, 1));
  color: #D4D4D8;
  letter-spacing: -0.005em;
}

.sm-shortcuts-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.sm-shortcuts-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: #E4E4E7;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom-color: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
  letter-spacing: 0;
  white-space: nowrap;
}

.sm-shortcuts-kbd-quiet {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.06);
  color: #A1A1AA;
  box-shadow: none;
}

.sm-shortcuts-sep {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: #52525B;
  font-weight: 400;
}

.sm-shortcuts-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  gap: 12px;
  color: #71717A;
  text-align: center;
}

.sm-shortcuts-empty p {
  margin: 0;
  font-size: calc(13.5px * var(--nc-text-scale, 1));
}

/* Footer */
.sm-shortcuts-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.18);
}

.sm-shortcuts-footer-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: #71717A;
}

.sm-shortcuts-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  color: #00D2BE;
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  padding: 6px 4px;
  border-radius: 6px;
  transition: color 140ms ease, transform 140ms ease;
}

.sm-shortcuts-footer-link:hover {
  color: #00FFE5;
}

.sm-shortcuts-footer-link:hover .i-lucide-arrow-right {
  transform: translateX(2px);
}

.sm-shortcuts-footer-link .i-lucide-arrow-right {
  transition: transform 160ms ease;
}

/* Light theme */
:global(html.light) .sm-shortcuts-backdrop {
  background: radial-gradient(ellipse at center, rgba(245, 245, 244, 0.85) 0%, rgba(220, 220, 218, 0.92) 100%);
}

:global(html.light) .sm-shortcuts-card {
  background: linear-gradient(180deg, #FFFFFF 0%, #FAFAF9 100%);
  border-color: rgba(0, 0, 0, 0.06);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 32px 80px -20px rgba(0, 0, 0, 0.18),
    0 0 0 1px rgba(0, 0, 0, 0.04);
}

:global(html.light) .sm-shortcuts-title { color: #111111; }
:global(html.light) .sm-shortcuts-title em { color: #00A89A; }
:global(html.light) .sm-shortcuts-eyebrow { color: #00A89A; }
:global(html.light) .sm-shortcuts-header { border-bottom-color: rgba(0, 0, 0, 0.06); }
:global(html.light) .sm-shortcuts-close { color: #777; border-color: rgba(0, 0, 0, 0.08); }
:global(html.light) .sm-shortcuts-close:hover { color: #111; background: rgba(0, 0, 0, 0.03); border-color: rgba(0, 0, 0, 0.12); }
:global(html.light) .sm-shortcuts-search { background: rgba(0, 0, 0, 0.025); border-color: rgba(0, 0, 0, 0.06); }
:global(html.light) .sm-shortcuts-search:focus-within { background: rgba(0, 178, 168, 0.05); border-color: rgba(0, 178, 168, 0.4); }
:global(html.light) .sm-shortcuts-search-input { color: #111; }
:global(html.light) .sm-shortcuts-search-input::placeholder { color: #A1A1AA; }
:global(html.light) .sm-shortcuts-search-hint { color: #777; background: rgba(0, 0, 0, 0.04); border-color: rgba(0, 0, 0, 0.08); }
:global(html.light) .sm-shortcuts-section-label { color: #777; }
:global(html.light) .sm-shortcuts-section-tick { background: rgba(0, 178, 168, 0.7); }
:global(html.light) .sm-shortcuts-row:hover { background: rgba(0, 0, 0, 0.025); }
:global(html.light) .sm-shortcuts-desc { color: #444; }
:global(html.light) .sm-shortcuts-kbd { color: #333; background: #FFFFFF; border-color: rgba(0, 0, 0, 0.10); border-bottom-color: rgba(0, 0, 0, 0.16); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04); }
:global(html.light) .sm-shortcuts-kbd-quiet { background: transparent; border-color: rgba(0, 0, 0, 0.10); color: #777; box-shadow: none; }
:global(html.light) .sm-shortcuts-sep { color: #A1A1AA; }
:global(html.light) .sm-shortcuts-empty { color: #999; }
:global(html.light) .sm-shortcuts-footer { background: rgba(0, 0, 0, 0.02); border-top-color: rgba(0, 0, 0, 0.06); }
:global(html.light) .sm-shortcuts-footer-hint { color: #888; }
:global(html.light) .sm-shortcuts-footer-link { color: #00A89A; }
:global(html.light) .sm-shortcuts-footer-link:hover { color: #009487; }
:global(html.light) .sm-shortcuts-group + .sm-shortcuts-group { border-top-color: rgba(0, 0, 0, 0.05); }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .sm-shortcuts-card,
  .sm-shortcuts-row,
  .sm-shortcuts-close,
  .sm-shortcuts-footer-link,
  .sm-shortcuts-footer-link .i-lucide-arrow-right {
    transition: none;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .sm-shortcuts-card {
    width: calc(100vw - 16px);
    max-height: 92vh;
    border-radius: 18px;
  }
  .sm-shortcuts-header { padding: 22px 22px 16px; }
  .sm-shortcuts-search { margin: 12px 16px 6px; }
  .sm-shortcuts-body { padding: 12px 16px; }
  .sm-shortcuts-footer { padding: 12px 18px; }
  .sm-shortcuts-title { font-size: calc(24px * var(--nc-text-scale, 1)); }
}
</style>
