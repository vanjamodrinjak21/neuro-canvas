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
      e => e.sourceId === node.id || e.targetId === node.id
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
    e => e.sourceId === rootNode.value!.id || e.targetId === rootNode.value!.id
  ).length
})

function selectNode(nodeId: string) {
  mapStore.select([nodeId])
  emit('navigateToNode', nodeId)
}

function getNodeChildCount(nodeId: string): number {
  return Array.from(mapStore.edges.values()).filter(
    e => e.sourceId === nodeId || e.targetId === nodeId
  ).length
}

function toggleFilter(categoryId: string) {
  filterCategory.value = filterCategory.value === categoryId ? null : categoryId
}

// Filter chip categories (subset for display) — colors live in scoped CSS
// as per-category modifier classes bound to the --nc-* node tokens
const filterChips = computed(() => [
  { id: 'main-fact', label: 'Main' },
  { id: 'description', label: 'Desc' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'question', label: 'Question' },
  { id: 'idea', label: 'Idea' },
])

// Root avatar follows the user-chosen node color (data) via v-bind
const rootAvatarColor = computed(() => rootNode.value?.style?.borderColor || 'var(--nc-accent)')
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
          :placeholder="$t('canvas.search_nodes_placeholder')"
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
        <span class="explorer__filter-label">{{ $t('templates.filter.all') }}</span>
        <span class="explorer__filter-count">{{ totalNodeCount }}</span>
      </button>
      <button
        v-for="chip in filterChips"
        :key="chip.id"
        :class="[
          'explorer__filter-pill',
          `explorer__filter-pill--${chip.id}`,
          filterCategory === chip.id && 'explorer__filter-pill--active',
        ]"
        @click="toggleFilter(chip.id)"
      >
        <span class="explorer__filter-dot" />
        <span class="explorer__filter-label">{{ chip.label }}</span>
      </button>
    </div>

    <!-- Section divider -->
    <div class="explorer__section-divider">
      <span class="explorer__section-label">{{ $t('canvas.markdown_editor.nodes_label') }}</span>
      <span class="explorer__section-line" />
      <span class="explorer__section-count">{{ totalNodeCount }}</span>
    </div>

    <!-- Root node card -->
    <div v-if="rootNode && !searchQuery && !filterCategory" class="explorer__root-card" @click="selectNode(rootNode.id)">
      <div class="explorer__root-avatar">
        <span class="explorer__root-letter">{{ rootNode.content.charAt(0).toUpperCase() }}</span>
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

/* Input grammar (REDESIGN.md §5): chip-bg fill, hairline, accent focus
   border only — no ring/glow */
.explorer__search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 8px 12px;
  transition: border-color 200ms var(--nc-ease);
}

.explorer__search:focus-within,
.explorer__search--active {
  border-color: var(--nc-accent);
}

.explorer__search-icon {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-dim);
  flex-shrink: 0;
}

.explorer__search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--nc-ink);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-family: var(--nc-font-body);
}

.explorer__search-input::placeholder {
  color: var(--nc-text-dim);
}

.explorer__search-clear {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--nc-ink-faint);
  font-size: calc(11px * var(--nc-text-scale, 1));
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 150ms var(--nc-ease), background 150ms var(--nc-ease);
}

.explorer__search-clear:hover {
  color: var(--nc-ink);
  background: var(--nc-surface-3);
}

/* kbd hint — mono micro chip */
.explorer__search-kbd {
  padding: 2px 6px;
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  border-radius: 0.35rem;
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  line-height: 1;
}

/* Filter pills — per-category colors from the --nc-* node tokens */
.explorer__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 10px 14px;
  flex-shrink: 0;
}

.explorer__filter-pill {
  --chip-color: var(--nc-accent);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--nc-border);
  border-radius: 2rem;
  background: transparent;
  cursor: pointer;
  transition: background 150ms var(--nc-ease), border-color 150ms var(--nc-ease);
}

.explorer__filter-pill--main-fact { --chip-color: var(--nc-accent); }
.explorer__filter-pill--description { --chip-color: var(--nc-node-blue); }
.explorer__filter-pill--evidence { --chip-color: var(--nc-node-green); }
.explorer__filter-pill--question { --chip-color: var(--nc-node-yellow); }
.explorer__filter-pill--idea { --chip-color: var(--nc-node-orange); }

@media (hover: hover) and (pointer: fine) {
  .explorer__filter-pill:hover {
    border-color: var(--nc-border-active);
  }
}

.explorer__filter-pill--active {
  background: color-mix(in srgb, var(--chip-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--chip-color) 25%, transparent);
}

.explorer__filter-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chip-color);
  flex-shrink: 0;
}

.explorer__filter-label {
  font-family: var(--nc-font-body);
  font-size: calc(11px * var(--nc-text-scale, 1));
  font-weight: 500;
  color: var(--nc-text-muted);
}

.explorer__filter-pill--active .explorer__filter-label {
  color: var(--nc-text);
  font-weight: 600;
}

.explorer__filter-count {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Section divider — mono uppercase micro-label (REDESIGN.md §4) */
.explorer__section-divider {
  display: flex;
  align-items: center;
  padding: 12px 16px 4px;
  gap: 8px;
  flex-shrink: 0;
}

.explorer__section-label {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  text-transform: uppercase;
  color: var(--nc-text-muted);
  letter-spacing: 0.14em;
}

.explorer__section-line {
  flex: 1;
  height: 1px;
  background: var(--nc-border-subtle);
}

.explorer__section-count {
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

/* Root node card — accent tint + left marker */
.explorer__root-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin: 0 10px;
  background: rgba(var(--nc-accent-rgb), 0.05);
  border-radius: 0.5rem;
  border-left: 2px solid var(--nc-accent);
  cursor: pointer;
  transition: background 150ms var(--nc-ease);
  flex-shrink: 0;
}

@media (hover: hover) and (pointer: fine) {
  .explorer__root-card:hover {
    background: rgba(var(--nc-accent-rgb), 0.08);
  }
}

/* Root avatar — user node color (data) via v-bind */
.explorer__root-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 7px;
  flex-shrink: 0;
  background: color-mix(in srgb, v-bind(rootAvatarColor) 12%, transparent);
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 700;
}

.explorer__root-letter {
  color: v-bind(rootAvatarColor);
}

.explorer__root-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.explorer__root-name {
  font-family: var(--nc-font-body);
  font-size: calc(13px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.explorer__root-meta {
  font-family: var(--nc-font-body);
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
}

.explorer__root-chevron {
  font-size: calc(14px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
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
  font-size: calc(28px * var(--nc-text-scale, 1));
  color: var(--nc-ink-faint);
  margin-bottom: 8px;
  opacity: 0.5;
}

.explorer__empty-text {
  color: var(--nc-ink-faint);
  font-size: calc(11px * var(--nc-text-scale, 1));
  line-height: 1.5;
}
</style>
