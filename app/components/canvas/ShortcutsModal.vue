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
      { description: t('canvas.shortcuts.command_palette'), keys: ['⌘', 'K'] },
      { description: t('canvas.shortcuts.semantic_search'), keys: ['⌘', '⇧', 'K'] },
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
    <!-- Keyboard-initiated ('?') — no animated entrance (REDESIGN.md §6):
         opacity-only, <=100ms, no movement. -->
    <Transition
      enter-active-class="sm-fade-active"
      leave-active-class="sm-fade-active"
      enter-from-class="sm-fade-hidden"
      leave-to-class="sm-fade-hidden"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal sm-shortcuts-backdrop"
        @click="emit('close')"
      >
        <Transition
          enter-active-class="sm-fade-active"
          leave-active-class="sm-fade-active"
          enter-from-class="sm-fade-hidden"
          leave-to-class="sm-fade-hidden"
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
/* Keyboard-initiated UI must not animate (REDESIGN.md §6):
   opacity-only, 100ms max, no transform. */
.sm-fade-active {
  transition: opacity 100ms var(--nc-ease);
}

.sm-fade-hidden {
  opacity: 0;
}

.sm-shortcuts-backdrop {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

/* Dialog — flat surface-2 + hairline (REDESIGN.md §5); tokens flip for light */
.sm-shortcuts-card {
  position: relative;
  width: min(640px, calc(100vw - 32px));
  max-height: min(86vh, 880px);
  display: flex;
  flex-direction: column;
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  box-shadow: var(--nc-shadow-md);
  overflow: hidden;
  font-family: var(--nc-font-body);
}

.sm-shortcuts-header {
  position: relative;
  padding: 28px 32px 20px;
  border-bottom: 1px solid var(--nc-border-subtle);
}

/* Eyebrow — mono uppercase micro-label (REDESIGN.md §4) */
.sm-shortcuts-eyebrow {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--nc-text-secondary);
  font-weight: 500;
  margin-bottom: 10px;
}

/* Modal title — display face (REDESIGN.md §4) */
.sm-shortcuts-title {
  font-family: var(--nc-font-display);
  font-size: calc(28px * var(--nc-text-scale, 1));
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--nc-text);
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

/* Serif italic accent — once per title (REDESIGN.md §4) */
.sm-shortcuts-title em {
  font-family: var(--nc-font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: 1.05em;
  letter-spacing: -0.01em;
  color: var(--nc-accent-text);
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
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--nc-border-subtle);
  color: var(--nc-text-secondary);
  cursor: pointer;
  transition:
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sm-shortcuts-close:hover {
    color: var(--nc-text);
    background: var(--nc-surface-3);
    border-color: var(--nc-border);
  }
}

.sm-shortcuts-close:active {
  transform: scale(0.97);
}

/* Search — chip fill, hairline; focus = accent border only (REDESIGN.md §5) */
.sm-shortcuts-search {
  position: relative;
  margin: 16px 24px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border-input);
  border-radius: 0.5rem;
  transition: border-color 150ms var(--nc-ease);
}

.sm-shortcuts-search:focus-within {
  border-color: var(--nc-accent);
}

.sm-shortcuts-search-icon {
  color: var(--nc-text-muted);
  flex-shrink: 0;
  font-size: calc(16px * var(--nc-text-scale, 1));
}

.sm-shortcuts-search-input {
  flex: 1;
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--nc-text);
  font-size: calc(14px * var(--nc-text-scale, 1));
  font-family: inherit;
  letter-spacing: -0.005em;
}

.sm-shortcuts-search-input::placeholder {
  color: var(--nc-text-dim);
}

.sm-shortcuts-search-hint {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  padding: 2px 7px;
  border-radius: 0.35rem;
  font-weight: 500;
}

/* Body / scrollable area */
.sm-shortcuts-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-border) transparent;
}

.sm-shortcuts-body::-webkit-scrollbar {
  width: 8px;
}
.sm-shortcuts-body::-webkit-scrollbar-track {
  background: transparent;
}
.sm-shortcuts-body::-webkit-scrollbar-thumb {
  background: var(--nc-border-subtle);
  border-radius: 999px;
}
.sm-shortcuts-body::-webkit-scrollbar-thumb:hover {
  background: var(--nc-border);
}

.sm-shortcuts-group {
  padding: 12px 0;
}

.sm-shortcuts-group + .sm-shortcuts-group {
  border-top: 1px solid var(--nc-border-subtle);
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
  background: rgba(var(--nc-accent-rgb), 0.7);
  flex-shrink: 0;
}

/* Section header — mono uppercase micro-label (REDESIGN.md §4) */
.sm-shortcuts-section-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--nc-text-secondary);
  font-weight: 500;
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
  border-radius: 0.5rem;
  transition: background 150ms var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sm-shortcuts-row:hover {
    background: var(--nc-surface-3);
  }
}

.sm-shortcuts-desc {
  font-size: calc(13.5px * var(--nc-text-scale, 1));
  color: var(--nc-text);
  letter-spacing: -0.005em;
}

.sm-shortcuts-keys {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* kbd — mono chip on hairline (REDESIGN.md §5 tooltip/chip grammar) */
.sm-shortcuts-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-secondary);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.35rem;
  letter-spacing: 0;
  white-space: nowrap;
}

.sm-shortcuts-kbd-quiet {
  background: transparent;
  border-color: var(--nc-border-subtle);
  color: var(--nc-text-secondary);
}

.sm-shortcuts-sep {
  font-family: var(--nc-font-mono);
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  font-weight: 400;
}

.sm-shortcuts-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  gap: 12px;
  color: var(--nc-text-muted);
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
  border-top: 1px solid var(--nc-border-subtle);
  background: var(--nc-surface);
}

.sm-shortcuts-footer-hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: calc(12px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.sm-shortcuts-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0;
  color: var(--nc-accent-text);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  padding: 6px 4px;
  border-radius: 6px;
  transition: transform var(--nc-duration-press) var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .sm-shortcuts-footer-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.35em;
  }

  .sm-shortcuts-footer-link:hover .i-lucide-arrow-right {
    transform: translateX(2px);
  }
}

.sm-shortcuts-footer-link:active {
  transform: scale(0.97);
}

.sm-shortcuts-footer-link .i-lucide-arrow-right {
  transition: transform 150ms var(--nc-ease);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .sm-fade-active,
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
  }
  .sm-shortcuts-header { padding: 22px 22px 16px; }
  .sm-shortcuts-search { margin: 12px 16px 6px; }
  .sm-shortcuts-body { padding: 12px 16px; }
  .sm-shortcuts-footer { padding: 12px 18px; }
  .sm-shortcuts-title { font-size: calc(24px * var(--nc-text-scale, 1)); }
}
</style>
