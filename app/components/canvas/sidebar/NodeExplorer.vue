<script setup lang="ts">
import type { Node } from '~/types'
import { useMapStore } from '~/stores/mapStore'
import { getCategoryInfo, nodeCategories, type NodeCategory } from '~/composables/useSidebarState'

/**
 * NodeExplorer — Search, filter, and grouped node list
 * Replaces the explorer section of the old monolithic sidebar
 */
const props = defineProps<{
  selectedNode: Node | null
  explorerHeight: number
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggle: []
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

// Grouped by category
const groupedNodes = computed(() => {
  const groups: Record<string, Node[]> = {}
  for (const node of filteredNodes.value) {
    const cat = (node.metadata?.category as string) || 'uncategorized'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(node)
  }
  return groups
})

function selectNode(nodeId: string) {
  mapStore.select([nodeId])
  emit('navigateToNode', nodeId)
}
</script>

<template>
  <div class="explorer">
    <!-- Header -->
    <CanvasSidebarSidebarHeader
      icon="i-lucide-layers"
      label="Node Explorer"
      :collapsed="collapsed"
      :badge="mapStore.nodes.size"
      accent-color="var(--nc-accent)"
      @toggle="emit('toggle')"
    />

    <!-- Content -->
    <div
      :class="['explorer__body', collapsed && 'explorer__body--collapsed']"
      :style="{ maxHeight: collapsed ? '0' : `${explorerHeight}px` }"
    >
      <!-- Search -->
      <div class="explorer__search-wrap">
        <div :class="['explorer__search', searchQuery && 'explorer__search--active']">
          <span class="i-lucide-search explorer__search-icon" />
          <input
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
        </div>
      </div>

      <!-- Category quick-add -->
      <CanvasSidebarCategoryQuickAdd
        @add-category="(cat) => emit('addCategorizedNode', cat)"
        @drag-start-category="(cat) => emit('dragStartCategory', cat)"
      />

      <!-- Node list -->
      <div class="explorer__list">
        <template v-for="(nodes, categoryId) in groupedNodes" :key="categoryId">
          <div class="explorer__group">
            <div class="explorer__group-header">
              <span
                :class="getCategoryInfo(categoryId as string).icon"
                :style="{ color: getCategoryInfo(categoryId as string).color }"
                class="explorer__group-icon"
              />
              <span class="explorer__group-label">
                {{ getCategoryInfo(categoryId as string).label }}
              </span>
              <span class="explorer__group-count">{{ nodes.length }}</span>
            </div>
            <CanvasSidebarNodeExplorerItem
              v-for="node in nodes"
              :key="node.id"
              :node="node"
              :is-active="selectedNode?.id === node.id"
              @select="selectNode"
              @drag-start="(ev, id) => emit('dragStartNode', id)"
            />
          </div>
        </template>

        <!-- Empty state -->
        <div v-if="filteredNodes.length === 0" class="explorer__empty">
          <span class="i-lucide-inbox explorer__empty-icon" />
          <p v-if="searchQuery" class="explorer__empty-text">
            No nodes match "{{ searchQuery }}"
          </p>
          <p v-else class="explorer__empty-text">
            No nodes yet — click a category above to start
          </p>
        </div>
      </div>
    </div>

    <!-- Resize handle -->
    <div
      v-if="!collapsed"
      class="explorer__resize"
      @mousedown="(e) => emit('startResize', e)"
    >
      <div class="explorer__resize-bar" />
    </div>
  </div>
</template>

<style scoped>
.explorer {
  position: relative;
}

.explorer__body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.2s ease;
}

.explorer__body--collapsed {
  max-height: 0 !important;
  opacity: 0;
}

/* Search */
.explorer__search-wrap {
  padding: 0 12px 8px;
}

.explorer__search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--nc-surface);
  border: 1px solid var(--nc-border);
  border-radius: 8px;
  padding: 7px 10px;
  transition: all 0.2s ease;
}

.explorer__search:focus-within,
.explorer__search--active {
  border-color: var(--nc-accent);
  box-shadow: 0 0 0 3px var(--nc-accent-glow);
}

.explorer__search-icon {
  font-size: 13px;
  color: var(--nc-ink-faint);
  flex-shrink: 0;
}

.explorer__search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--nc-ink);
  font-size: 12px;
  font-family: var(--nc-font-body);
}

.explorer__search-input::placeholder {
  color: var(--nc-ink-faint);
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

/* Node list */
.explorer__list {
  flex: 1;
  overflow-y: auto;
  padding: 0 4px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--nc-surface-3) transparent;
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

/* Groups */
.explorer__group {
  margin-bottom: 4px;
}

.explorer__group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  color: var(--nc-ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.explorer__group-icon {
  font-size: 11px;
}

.explorer__group-label {
  flex: 1;
}

.explorer__group-count {
  margin-left: auto;
  background: var(--nc-surface-3);
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 9px;
  font-family: var(--nc-font-mono);
  color: var(--nc-ink-faint);
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

/* Resize handle */
.explorer__resize {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 10px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.explorer__resize-bar {
  width: 36px;
  height: 3px;
  background: var(--nc-border-active);
  border-radius: 2px;
  transition: all 0.2s ease;
}

.explorer__resize:hover .explorer__resize-bar {
  background: var(--nc-accent);
  width: 48px;
  box-shadow: 0 0 8px var(--nc-accent-glow);
}
</style>
