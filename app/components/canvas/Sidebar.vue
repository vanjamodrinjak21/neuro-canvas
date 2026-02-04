<script setup lang="ts">
import type { Node } from '~/types'
import type { AISuggestion, RichNodeSuggestion } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { getRelationshipLabel, getCategoryIcon } from '~/utils/ai-prompts'

// Node category definitions
const nodeCategories = [
  { id: 'main-fact', label: 'Main Fact', icon: 'i-lucide-star', color: '#00D2BE' },
  { id: 'description', label: 'Description', icon: 'i-lucide-file-text', color: '#60A5FA' },
  { id: 'evidence', label: 'Evidence', icon: 'i-lucide-check-circle', color: '#4ADE80' },
  { id: 'question', label: 'Question', icon: 'i-lucide-help-circle', color: '#FACC15' },
  { id: 'idea', label: 'Idea', icon: 'i-lucide-lightbulb', color: '#FB923C' },
  { id: 'reference', label: 'Reference', icon: 'i-lucide-link', color: '#A78BFA' },
]

const props = defineProps<{
  selectedNode: Node | null
  isAILoading?: boolean
  aiSuggestions?: AISuggestion[]
  richSuggestions?: RichNodeSuggestion[]
  isCollapsed?: boolean
}>()

const emit = defineEmits<{
  'smart-expand': []
  'deep-expand': []
  'add-suggestion': [suggestion: AISuggestion]
  'add-rich-suggestion': [suggestion: RichNodeSuggestion]
  'add-node': []
  'add-categorized-node': [category: { id: string; label: string; color: string }]
  'duplicate': []
  'delete-node': []
  'navigate-to-node': [nodeId: string]
  'toggle-sidebar': []
  'drag-start-category': [category: { id: string; label: string; color: string }]
  'drag-start-node': [nodeId: string]
  'add-insight-node': [insight: unknown]
  'highlight-nodes': [nodeIds: string[]]
  'clear-highlights': []
  'generate-map': []
  'generate-description': []
}>()

const mapStore = useMapStore()

// Section collapse state
const sectionsCollapsed = reactive({
  explorer: false,
  properties: false,
  ai: false
})

// Node Explorer state
const explorerHeight = ref(200)
const isResizingExplorer = ref(false)
const explorerSearchQuery = ref('')
const explorerFilterCategory = ref<string | null>(null)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)

// Filtered nodes for explorer
const filteredNodes = computed(() => {
  let nodes = Array.from(mapStore.nodes.values())

  // Filter by category if set
  if (explorerFilterCategory.value) {
    nodes = nodes.filter(node =>
      node.metadata?.category === explorerFilterCategory.value
    )
  }

  // Filter by search query
  if (explorerSearchQuery.value) {
    const query = explorerSearchQuery.value.toLowerCase()
    nodes = nodes.filter(node =>
      node.content.toLowerCase().includes(query)
    )
  }

  return nodes
})

// Group nodes by category for display
const groupedNodes = computed(() => {
  const groups: Record<string, Node[]> = {}

  for (const node of filteredNodes.value) {
    const category = (node.metadata?.category as string) || 'uncategorized'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(node)
  }

  return groups
})

// Node explorer resize handlers
function startExplorerResize(event: MouseEvent) {
  isResizingExplorer.value = true
  resizeStartY.value = event.clientY
  resizeStartHeight.value = explorerHeight.value
  document.addEventListener('mousemove', handleExplorerResize)
  document.addEventListener('mouseup', stopExplorerResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function handleExplorerResize(event: MouseEvent) {
  if (!isResizingExplorer.value) return
  const delta = event.clientY - resizeStartY.value
  const newHeight = Math.max(100, Math.min(400, resizeStartHeight.value + delta))
  explorerHeight.value = newHeight
}

function stopExplorerResize() {
  isResizingExplorer.value = false
  document.removeEventListener('mousemove', handleExplorerResize)
  document.removeEventListener('mouseup', stopExplorerResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function selectNode(nodeId: string) {
  mapStore.select([nodeId])
  emit('navigate-to-node', nodeId)
}

function getCategoryInfo(categoryId: string) {
  return nodeCategories.find(c => c.id === categoryId) || {
    id: 'uncategorized',
    label: 'Uncategorized',
    icon: 'i-lucide-circle',
    color: '#555558'
  }
}

function createCategorizedNode(category: typeof nodeCategories[0]) {
  emit('add-categorized-node', category)
}

// Drag and drop handlers
function handleCategoryDragStart(event: DragEvent, category: typeof nodeCategories[0]) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'category',
    category
  }))
  event.dataTransfer.effectAllowed = 'copy'
  emit('drag-start-category', category)
}

function handleNodeDragStart(event: DragEvent, nodeId: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'node',
    nodeId
  }))
  event.dataTransfer.effectAllowed = 'move'
  emit('drag-start-node', nodeId)
}

// Local state for editing
const localContent = ref('')
const localNotes = ref('')
const localBorderColor = ref('#2A2A30')
const localCategory = ref<string | null>(null)

// Node colors for properties section
const nodeColors = [
  '#00D2BE', // Teal
  '#A78BFA', // Purple
  '#F472B6', // Pink
  '#60A5FA', // Blue
  '#4ADE80', // Green
  '#FB923C', // Orange
  '#FACC15'  // Yellow
]

// Watch for node changes and update local state
watch(() => props.selectedNode, (newNode) => {
  if (newNode) {
    localContent.value = newNode.content
    localNotes.value = (newNode.metadata?.notes as string) || ''
    localBorderColor.value = newNode.style.borderColor
    localCategory.value = (newNode.metadata?.category as string) || null
  }
}, { immediate: true })

// Update handlers
function updateContent() {
  if (props.selectedNode && localContent.value !== props.selectedNode.content) {
    mapStore.updateNode(props.selectedNode.id, { content: localContent.value })
  }
}

function updateNotes() {
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      metadata: { ...props.selectedNode.metadata, notes: localNotes.value }
    })
  }
}

function updateBorderColor(color: string) {
  localBorderColor.value = color
  if (props.selectedNode) {
    mapStore.updateNode(props.selectedNode.id, {
      style: { ...props.selectedNode.style, borderColor: color }
    })
  }
}

function updateCategory(categoryId: string) {
  localCategory.value = categoryId
  if (props.selectedNode) {
    const category = getCategoryInfo(categoryId)
    mapStore.updateNode(props.selectedNode.id, {
      metadata: { ...props.selectedNode.metadata, category: categoryId },
      style: { ...props.selectedNode.style, borderColor: category.color }
    })
  }
}

function toggleSection(section: keyof typeof sectionsCollapsed) {
  sectionsCollapsed[section] = !sectionsCollapsed[section]
}

function handleDeleteNode() {
  if (props.selectedNode) {
    mapStore.deleteNode(props.selectedNode.id)
  }
}

// Category colors for rich suggestions
const categoryColorMap: Record<string, string> = {
  concept: '#60A5FA',
  fact: '#4ADE80',
  question: '#FACC15',
  example: '#FB923C',
  definition: '#A78BFA',
  process: '#F472B6'
}

function getCategoryColor(category: string): string {
  return categoryColorMap[category] || '#00D2BE'
}

function getRelationshipBgColor(relationship: string): string {
  const colors: Record<string, string> = {
    'is-a': 'rgba(96, 165, 250, 0.2)',
    'has-a': 'rgba(167, 139, 250, 0.2)',
    'related-to': 'rgba(136, 136, 144, 0.2)',
    'causes': 'rgba(244, 114, 182, 0.2)',
    'enables': 'rgba(74, 222, 128, 0.2)',
    'opposes': 'rgba(239, 68, 68, 0.2)',
    'example-of': 'rgba(251, 146, 60, 0.2)',
    'part-of': 'rgba(0, 210, 190, 0.2)',
    'leads-to': 'rgba(250, 204, 21, 0.2)'
  }
  return colors[relationship] || 'rgba(136, 136, 144, 0.2)'
}
</script>

<template>
  <aside class="nc-sidebar">
    <!-- ═══════════════ NODE EXPLORER SECTION ═══════════════ -->
    <div class="nc-sidebar-section nc-explorer-section">
      <button
        class="nc-sidebar-header"
        @click="toggleSection('explorer')"
      >
        <span class="flex items-center gap-2">
          <span class="i-lucide-layers text-sm" />
          <span>Node Explorer</span>
          <span class="nc-node-count">{{ mapStore.nodes.size }}</span>
        </span>
        <span
          :class="['i-lucide-chevron-down text-sm transition-transform', sectionsCollapsed.explorer && '-rotate-90']"
        />
      </button>

      <div
        :class="['nc-explorer-content', sectionsCollapsed.explorer && 'collapsed']"
        :style="{ maxHeight: sectionsCollapsed.explorer ? '0' : `${explorerHeight}px` }"
      >
        <!-- Search input -->
        <div class="px-3 pb-2">
          <div class="nc-explorer-search">
            <span class="i-lucide-search text-sm text-[#555558]" />
            <input
              v-model="explorerSearchQuery"
              type="text"
              placeholder="Search nodes..."
              class="nc-explorer-search-input"
            >
            <button
              v-if="explorerSearchQuery"
              class="nc-explorer-clear-btn"
              @click="explorerSearchQuery = ''"
            >
              <span class="i-lucide-x text-xs" />
            </button>
          </div>
        </div>

        <!-- Category quick-add buttons (draggable) -->
        <div class="nc-category-buttons">
          <button
            v-for="cat in nodeCategories"
            :key="cat.id"
            class="nc-category-add-btn"
            :title="`Drag to canvas or click to add ${cat.label}`"
            draggable="true"
            @click="createCategorizedNode(cat)"
            @dragstart="handleCategoryDragStart($event, cat)"
          >
            <span :class="cat.icon" :style="{ color: cat.color }" />
          </button>
        </div>

        <!-- Node list grouped by category -->
        <div class="nc-explorer-list">
          <template v-for="(nodes, categoryId) in groupedNodes" :key="categoryId">
            <div class="nc-explorer-group">
              <div class="nc-explorer-group-header">
                <span
                  :class="getCategoryInfo(categoryId as string).icon"
                  :style="{ color: getCategoryInfo(categoryId as string).color }"
                />
                <span>{{ getCategoryInfo(categoryId as string).label }}</span>
                <span class="nc-explorer-group-count">{{ nodes.length }}</span>
              </div>
              <button
                v-for="node in nodes"
                :key="node.id"
                :class="['nc-explorer-item', selectedNode?.id === node.id && 'active']"
                draggable="true"
                @click="selectNode(node.id)"
                @dragstart="handleNodeDragStart($event, node.id)"
              >
                <span
                  class="nc-explorer-item-dot"
                  :style="{ backgroundColor: node.style.borderColor || '#2A2A30' }"
                />
                <span class="nc-explorer-item-label">{{ node.content || 'Untitled' }}</span>
              </button>
            </div>
          </template>

          <!-- Empty state -->
          <div v-if="filteredNodes.length === 0" class="nc-explorer-empty">
            <span class="i-lucide-inbox text-2xl mb-2" />
            <p v-if="explorerSearchQuery">No nodes match "{{ explorerSearchQuery }}"</p>
            <p v-else>No nodes yet. Add one above!</p>
          </div>
        </div>
      </div>

      <!-- Resize handle -->
      <div
        v-if="!sectionsCollapsed.explorer"
        class="nc-explorer-resize-handle"
        @mousedown="startExplorerResize"
      >
        <div class="nc-explorer-resize-line" />
      </div>
    </div>

    <!-- ═══════════════ PROPERTIES SECTION ═══════════════ -->
    <div class="nc-sidebar-section">
      <button
        class="nc-sidebar-header"
        @click="toggleSection('properties')"
      >
        <span class="flex items-center gap-2">
          <span class="i-lucide-sliders-horizontal text-sm" />
          <span>Properties</span>
        </span>
        <span
          :class="['i-lucide-chevron-down text-sm transition-transform', sectionsCollapsed.properties && '-rotate-90']"
        />
      </button>

      <div
        :class="['nc-sidebar-content', sectionsCollapsed.properties && 'collapsed']"
      >
        <template v-if="selectedNode">
          <!-- Category selector -->
          <div class="nc-category-selector">
            <label class="nc-field-label">Category</label>
            <div class="nc-category-options">
              <button
                v-for="cat in nodeCategories"
                :key="cat.id"
                :class="['nc-category-option', localCategory === cat.id && 'active']"
                :style="localCategory === cat.id ? { borderColor: cat.color, background: `${cat.color}15` } : {}"
                @click="updateCategory(cat.id)"
              >
                <span :class="cat.icon" :style="{ color: cat.color }" />
                <span>{{ cat.label }}</span>
              </button>
            </div>
          </div>

          <!-- Color dots -->
          <div class="nc-field-group">
            <label class="nc-field-label">Color</label>
            <div class="flex gap-2">
              <button
                v-for="color in nodeColors"
                :key="color"
                class="nc-color-dot"
                :class="localBorderColor === color && 'active'"
                :style="{ backgroundColor: color }"
                @click="updateBorderColor(color)"
              />
            </div>
          </div>

          <!-- Label input -->
          <div class="nc-field-group">
            <label class="nc-field-label">Label</label>
            <input
              v-model="localContent"
              type="text"
              class="nc-sidebar-input"
              placeholder="Label..."
              @blur="updateContent"
              @keydown.enter="updateContent"
            >
          </div>

          <!-- Notes textarea -->
          <div class="nc-field-group">
            <label class="nc-field-label">Notes</label>
            <textarea
              v-model="localNotes"
              placeholder="Notes..."
              class="nc-sidebar-input nc-sidebar-textarea"
              rows="3"
              @blur="updateNotes"
            />
          </div>

          <!-- Delete button -->
          <button
            class="nc-sidebar-delete-btn"
            @click="handleDeleteNode"
          >
            <span class="i-lucide-trash-2 text-sm" />
            <span>Delete Node</span>
          </button>
        </template>

        <template v-else>
          <p class="nc-empty-text">
            Select a node to edit its properties
          </p>
        </template>
      </div>
    </div>

    <!-- ═══════════════ AI SUGGESTIONS SECTION ═══════════════ -->
    <div class="nc-sidebar-section">
      <button
        class="nc-sidebar-header"
        @click="toggleSection('ai')"
      >
        <span class="flex items-center gap-2">
          <span class="i-lucide-sparkles text-sm" />
          <span>AI Suggestions</span>
        </span>
        <span
          :class="['i-lucide-chevron-down text-sm transition-transform', sectionsCollapsed.ai && '-rotate-90']"
        />
      </button>

      <div
        :class="['nc-sidebar-content', sectionsCollapsed.ai && 'collapsed']"
      >
        <!-- Loading state -->
        <template v-if="isAILoading">
          <div class="space-y-2">
            <NcSkeleton class="h-20 rounded-lg" />
            <NcSkeleton class="h-20 rounded-lg" />
            <NcSkeleton class="h-20 rounded-lg" />
          </div>
        </template>

        <!-- Rich suggestions list (enhanced) -->
        <template v-else-if="richSuggestions && richSuggestions.length > 0">
          <div class="space-y-3">
            <button
              v-for="(suggestion, index) in richSuggestions"
              :key="`rich-${index}`"
              class="nc-rich-suggestion-item"
              @click="emit('add-rich-suggestion', suggestion)"
            >
              <!-- Title row with category icon and relationship badge -->
              <div class="nc-rich-suggestion-header">
                <span :class="[getCategoryIcon(suggestion.category), 'text-sm']" :style="{ color: getCategoryColor(suggestion.category) }" />
                <span class="nc-rich-suggestion-title">{{ suggestion.title }}</span>
                <span v-if="suggestion.relationshipToParent" class="nc-relationship-badge" :style="{ backgroundColor: getRelationshipBgColor(suggestion.relationshipToParent) }">
                  {{ getRelationshipLabel(suggestion.relationshipToParent) }}
                </span>
              </div>

              <!-- Description summary -->
              <p v-if="suggestion.description?.summary" class="nc-rich-suggestion-summary">
                {{ suggestion.description.summary }}
              </p>

              <!-- Keywords -->
              <div v-if="suggestion.description?.keywords?.length" class="nc-rich-suggestion-keywords">
                <span
                  v-for="keyword in suggestion.description.keywords.slice(0, 4)"
                  :key="keyword"
                  class="nc-keyword-tag"
                >
                  {{ keyword }}
                </span>
              </div>

              <!-- Add button indicator -->
              <span class="nc-rich-suggestion-add">
                <span class="i-lucide-plus text-sm" />
              </span>
            </button>
          </div>

          <div class="nc-suggestion-actions">
            <button
              class="nc-sidebar-action-btn"
              :disabled="!selectedNode"
              @click="emit('smart-expand')"
            >
              <span class="i-lucide-refresh-cw text-sm" />
              <span>Generate more</span>
            </button>
            <button
              class="nc-sidebar-action-btn nc-deep-expand-btn"
              :disabled="!selectedNode"
              @click="emit('deep-expand')"
              title="Generate multi-level expansion"
            >
              <span class="i-lucide-git-branch text-sm" />
              <span>Deep expand</span>
            </button>
          </div>
        </template>

        <!-- Legacy suggestions list (fallback) -->
        <template v-else-if="aiSuggestions && aiSuggestions.length > 0">
          <div class="space-y-2">
            <button
              v-for="suggestion in aiSuggestions"
              :key="suggestion.id"
              class="nc-ai-suggestion-item"
              @click="emit('add-suggestion', suggestion)"
            >
              <span class="flex-1 text-left text-sm truncate">{{ suggestion.content }}</span>
              <span class="i-lucide-plus text-sm text-[#00D2BE]" />
            </button>
          </div>

          <button
            class="nc-sidebar-action-btn mt-3"
            :disabled="!selectedNode"
            @click="emit('smart-expand')"
          >
            <span class="i-lucide-refresh-cw text-sm" />
            <span>Generate more</span>
          </button>
        </template>

        <!-- Empty state -->
        <template v-else>
          <div class="text-center py-4">
            <p class="nc-empty-text mb-3">
              {{ selectedNode ? 'No suggestions yet' : 'Select a node first' }}
            </p>
            <div v-if="selectedNode" class="space-y-2">
              <button
                class="nc-sidebar-action-btn"
                @click="emit('smart-expand')"
              >
                <span class="i-lucide-sparkles text-sm" />
                <span>Generate ideas</span>
              </button>
              <button
                class="nc-sidebar-action-btn nc-deep-expand-btn"
                @click="emit('deep-expand')"
              >
                <span class="i-lucide-git-branch text-sm" />
                <span>Deep expand</span>
              </button>
            </div>
            <button
              v-if="!selectedNode"
              class="nc-sidebar-action-btn mt-2"
              @click="emit('generate-map')"
            >
              <span class="i-lucide-map text-sm" />
              <span>Generate map from topic</span>
            </button>
          </div>
        </template>

        <!-- Node description section (when node selected) -->
        <div v-if="selectedNode" class="nc-description-section">
          <div class="nc-section-divider" />
          <div class="nc-field-label">AI Description</div>
          <template v-if="selectedNode.metadata?.description">
            <p class="nc-node-description">
              {{ (selectedNode.metadata.description as { summary: string }).summary }}
            </p>
            <div v-if="(selectedNode.metadata.description as { keywords?: string[] }).keywords?.length" class="nc-rich-suggestion-keywords mt-2">
              <span
                v-for="keyword in (selectedNode.metadata.description as { keywords?: string[] }).keywords?.slice(0, 5)"
                :key="keyword"
                class="nc-keyword-tag"
              >
                {{ keyword }}
              </span>
            </div>
          </template>
          <template v-else>
            <p class="nc-empty-text text-xs mb-2">No description generated</p>
            <button
              class="nc-sidebar-action-btn nc-small-btn"
              @click="emit('generate-description')"
            >
              <span class="i-lucide-wand-2 text-xs" />
              <span>Generate description</span>
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══════════════ INSIGHTS SECTION ═══════════════ -->
    <CanvasInsightPanel
      @add-insight-node="(insight) => emit('add-insight-node', insight)"
      @navigate-to-node="(nodeId) => emit('navigate-to-node', nodeId)"
      @highlight-nodes="(nodeIds) => emit('highlight-nodes', nodeIds)"
      @clear-highlights="emit('clear-highlights')"
    />

    <!-- ═══════════════ SPACER ═══════════════ -->
    <div class="flex-1" />

    <!-- ═══════════════ BOTTOM TOGGLE BAR ═══════════════ -->
    <div class="nc-sidebar-footer">
      <button
        class="nc-sidebar-toggle-btn"
        @click="emit('toggle-sidebar')"
      >
        <span class="i-lucide-panel-left-close text-base" />
        <span>Hide Sidebar</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nc-sidebar {
  width: 260px;
  min-width: 260px;
  height: 100%;
  min-height: 100vh;
  background: #0D0D10;
  border-right: 1px solid #1A1A1E;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nc-sidebar-section {
  border-bottom: 1px solid #1A1A1E;
}

.nc-sidebar-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 600;
  color: #666670;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.nc-sidebar-header:hover {
  color: #FAFAFA;
}

.nc-sidebar-content {
  padding: 0 16px 16px;
  overflow: hidden;
  max-height: 500px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.nc-sidebar-content.collapsed {
  max-height: 0;
  padding-bottom: 0;
  opacity: 0;
}

.nc-field-group {
  margin-bottom: 12px;
}

.nc-field-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #555558;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.nc-empty-text {
  color: #444448;
  font-size: 12px;
}

.nc-color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.nc-color-dot:hover {
  transform: scale(1.15);
}

.nc-color-dot.active {
  border-color: #FAFAFA;
}

.nc-sidebar-input {
  width: 100%;
  background: #141418;
  border: 1px solid #1A1A1E;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  color: #FAFAFA;
  transition: border-color 0.15s ease;
}

.nc-sidebar-input::placeholder {
  color: #444448;
}

.nc-sidebar-input:focus {
  outline: none;
  border-color: #00D2BE;
}

.nc-sidebar-textarea {
  resize: none;
  min-height: 60px;
}

.nc-sidebar-delete-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  margin-top: 8px;
  background: transparent;
  border: 1px solid #3A1A1A;
  border-radius: 6px;
  color: #EF4444;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-sidebar-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #EF4444;
}

.nc-ai-suggestion-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #141418;
  border: 1px dashed #2A2A30;
  border-radius: 6px;
  color: #FAFAFA;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nc-ai-suggestion-item:hover {
  background: rgba(0, 210, 190, 0.05);
  border-color: #00D2BE;
  border-style: solid;
}

.nc-sidebar-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid #2A2A30;
  border-radius: 6px;
  color: #666670;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-sidebar-action-btn:hover:not(:disabled) {
  border-color: #00D2BE;
  color: #00D2BE;
}

.nc-sidebar-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ═══════════════ CATEGORY STYLES ═══════════════ */
.nc-category-selector {
  margin-bottom: 12px;
}

.nc-category-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nc-category-option {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #2A2A30;
  border-radius: 4px;
  color: #888890;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-category-option:hover {
  background: #1A1A1E;
  color: #FAFAFA;
}

.nc-category-option.active {
  color: #FAFAFA;
}

.nc-category-buttons {
  display: flex;
  gap: 4px;
  padding: 0 12px 8px;
  border-bottom: 1px solid #1A1A1E;
  margin-bottom: 8px;
}

.nc-category-add-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #141418;
  border: 1px solid #1A1A1E;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-category-add-btn:hover {
  background: #1A1A1E;
  border-color: #2A2A30;
  transform: scale(1.05);
}

/* ═══════════════ NODE EXPLORER STYLES ═══════════════ */
.nc-explorer-section {
  position: relative;
}

.nc-node-count {
  background: #1A1A1E;
  color: #666670;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.nc-explorer-content {
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
}

.nc-explorer-content.collapsed {
  max-height: 0 !important;
}

.nc-explorer-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #141418;
  border: 1px solid #1A1A1E;
  border-radius: 6px;
  padding: 6px 10px;
  transition: border-color 0.15s ease;
}

.nc-explorer-search:focus-within {
  border-color: #00D2BE;
}

.nc-explorer-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #FAFAFA;
  font-size: 11px;
}

.nc-explorer-search-input::placeholder {
  color: #444448;
}

.nc-explorer-clear-btn {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #444448;
  transition: all 0.15s ease;
}

.nc-explorer-clear-btn:hover {
  color: #FAFAFA;
  background: #2A2A30;
}

.nc-explorer-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.nc-explorer-group {
  margin-bottom: 8px;
}

.nc-explorer-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #555558;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.nc-explorer-group-count {
  margin-left: auto;
  background: #1A1A1E;
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 9px;
}

.nc-explorer-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-left: 12px;
  width: calc(100% - 12px);
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.nc-explorer-item:hover {
  background: #1A1A1E;
}

.nc-explorer-item.active {
  background: rgba(0, 210, 190, 0.1);
}

.nc-explorer-item.active .nc-explorer-item-label {
  color: #00D2BE;
}

.nc-explorer-item-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nc-explorer-item-label {
  flex: 1;
  font-size: 11px;
  color: #AAAAAE;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-explorer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  color: #444448;
  font-size: 11px;
  text-align: center;
}

.nc-explorer-resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 8px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.nc-explorer-resize-handle:hover .nc-explorer-resize-line,
.nc-explorer-resize-handle:active .nc-explorer-resize-line {
  background: #00D2BE;
}

.nc-explorer-resize-line {
  width: 40px;
  height: 3px;
  background: #2A2A30;
  border-radius: 2px;
  transition: background 0.15s ease;
}

/* ═══════════════ BOTTOM FOOTER ═══════════════ */
.nc-sidebar-footer {
  padding: 12px;
  border-top: 1px solid #1A1A1E;
}

.nc-sidebar-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: 1px solid #1A1A1E;
  border-radius: 6px;
  color: #555558;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-sidebar-toggle-btn:hover {
  color: #FAFAFA;
  background: #141418;
  border-color: #2A2A30;
}

/* ═══════════════ DRAGGABLE STYLES ═══════════════ */
.nc-category-add-btn[draggable="true"],
.nc-explorer-item[draggable="true"] {
  cursor: grab;
}

.nc-category-add-btn[draggable="true"]:active,
.nc-explorer-item[draggable="true"]:active {
  cursor: grabbing;
}

.nc-category-add-btn:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.nc-explorer-item:active {
  opacity: 0.8;
}

/* ═══════════════ RICH SUGGESTION STYLES ═══════════════ */
.nc-rich-suggestion-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  min-height: fit-content;
  background: #141418;
  border: 1px dashed #2A2A30;
  border-radius: 8px;
  color: #FAFAFA;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  text-align: left;
}

.nc-rich-suggestion-item:hover {
  background: rgba(0, 210, 190, 0.05);
  border-color: #00D2BE;
  border-style: solid;
}

.nc-rich-suggestion-header {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.nc-rich-suggestion-title {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: #FAFAFA;
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.nc-relationship-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #AAAAAE;
  white-space: nowrap;
  flex-shrink: 0;
}

.nc-rich-suggestion-summary {
  font-size: 11px;
  color: #888890;
  line-height: 1.5;
  margin: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.nc-rich-suggestion-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nc-keyword-tag {
  font-size: 9px;
  padding: 2px 6px;
  background: #1A1A1E;
  border-radius: 3px;
  color: #666670;
}

.nc-rich-suggestion-add {
  position: absolute;
  top: 10px;
  right: 10px;
  color: #00D2BE;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.nc-rich-suggestion-item:hover .nc-rich-suggestion-add {
  opacity: 1;
}

.nc-suggestion-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.nc-suggestion-actions .nc-sidebar-action-btn {
  flex: 1;
}

.nc-deep-expand-btn {
  border-color: #A78BFA !important;
  color: #A78BFA !important;
}

.nc-deep-expand-btn:hover:not(:disabled) {
  border-color: #A78BFA !important;
  background: rgba(167, 139, 250, 0.1) !important;
}

.nc-description-section {
  margin-top: 12px;
}

.nc-section-divider {
  height: 1px;
  background: #1A1A1E;
  margin-bottom: 12px;
}

.nc-node-description {
  font-size: 11px;
  color: #888890;
  line-height: 1.5;
  margin: 4px 0 0;
}

.nc-small-btn {
  padding: 6px 10px !important;
  font-size: 11px !important;
}

.nc-small-btn span {
  font-size: 11px !important;
}
</style>
