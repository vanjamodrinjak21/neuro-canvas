<script setup lang="ts">
import type { Node, Edge } from '~/types/canvas'

definePageMeta({
  layout: false,
  auth: false,
  ssr: false,
})

const route = useRoute()
const token = computed(() => route.params.token as string)
const platform = usePlatform()
const isMobile = computed(() => platform.isMobile.value)

const isLoading = ref(true)
const error = ref<string | null>(null)
const mapTitle = ref('')
const mapData = ref<{
  nodes: Record<string, Node>
  edges: Record<string, Edge>
  rootNodeId?: string
} | null>(null)

// Outline items for mobile read-only view
const outlineItems = computed(() => {
  if (!mapData.value) return []

  const data = mapData.value
  const nodes = new Map(Object.entries(data.nodes))
  const edges = new Map(
    Object.entries(data.edges || {}).map(([k, v]) => [k, v as Edge])
  )

  // Build adjacency list
  const childrenOf = new Map<string, string[]>()
  for (const edge of edges.values()) {
    const list = childrenOf.get(edge.sourceId) || []
    list.push(edge.targetId)
    childrenOf.set(edge.sourceId, list)
  }

  const items: { content: string; depth: number }[] = []
  const visited = new Set<string>()

  function walk(nodeId: string, depth: number) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    const node = nodes.get(nodeId)
    if (!node) return
    items.push({ content: (node as Node).content, depth })
    for (const childId of childrenOf.get(nodeId) || []) {
      walk(childId, depth + 1)
    }
  }

  const rootId = data.rootNodeId
  if (rootId && nodes.has(rootId)) walk(rootId, 0)
  for (const [id] of nodes) {
    if (!visited.has(id)) walk(id, 0)
  }

  return items
})

onMounted(async () => {
  try {
    const res = await $fetch<{
      id: string
      title: string
      data: any
      preview: string | null
      updatedAt: string
    }>(`/api/share/${token.value}`)

    mapTitle.value = res.title
    mapData.value = res.data
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Failed to load shared map'
  } finally {
    isLoading.value = false
  }
})

useHead({
  title: () => mapTitle.value ? `${mapTitle.value} - NeuroCanvas` : 'Shared Map - NeuroCanvas',
})
</script>

<template>
  <div class="nc-share-page">
    <!-- Loading -->
    <div v-if="isLoading" class="nc-share-center">
      <span class="i-lucide-loader-circle nc-share-spin" />
      <span class="nc-share-loading-text">Loading shared map...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="nc-share-center">
      <span class="i-lucide-alert-circle nc-share-error-icon" />
      <span class="nc-share-error-text">{{ error }}</span>
      <a href="/" class="nc-share-cta">Go to NeuroCanvas</a>
    </div>

    <!-- Shared map content -->
    <template v-else>
      <!-- Top bar -->
      <div class="nc-share-topbar">
        <div class="nc-share-topbar-info">
          <h1 class="nc-share-title">{{ mapTitle }}</h1>
          <span class="nc-share-badge">Shared Map</span>
        </div>
        <a href="/" class="nc-share-cta-btn">
          Open in NeuroCanvas
        </a>
      </div>

      <!-- Mobile: read-only outline view -->
      <div v-if="isMobile" class="nc-share-outline">
        <div
          v-for="(item, i) in outlineItems"
          :key="i"
          class="nc-share-outline-item"
          :style="{ paddingLeft: `${item.depth * 24 + 16}px` }"
        >
          <span class="nc-share-bullet" />
          <span class="nc-share-item-text">{{ item.content }}</span>
        </div>
      </div>

      <!-- Desktop: read-only canvas view (placeholder — uses PNG render) -->
      <div v-else class="nc-share-canvas-placeholder">
        <p class="nc-share-placeholder-text">
          Desktop canvas view for shared maps coming soon.
        </p>
        <div class="nc-share-outline nc-share-outline--desktop">
          <div
            v-for="(item, i) in outlineItems"
            :key="i"
            class="nc-share-outline-item"
            :style="{ paddingLeft: `${item.depth * 24 + 24}px` }"
          >
            <span class="nc-share-bullet" />
            <span class="nc-share-item-text">{{ item.content }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.nc-share-page {
  min-height: 100dvh;
  background: var(--nc-bg, #09090B);
  color: var(--nc-text, #FAFAFA);
  font-family: var(--nc-font-body, 'Cabinet Grotesk', system-ui, sans-serif);
}

.nc-share-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  gap: 12px;
}

.nc-share-spin {
  font-size: 32px;
  color: var(--nc-accent, #00D2BE);
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.nc-share-loading-text {
  font-size: 14px;
  color: var(--nc-text-soft, #A1A1AA);
}

.nc-share-error-icon {
  font-size: 32px;
  color: #EF4444;
}

.nc-share-error-text {
  font-size: 14px;
  color: var(--nc-text-soft, #A1A1AA);
}

.nc-share-cta {
  margin-top: 8px;
  padding: 8px 20px;
  border-radius: 8px;
  background: var(--nc-accent, #00D2BE);
  color: #09090B;
  font-weight: 600;
  font-size: 14px;
  text-decoration: none;
}

.nc-share-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: max(12px, env(safe-area-inset-top));
  border-bottom: 1px solid var(--nc-border, #1A1A1E);
  gap: 12px;
}

.nc-share-topbar-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.nc-share-title {
  font-family: var(--nc-font-display, 'Cabinet Grotesk');
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-share-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 6px;
  background: rgba(0, 210, 190, 0.1);
  color: var(--nc-accent, #00D2BE);
  border: 1px solid rgba(0, 210, 190, 0.15);
}

.nc-share-cta-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--nc-accent, #00D2BE);
  color: #09090B;
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.nc-share-outline {
  padding: 16px 0;
}

.nc-share-outline--desktop {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 0;
}

.nc-share-outline-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 16px 4px 0;
  min-height: 32px;
}

.nc-share-bullet {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nc-text-muted, #52525B);
  margin-top: 9px;
}

.nc-share-item-text {
  font-size: 15px;
  line-height: 24px;
  color: var(--nc-text, #FAFAFA);
}

.nc-share-canvas-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
}

.nc-share-placeholder-text {
  font-size: 14px;
  color: var(--nc-text-muted, #52525B);
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .nc-share-cta-btn {
    padding: 6px 12px;
    font-size: 12px;
  }

  .nc-share-title {
    font-size: 16px;
  }
}
</style>
