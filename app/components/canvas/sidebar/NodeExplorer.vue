<script setup lang="ts">
import type { Node } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { getCategoryInfo, nodeCategories, type NodeCategory } from '~/composables/useSidebarState'

/**
 * NodeExplorer — Search, filter, and grouped node list
 * Redesigned with filter pills, root node card, and section divider
 */
const props = defineProps<{
  selectedNode: Node | null
  explorerHeight: number
}>()

const emit = defineEmits<{
  navigateToNode: [nodeId: string]
  addCategorizedNode: [category: NodeCategory]
  dragStartCategory: [category: NodeCategory]
  dragStartNode: [nodeId: string]
  startResize: [event: MouseEvent]
}>()

const mapStore = useMapStore()

// Local search & filter
const searchQuery = ref('')
const filterCategory = ref<string | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

// Keyboard shortcut: / to focus search
onMounted(() => {
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault()
      searchInputRef.value?.focus()
    }
  }
  document.addEventListener('keydown', handleKeydown)
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
})

// Filtered nodes
const filteredNodes = computed(() => {
  let nodes = Array.from(mapStore.nodes.values())

  if (filterCategory.value) {
    nodes = nodes.filter(n => n.metadata?.category === filterCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    nodes = nodes.filter(n => n.content.toLowerCase().includes(q))
  }
  return nodes
})

const totalNodeCount = computed(() => mapStore.nodes.size)

// Find root node (node with most connections or first node)
const rootNode = computed(() => {
  const nodes = Array.from(mapStore.nodes.values())
  if (nodes.length === 0) return null
  // Find node with most edges or the first one
  let root = nodes[0]
  let maxEdges = 0
  for (const node of nodes) {
    const edgeCount = Array.from(mapStore.edges.values()).filter(
      e => e.source === node.id || e.target === node.id
    ).length
    if (edgeCount > maxEdges) {
      maxEdges = edgeCount
      root = node
    }
  }
  return root
})

const childNodes = computed(() => {
  if (!rootNode.value) return []
  return filteredNodes.value.filter(n => n.id !== rootNode.value!.id)
})

const rootChildCount = computed(() => {
  if (!rootNode.value) return 0
  return Array.from(mapStore.edges.values()).filter(
    e => e.source === rootNode.value!.id || e.target === rootNode.value!.id
  ).length
})

function selectNode(nodeId: string) {
  mapStore.select([nodeId])
  emit('navigateToNode', nodeId)
}

function getNodeChildCount(nodeId: string): number {
  return Array.from(mapStore.edges.values()).filter(
    e => e.source === nodeId || e.target === nodeId
  ).length
}

function toggleFilter(categoryId: string) {
  filterCategory.value = filterCategory.value === categoryId ? null : categoryId
}

// Filter chip categories (subset for display)
const filterChips = computed(() => [
  { id: 'main-fact', label: 'Main', color: '#00D2BE' },
  { id: 'description', label: 'Desc', color: '#60A5FA' },
  { id: 'evidence', label: 'Evidence', color: '#4ADE80' },
  { id: 'question', label: 'Question', color: '#FACC15' },
  { id: 'idea', label: 'Idea', color: '#FB923C' },
])
</script>

<template>
  <div class="explorer">
    <!-- Search -->
    <div class="explorer__search-wrap">
      <div :class="['explorer__search', searchQuery && 'explorer__search--active']">
        <span class="i-lucide-search explorer__search-icon" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Search nodes..."
          class="explorer__search-input"
        >
        <button
          v-if="searchQuery"
          class="explorer__search-clear"
          @click="searchQuery = ''"
        >
          <span class="i-lucide-x" />
        </button>
        <kbd v-else class="explorer__search-kbd">/</kbd>
      </div>
    </div>

    <!-- Filter pills -->
    <div class="explorer__filters">
      <button
        :class="['explorer__filter-pill', !filterCategory && 'explorer__filter-pill--active']"
        @click="filterCategory = null"
      >
        <span class="explorer__filter-label">All</span>
        <span class="explorer__filter-count">{{ totalNodeCount }}</span>
      </button>
      <button
        v-for="chip in filterChips"
        :key="chip.id"
        :class="['explorer__filter-pill', filterCategory === chip.id && 'explorer__filter-pill--active']"
        :style="filterCategory === chip.id ? {
          background: `${chip.color}1A`,
          borderColor: `${chip.color}40`,
        } : {}"
        @click="toggleFilter(chip.id)"
      >
        <span class="explorer__filter-dot" :style="{ background: chip.color }" />
        <span class="explorer__filter-label">{{ chip.label }}</span>
      </button>
    </div>

    <!-- Section divider -->
    <div class="explorer__section-divider">
      <span class="explorer__section-label">NODES</span>
      <span class="explorer__section-line" />
      <span class="explorer__section-count">{{ totalNodeCount }}</span>
    </div>

    <!-- Root node card -->
    <div v-if="rootNode && !searchQuery && !filterCategory" class="explorer__root-card" @click="selectNode(rootNode.id)">
      <div class="explorer__root-avatar" :style="{ background: `${rootNode.style?.borderColor || '#00D2BE'}1F` }">
        <span :style="{ color: rootNode.style?.borderColor || '#00D2BE' }">{{ rootNode.content.charAt(0).toUpperCase() }}</span>
      </div>
      <div class="explorer__root-info">
        <span class="explorer__root-name">{{ rootNode.content }}</span>
        <span class="explorer__root-meta">Root · {{ rootChildCount }} children</span>
      </div>
      <span class="i-lucide-chevron-down explorer__root-chevron" />
    </div>

    <!-- Node list -->
    <div class="explorer__list">
      <CanvasSidebarNodeExplorerItem
        v-for="node in (searchQuery || filterCategory ? filteredNodes : childNodes)"
        :key="node.id"
        :node="node"
        :is-active="selectedNode?.id === node.id"
        :child-count="getNodeChildCount(node.id)"
        @select="selectNode"
        @drag-start="(ev, id) => emit('dragStartNode', id)"
      />

      <!-- Empty state -->
      <div v-if="filteredNodes.length === 0" class="explorer__empty">
        <span class="i-lucide-inbox explorer__empty-icon" />
        <p v-if="searchQuery" class="explorer__empty-text">
          No nodes match "{{ searchQuery }}"
        </p>
        <p v-else class="explorer__empty-text">
          No nodes yet — click Expand to start
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Search */
.explorer__search-wrap {
  padding: 12px 14px 0;
  flex-shrink: 0;
}

.explorer__search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #111113;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  padding: 8px 12px;
  transition: all 0.2s ease;
}

.explorer__search:focus-within,
.explorer__search--active {
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}

.explorer__search-icon {
  font-size: 14px;
  color: #3F3F46;
  flex-shrink: 0;
}

.explorer__search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--nc-ink);
  font-size: 12px;
  font-family: 'Inter', system-ui, sans-serif;
}

.explorer__search-input::placeholder {
  color: #3F3F46;
}

.explorer__search-clear {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--nc-ink-faint);
  font-size: 11px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.explorer__search-clear:hover {
  color: var(--nc-ink);
  background: var(--nc-surface-3);
}

.explorer__search-kbd {
  padding: 2px 6px;
  background: #18181B;
  border: 1px solid #27272A;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #3F3F46;
  line-height: 1;
}

/* Filter pills */
.explorer__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 10px 14px;
  flex-shrink: 0;
}

.explorer__filter-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #27272A;
  border-radius: 100px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.explorer__filter-pill:hover {
  border-color: #3F3F46;
}

.explorer__filter-pill--active {
  background: rgba(0, 210, 190, 0.12);
  border-color: rgba(0, 210, 190, 0.25);
}

.explorer__filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.explorer__filter-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: #71717A;
}

.explorer__filter-pill--active .explorer__filter-label {
  color: #00D2BE;
  font-weight: 600;
}

.explorer__filter-count {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  color: rgba(0, 210, 190, 0.5);
}

/* Section divider */
.explorer__section-divider {
  display: flex;
  align-items: center;
  padding: 12px 16px 4px;
  gap: 8px;
  flex-shrink: 0;
}

.explorer__section-label {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  color: #27272A;
  letter-spacing: 0.08em;
}

.explorer__section-line {
  flex: 1;
  height: 1px;
  background: #18181B;
}

.explorer__section-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #27272A;
}

/* Root node card */
.explorer__root-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin: 0 10px;
  background: rgba(0, 210, 190, 0.05);
  border-radius: 8px;
  border-left: 2px solid #00D2BE;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.explorer__root-card:hover {
  background: rgba(0, 210, 190, 0.08);
}

.explorer__root-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  flex-shrink: 0;
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
}

.explorer__root-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.explorer__root-name {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #FAFAFA;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.explorer__root-meta {
  font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px;
  color: #52525B;
}

.explorer__root-chevron {
  font-size: 14px;
  color: #52525B;
  flex-shrink: 0;
}

/* Node list */
.explorer__list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
  content-visibility: auto;
}

.explorer__list::-webkit-scrollbar {
  width: 4px;
}

.explorer__list::-webkit-scrollbar-track {
  background: transparent;
}

.explorer__list::-webkit-scrollbar-thumb {
  background: var(--nc-surface-3);
  border-radius: 4px;
}

/* Empty */
.explorer__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 16px;
  text-align: center;
}

.explorer__empty-icon {
  font-size: 28px;
  color: var(--nc-ink-faint);
  margin-bottom: 8px;
  opacity: 0.5;
}

.explorer__empty-text {
  color: var(--nc-ink-faint);
  font-size: 11px;
  line-height: 1.5;
}

/* Light theme */
:root.light .explorer__search {
  background: #F4F4F5;
  border-color: #E4E4E7;
}

:root.light .explorer__search-icon {
  color: #A1A1AA;
}

:root.light .explorer__search-input::placeholder {
  color: #A1A1AA;
}

:root.light .explorer__search-kbd {
  background: #E4E4E7;
  border-color: #D4D4D8;
  color: #A1A1AA;
}

:root.light .explorer__filter-pill {
  border-color: #E4E4E7;
}

:root.light .explorer__filter-label {
  color: #71717A;
}

:root.light .explorer__section-label,
:root.light .explorer__section-count {
  color: #A1A1AA;
}

:root.light .explorer__section-line {
  background: #E4E4E7;
}

:root.light .explorer__root-card {
  background: rgba(0, 210, 190, 0.06);
}

:root.light .explorer__root-name {
  color: #18181B;
}

:root.light .explorer__root-meta {
  color: #A1A1AA;
}
</style>
