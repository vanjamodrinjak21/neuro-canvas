<script setup lang="ts">
import type { Node, AISuggestion, RichNodeSuggestion  } from '~/types'
import type { SidebarAction } from '~/types/sidebar'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'
import { useSidebarState } from '~/composables/useSidebarState'
import type { SidebarTab } from '~/composables/useSidebarState'

/**
 * Shell — Sidebar orchestrator (tab-based layout)
 * Three tabs: Explorer, Properties, AI
 * Bottom action buttons + collapse footer
 */
const props = defineProps<{
  selectedNode: Node | null
  isAILoading?: boolean
  aiSuggestions?: AISuggestion[]
  richSuggestions?: RichNodeSuggestion[]
}>()

const emit = defineEmits<{
  action: [action: SidebarAction]
}>()

const { t } = useI18n()

const {
  activeTab,
  setActiveTab,
  explorerHeight,
  startExplorerResize,
} = useSidebarState()

// Auto-switch to properties tab when a node is selected
watch(() => props.selectedNode, (node) => {
  if (node) setActiveTab('properties')
})

const tabs = computed<{ id: SidebarTab; label: string; icon: string }[]>(() => [
  { id: 'explorer', label: t('canvas.sidebar.tab_explorer'), icon: 'i-lucide-search' },
  { id: 'properties', label: t('canvas.sidebar.tab_properties'), icon: 'i-lucide-layout-dashboard' },
  { id: 'ai', label: t('canvas.sidebar.tab_ai'), icon: 'i-nc-ai-mark' },
])

// Sidebar width resize
const sidebarWidth = ref(300)
// Single CSS custom property via v-bind — no inline :style (REDESIGN.md §9)
const sidebarWidthPx = computed(() => `${sidebarWidth.value}px`)
const isResizingWidth = ref(false)
const widthResizeStartX = ref(0)
const widthResizeStartWidth = ref(0)

function startWidthResize(event: MouseEvent) {
  isResizingWidth.value = true
  widthResizeStartX.value = event.clientX
  widthResizeStartWidth.value = sidebarWidth.value
  document.addEventListener('mousemove', handleWidthResize)
  document.addEventListener('mouseup', stopWidthResize)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

function handleWidthResize(event: MouseEvent) {
  if (!isResizingWidth.value) return
  const delta = event.clientX - widthResizeStartX.value
  sidebarWidth.value = Math.max(280, Math.min(400, widthResizeStartWidth.value + delta))
}

function stopWidthResize() {
  isResizingWidth.value = false
  document.removeEventListener('mousemove', handleWidthResize)
  document.removeEventListener('mouseup', stopWidthResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Provide dispatch to all children
function dispatch(action: SidebarAction) {
  emit('action', action)
}
provide(SIDEBAR_DISPATCH_KEY, dispatch)
</script>

<template>
  <aside class="shell">
    <!-- Top spacer for TopBar clearance -->
    <div class="shell__spacer" />

    <!-- Tab bar -->
    <div class="shell__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :class="['shell__tab', activeTab === tab.id && 'shell__tab--active']"
        @click="setActiveTab(tab.id)"
      >
        <span :class="[tab.icon, 'shell__tab-icon']" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content (scrollable) -->
    <div class="shell__content">
      <Transition name="nc-crossfade" mode="out-in">
        <div :key="activeTab" class="shell__tab-panel">
          <!-- Explorer tab -->
          <CanvasSidebarNodeExplorer
            v-if="activeTab === 'explorer'"
            :selected-node="selectedNode"
            :explorer-height="explorerHeight"
            @navigate-to-node="(id) => dispatch({ type: 'nav:navigate-to-node', nodeId: id })"
            @add-categorized-node="(cat) => dispatch({ type: 'node:add-categorized', category: cat })"
            @drag-start-category="(cat) => dispatch({ type: 'drag:start-category', category: cat })"
            @drag-start-node="(id) => dispatch({ type: 'drag:start-node', nodeId: id })"
            @start-resize="startExplorerResize"
          />

          <!-- Properties tab -->
          <CanvasSidebarNodeProperties
            v-if="activeTab === 'properties'"
            :selected-node="selectedNode"
            @delete-node="dispatch({ type: 'node:delete' })"
          />

          <!-- AI tab (AI Suggestions + Insights) -->
          <template v-if="activeTab === 'ai'">
            <LazyCanvasSidebarAISuggestionsPanel
              :selected-node="selectedNode"
              :is-a-i-loading="isAILoading"
              :ai-suggestions="aiSuggestions"
              :rich-suggestions="richSuggestions"
            />
            <div class="shell__divider" />
            <LazyCanvasInsightPanel
              @add-insight-node="(insight) => dispatch({ type: 'insight:add-node', insight })"
              @navigate-to-node="(id) => dispatch({ type: 'nav:navigate-to-node', nodeId: id })"
              @highlight-nodes="(ids) => dispatch({ type: 'insight:highlight-nodes', nodeIds: ids })"
              @clear-highlights="dispatch({ type: 'insight:clear-highlights' })"
            />
          </template>
        </div>
      </Transition>
    </div>

    <!-- Bottom actions (Explorer tab) -->
    <template v-if="activeTab === 'explorer'">
      <div class="shell__bottom-actions">
        <button
          class="shell__action-btn shell__action-btn--teal"
          @click="dispatch({ type: 'ai:smart-expand' })"
        >
          <span class="i-lucide-plus shell__action-icon" />
          {{ t('canvas.sidebar.action_expand') }}
        </button>
        <button
          class="shell__action-btn shell__action-btn--neutral"
          @click="setActiveTab('ai')"
        >
          <span class="i-lucide-info shell__action-icon" />
          {{ t('canvas.sidebar.action_insights') }}
        </button>
      </div>
      <button
        class="shell__generate-btn"
        @click="dispatch({ type: 'ai:generate-map' })"
      >
        <span class="i-lucide-layout-grid shell__action-icon" />
        {{ t('canvas.sidebar.generate_map_from_topic') }}
      </button>
    </template>

    <!-- Width resize handle (right edge) -->
    <div class="shell__resize-handle" @mousedown="startWidthResize" />
  </aside>
</template>

<style scoped>
.shell {
  width: v-bind(sidebarWidthPx);
  min-width: 280px;
  max-width: 400px;
  height: 100%;
  min-height: 100vh;
  background: var(--nc-surface);
  border-right: 1px solid var(--nc-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Top spacer for TopBar clearance */
.shell__spacer {
  height: 56px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--nc-border);
}

/* Tab bar — mono uppercase nav grammar (REDESIGN.md §5) */
.shell__tabs {
  display: flex;
  padding: 0 12px;
  border-bottom: 1px solid var(--nc-border);
  flex-shrink: 0;
}

.shell__tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 8px;
  min-height: 32px;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  color: var(--nc-text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 150ms var(--nc-ease), border-color 150ms var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .shell__tab:hover {
    color: var(--nc-text);
  }
}

/* Active tab = accent text + underline marker (never color alone) */
.shell__tab--active {
  color: var(--nc-accent-text);
  border-bottom-color: var(--nc-accent);
}

.shell__tab-icon {
  font-size: calc(13px * var(--nc-text-scale, 1));
}

/* Scrollable tab content */
.shell__content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
}

.shell__content::-webkit-scrollbar {
  width: 4px;
}

.shell__content::-webkit-scrollbar-track {
  background: transparent;
}

.shell__content::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 4px;
}

/* Divider between sections within a tab */
.shell__divider {
  height: 1px;
  background: var(--nc-border);
}

/* Bottom action buttons */
.shell__bottom-actions {
  display: flex;
  gap: 8px;
  padding: 14px 14px 8px;
  flex-shrink: 0;
  border-top: 1px solid var(--nc-border);
}

.shell__action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border-radius: 0.5rem;
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  border: 1px solid;
  cursor: pointer;
  transition: color 150ms var(--nc-ease),
              background 150ms var(--nc-ease),
              border-color 150ms var(--nc-ease),
              transform var(--nc-duration-press) var(--nc-ease);
  background: none;
}

.shell__action-btn:active {
  transform: scale(0.97);
}

/* Accent chip — the AI expand action (cyan = interactive/hot) */
.shell__action-btn--teal {
  background: rgba(var(--nc-accent-rgb), 0.1);
  border-color: rgba(var(--nc-accent-rgb), 0.2);
  color: var(--nc-accent-text);
}

@media (hover: hover) and (pointer: fine) {
  .shell__action-btn--teal:hover {
    background: rgba(var(--nc-accent-rgb), 0.15);
    border-color: rgba(var(--nc-accent-rgb), 0.3);
  }
}

/* Neutral chip — secondary action; no second interactive hue (REDESIGN.md §1) */
.shell__action-btn--neutral {
  background: var(--nc-chip-bg);
  border-color: var(--nc-border);
  color: var(--nc-text-secondary);
}

@media (hover: hover) and (pointer: fine) {
  .shell__action-btn--neutral:hover {
    background: var(--nc-surface-3);
    color: var(--nc-text);
  }
}

.shell__action-icon {
  font-size: calc(13px * var(--nc-text-scale, 1));
}

/* Primary CTA — ink pill grammar (REDESIGN.md §5): bg ink, text bg,
   pill radius, hover flips to accent. Theme-aware via tokens. */
.shell__generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 14px 12px;
  padding: 11px 18px;
  border-radius: 2.4rem;
  font-family: var(--nc-font-display);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
  background: var(--nc-text);
  border: none;
  color: var(--nc-bg);
  cursor: pointer;
  transition: background 150ms var(--nc-ease),
              color 150ms var(--nc-ease),
              transform 120ms var(--nc-ease);
}

@media (hover: hover) and (pointer: fine) {
  .shell__generate-btn:hover {
    background: var(--nc-accent);
    color: var(--nc-bg);
    transform: translateY(-1px);
  }
}

.shell__generate-btn:active {
  transform: scale(0.97);
}

.shell__generate-btn:focus-visible {
  outline: 2px solid var(--nc-accent);
  outline-offset: 3px;
}

/* Width resize handle */
.shell__resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  z-index: 20;
  transition: background 200ms var(--nc-ease);
}

.shell__resize-handle:hover {
  background: var(--nc-accent-glow);
}

.shell__resize-handle:active {
  background: var(--nc-accent);
  opacity: 0.3;
}
</style>
