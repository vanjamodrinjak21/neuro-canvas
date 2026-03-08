<script setup lang="ts">
import type { Node } from '~/types'
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import type { SidebarAction } from '~/types/sidebar'
import { SIDEBAR_DISPATCH_KEY } from '~/types/sidebar'
import { useSidebarState } from '~/composables/useSidebarState'

/**
 * Shell — Sidebar orchestrator
 * Composes all sidebar sections, provides the dispatch injection,
 * and manages sidebar width resize.
 *
 * Resolves as CanvasSidebarShell via Nuxt auto-imports.
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

// Sidebar state (section collapse, explorer resize, agent panel)
const {
  collapsedSections,
  explorerHeight,
  showAgentPanel,
  toggleSection,
  startExplorerResize,
} = useSidebarState()

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
    <!-- Scrollable content -->
    <div class="shell__scroll">
      <!-- Node Explorer -->
      <CanvasSidebarNodeExplorer
        :selected-node="selectedNode"
        :explorer-height="explorerHeight"
        :collapsed="collapsedSections.explorer"
        @toggle="toggleSection('explorer')"
        @navigate-to-node="(id) => dispatch({ type: 'nav:navigate-to-node', nodeId: id })"
        @add-categorized-node="(cat) => dispatch({ type: 'node:add-categorized', category: cat })"
        @drag-start-category="(cat) => dispatch({ type: 'drag:start-category', category: cat })"
        @drag-start-node="(id) => dispatch({ type: 'drag:start-node', nodeId: id })"
        @start-resize="startExplorerResize"
      />

      <div class="shell__gap" />

      <!-- Node Properties -->
      <CanvasSidebarNodeProperties
        :selected-node="selectedNode"
        :collapsed="collapsedSections.properties"
        @toggle="toggleSection('properties')"
        @delete-node="dispatch({ type: 'node:delete' })"
      />

      <div class="shell__gap" />

      <!-- AI Suggestions -->
      <CanvasSidebarAISuggestionsPanel
        :selected-node="selectedNode"
        :is-a-i-loading="isAILoading"
        :ai-suggestions="aiSuggestions"
        :rich-suggestions="richSuggestions"
        :collapsed="collapsedSections.ai"
        @toggle="toggleSection('ai')"
      />

      <div class="shell__gap" />

      <!-- Insights -->
      <CanvasInsightPanel
        @add-insight-node="(insight) => dispatch({ type: 'insight:add-node', insight })"
        @navigate-to-node="(id) => dispatch({ type: 'nav:navigate-to-node', nodeId: id })"
        @highlight-nodes="(ids) => dispatch({ type: 'insight:highlight-nodes', nodeIds: ids })"
        @clear-highlights="dispatch({ type: 'insight:clear-highlights' })"
      />

      <div class="shell__gap" />

      <!-- AI Agent Section -->
      <div class="shell__agent-section">
        <CanvasSidebarSidebarHeader
          icon="i-lucide-bot"
          label="AI Agent"
          :collapsed="!showAgentPanel"
          accent-color="#F472B6"
          @toggle="showAgentPanel = !showAgentPanel"
        />
        <div v-if="showAgentPanel" class="shell__agent-container">
          <!-- Agent panel placeholder — component doesn't exist yet -->
          <div class="shell__agent-placeholder">
            <span class="i-lucide-bot text-xl" style="color: var(--nc-ink-faint); opacity: 0.5" />
            <p style="color: var(--nc-ink-faint); font-size: 11px">Agent coming soon</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <CanvasSidebarFooter />

    <!-- Width resize handle (right edge) -->
    <div class="shell__resize-handle" @mousedown="startWidthResize" />
  </aside>
</template>

<style scoped>
.shell {
  height: 100%;
  min-height: 100vh;
  background: var(--nc-bg);
  border-right: 1px solid var(--nc-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  box-shadow: inset -1px 0 0 var(--nc-border);
}

.shell__scroll {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
}

.shell__scroll::-webkit-scrollbar {
  width: 4px;
}

.shell__scroll::-webkit-scrollbar-track {
  background: transparent;
}

.shell__scroll::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 4px;
}

/* Section gaps replace old 1px border dividers */
.shell__gap {
  height: 8px;
  background: var(--nc-surface);
  border-top: 1px solid var(--nc-border);
  border-bottom: 1px solid var(--nc-border);
}

/* Agent section */
.shell__agent-container {
  max-height: 450px;
  overflow: hidden;
}

.shell__agent-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 14px;
}

/* Width resize handle — right edge */
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
</style>
