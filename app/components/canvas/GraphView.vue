<script setup lang="ts">
import type { GraphNode, GraphEdge, GraphViewOptions } from '~/types/canvas'
import { useMapStore } from '~/stores/mapStore'
import { useLinkIndex } from '~/composables/useLinkIndex'
import { useGraphRenderer } from '~/composables/useGraphRenderer'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  navigateToNode: [nodeId: string]
}>()

const mapStore = useMapStore()
const linkIndex = useLinkIndex()

// Container ref for D3
const containerRef = ref<HTMLElement | null>(null)
const containerSize = reactive({ width: 0, height: 0 })

// Graph renderer
const renderer = useGraphRenderer(containerRef, {
  onNodeClick: (nodeId) => {
    emit('navigateToNode', nodeId)
    emit('close')
  },
  onNodeHover: (nodeId) => {
    hoveredNode.value = nodeId ? mapStore.nodes.get(nodeId) ?? null : null
  }
})

// Local state
const hoveredNode = ref<{ id: string; content: string } | null>(null)

// Graph view options from store
const options = computed(() => mapStore.graphView.options)

// Build graph data from store
const graphData = computed(() => {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const nodeSet = new Set<string>()

  // Determine which nodes to include
  if (options.value.mode === 'local' && options.value.centerNodeId) {
    // Local mode: get nodes within depth
    const connectedIds = linkIndex.getConnectedNodes(options.value.centerNodeId, options.value.depth)
    connectedIds.forEach(id => nodeSet.add(id))
  } else {
    // Global mode: all nodes
    mapStore.nodes.forEach((_, id) => nodeSet.add(id))
  }

  // Apply search filter
  const searchQuery = options.value.filters.searchQuery?.toLowerCase()
  if (searchQuery) {
    const filteredSet = new Set<string>()
    nodeSet.forEach(id => {
      const node = mapStore.nodes.get(id)
      if (node && node.content.toLowerCase().includes(searchQuery)) {
        filteredSet.add(id)
      }
    })
    nodeSet.clear()
    filteredSet.forEach(id => nodeSet.add(id))
  }

  // Build nodes array
  nodeSet.forEach(id => {
    const node = mapStore.nodes.get(id)
    if (node) {
      nodes.push({
        id: node.id,
        label: node.content || 'Untitled',
        type: node.type,
        connections: linkIndex.getConnectionCount(node.id),
        color: node.style.borderColor || undefined
      })
    }
  })

  // Build edges array (only edges between included nodes)
  mapStore.edges.forEach(edge => {
    if (nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)) {
      edges.push({
        source: edge.sourceId,
        target: edge.targetId,
        weight: linkIndex.getLinkWeight(edge.sourceId, edge.targetId)
      })
    }
  })

  return { nodes, edges }
})

// Initialize renderer when visible
watch([() => props.visible, containerRef], ([visible, container]) => {
  if (visible && container) {
    nextTick(() => {
      const rect = container.getBoundingClientRect()
      containerSize.width = rect.width
      containerSize.height = rect.height
      renderer.initialize(rect.width, rect.height)
      renderer.updateData(graphData.value.nodes, graphData.value.edges)

      // If local mode with center node, center on it after simulation stabilizes
      if (options.value.mode === 'local' && options.value.centerNodeId) {
        setTimeout(() => {
          renderer.centerOnNode(options.value.centerNodeId!)
        }, 1000)
      } else {
        setTimeout(() => {
          renderer.zoomToFit()
        }, 1000)
      }
    })
  }
}, { immediate: true })

// Update graph when data changes
watch(graphData, (data) => {
  if (props.visible) {
    renderer.updateData(data.nodes, data.edges)
  }
}, { deep: true })

// Update physics when options change
watch(() => options.value.physics, (physics) => {
  if (props.visible) {
    renderer.setPhysics(physics)
  }
}, { deep: true })

// Handle resize
function handleResize() {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  containerSize.width = rect.width
  containerSize.height = rect.height
  renderer.initialize(rect.width, rect.height)
  renderer.updateData(graphData.value.nodes, graphData.value.edges)
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

// Update options
function updateOptions(newOptions: Partial<GraphViewOptions>) {
  mapStore.updateGraphViewOptions(newOptions)
}

// Cleanup
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  renderer.destroy()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-modal bg-nc-bg/95 backdrop-blur-xl flex flex-col"
      >
        <!-- Header -->
        <header class="absolute top-4 left-4 right-4 z-10 nc-between pointer-events-none">
          <!-- Left: Title -->
          <div class="pointer-events-auto nc-glass rounded-nc-xl px-4 py-3 nc-row gap-3 items-center">
            <div class="w-9 h-9 rounded-nc-lg bg-nc-accent/10 nc-center">
              <span class="i-lucide-git-branch text-nc-accent text-xl" />
            </div>
            <div>
              <h1 class="font-display font-bold text-lg text-nc-ink">Graph View</h1>
              <p class="text-xs text-nc-ink-muted">
                {{ options.mode === 'local' ? 'Local connections' : 'All connections' }}
              </p>
            </div>
          </div>

          <!-- Right: Close button -->
          <button
            class="pointer-events-auto w-10 h-10 rounded-nc-lg nc-glass nc-center text-nc-ink-muted hover:text-nc-ink hover:bg-nc-surface-2 transition-all"
            @click="emit('close')"
          >
            <span class="i-lucide-x text-xl" />
          </button>
        </header>

        <!-- Graph Container -->
        <div
          ref="containerRef"
          class="flex-1 w-full h-full"
        />

        <!-- Controls Panel -->
        <div class="absolute top-20 left-4 z-10">
          <GraphControls
            :options="options"
            :node-count="graphData.nodes.length"
            :edge-count="graphData.edges.length"
            @update:options="updateOptions"
            @reset-zoom="renderer.resetZoom()"
            @fit-to-view="renderer.zoomToFit()"
          />
        </div>

        <!-- Hovered Node Info -->
        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          leave-active-class="transition-all duration-100 ease-in"
          enter-from-class="opacity-0 translate-y-2"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div
            v-if="hoveredNode"
            class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 nc-glass rounded-nc-xl px-4 py-3 max-w-md"
          >
            <p class="text-sm text-nc-ink font-medium truncate">{{ hoveredNode.content || 'Untitled' }}</p>
            <p class="text-xs text-nc-ink-muted mt-1">Click to navigate</p>
          </div>
        </Transition>

        <!-- Legend -->
        <div class="absolute bottom-4 right-4 z-10 nc-glass rounded-nc-lg px-3 py-2">
          <div class="text-xs text-nc-ink-muted space-y-1">
            <div class="nc-row gap-2 items-center">
              <span class="i-lucide-mouse-pointer text-sm" />
              <span>Drag to pan, scroll to zoom</span>
            </div>
            <div class="nc-row gap-2 items-center">
              <span class="i-lucide-move text-sm" />
              <span>Drag node to move, Shift+release to pin</span>
            </div>
            <div class="nc-row gap-2 items-center">
              <span class="i-lucide-mouse-pointer-click text-sm" />
              <span>Click node to navigate</span>
            </div>
          </div>
        </div>

        <!-- Keyboard hint -->
        <div class="absolute bottom-4 left-4 z-10 hidden md:block">
          <div class="nc-row gap-2 text-xs text-nc-ink-muted">
            <span class="nc-shortcut-key">Esc</span>
            <span>Close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
