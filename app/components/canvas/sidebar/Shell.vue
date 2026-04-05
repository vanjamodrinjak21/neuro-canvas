<script setup lang="ts">
import type { Node } from '~/types'
import type { AISuggestion, RichNodeSuggestion } from '~/types'
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

const {
  activeTab,
  setActiveTab,
  explorerHeight,
  startExplorerResize,
} = useSidebarState()

const tabs: { id: SidebarTab; label: string; icon: string }[] = [
  { id: 'explorer', label: 'Explorer', icon: 'i-lucide-search' },
  { id: 'properties', label: 'Properties', icon: 'i-lucide-layout-dashboard' },
  { id: 'ai', label: 'AI', icon: 'i-lucide-waypoints' },
]

// Sidebar width resize
const sidebarWidth = ref(300)
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
  <aside
    class="shell"
    :style="{ width: `${sidebarWidth}px`, minWidth: '280px', maxWidth: '400px' }"
  >
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
          Expand
        </button>
        <button
          class="shell__action-btn shell__action-btn--purple"
          @click="setActiveTab('ai')"
        >
          <span class="i-lucide-info shell__action-icon" />
          Insights
        </button>
      </div>
      <button
        class="shell__generate-btn"
        @click="dispatch({ type: 'ai:generate-map' })"
      >
        <span class="i-lucide-layout-grid shell__action-icon" />
        Generate map from topic
      </button>
    </template>

    <!-- Width resize handle (right edge) -->
    <div class="shell__resize-handle" @mousedown="startWidthResize" />
  </aside>
</template>

<style scoped>
.shell {
  height: 100%;
  min-height: 100vh;
  background: #0C0C0E;
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

/* Tab bar */
.shell__tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid #1A1A1E;
  flex-shrink: 0;
}

.shell__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  min-height: 32px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  color: var(--nc-ink-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.shell__tab:hover {
  color: #A1A1AA;
}

.shell__tab--active {
  color: #00D2BE;
  font-weight: 600;
  border-bottom-color: #00D2BE;
}

.shell__tab-icon {
  font-size: 13px;
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
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s;
  background: none;
}

.shell__action-btn--teal {
  background: rgba(0, 210, 190, 0.1);
  border-color: rgba(0, 210, 190, 0.2);
  color: #00D2BE;
}

.shell__action-btn--teal:hover {
  background: rgba(0, 210, 190, 0.15);
  border-color: rgba(0, 210, 190, 0.3);
}

.shell__action-btn--purple {
  background: rgba(167, 139, 250, 0.08);
  border-color: rgba(167, 139, 250, 0.2);
  color: #A78BFA;
}

.shell__action-btn--purple:hover {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.3);
}

.shell__action-icon {
  font-size: 13px;
}

.shell__generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0 14px 12px;
  padding: 9px;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  background: #111113;
  border: 1px solid #1A1A1E;
  color: #71717A;
  cursor: pointer;
  transition: all 0.15s;
}

.shell__generate-btn:hover {
  border-color: #27272A;
  color: #A1A1AA;
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
  transition: background 0.2s ease;
}

.shell__resize-handle:hover {
  background: var(--nc-accent-glow);
}

.shell__resize-handle:active {
  background: var(--nc-accent);
  opacity: 0.3;
}

/* Light theme */
:root.light .shell {
  background: #FFFFFF;
  border-right-color: #E8E8E6;
}

:root.light .shell__spacer {
  border-bottom-color: #E8E8E6;
}

:root.light .shell__tabs {
  border-bottom-color: #E8E8E6;
}

:root.light .shell__tab {
  color: #A1A1AA;
}

:root.light .shell__tab:hover {
  color: #71717A;
}

:root.light .shell__tab--active {
  color: #00D2BE;
  border-bottom-color: #00D2BE;
}

:root.light .shell__divider {
  background: #E8E8E6;
}

:root.light .shell__bottom-actions {
  border-top-color: #E8E8E6;
}

:root.light .shell__generate-btn {
  border-color: #E8E8E6;
  color: #71717A;
}

:root.light .shell__generate-btn:hover {
  border-color: #D4D4D8;
  color: #111111;
}
</style>
