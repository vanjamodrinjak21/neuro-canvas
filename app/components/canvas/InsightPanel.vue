<script setup lang="ts">
import type { Node, Edge } from '~/types/canvas'
import type { Insight, InsightType } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'
import { useInsightEngine } from '~/composables/useInsightEngine'
import { useMapStore } from '~/stores/mapStore'

const emit = defineEmits<{
  'add-insight-node': [insight: Insight]
  'navigate-to-node': [nodeId: string]
  'highlight-nodes': [nodeIds: string[]]
  'clear-highlights': []
}>()

const mapStore = useMapStore()
const semanticStore = useSemanticStore()
const insightEngine = useInsightEngine()

// Section collapse state
const isCollapsed = ref(false)

// Insight type icons
const insightIcons: Record<InsightType, string> = {
  bridge: 'i-lucide-git-merge',
  gap: 'i-lucide-circle-plus',
  outlier: 'i-lucide-circle-alert',
  cluster: 'i-lucide-network'
}

// Insight type colors
const insightColors: Record<InsightType, string> = {
  bridge: '#60A5FA',  // Blue
  gap: '#4ADE80',     // Green
  outlier: '#FB923C', // Orange
  cluster: '#A78BFA'  // Purple
}

// Get insights from store
const insights = computed(() => semanticStore.insights)

// Analyze map
async function handleAnalyze() {
  await insightEngine.analyzeMap(mapStore.nodes, mapStore.edges)
}

// Add node from insight
function handleAddNode(insight: Insight) {
  if (!insight.suggestedContent || !insight.suggestedPosition) {
    // For bridge insights, just create connections
    if (insight.suggestedConnections) {
      for (const conn of insight.suggestedConnections) {
        // Check if edge already exists
        const exists = Array.from(mapStore.edges.values()).some(
          e => (e.sourceId === conn.sourceId && e.targetId === conn.targetId) ||
               (e.sourceId === conn.targetId && e.targetId === conn.sourceId)
        )
        if (!exists) {
          mapStore.addEdge(conn.sourceId, conn.targetId)
        }
      }
    }
    semanticStore.removeInsight(insight.id)
    return
  }

  // Create new node
  const newNode = mapStore.addNode({
    position: insight.suggestedPosition,
    content: insight.suggestedContent
  })

  // Connect to related nodes
  const firstRelatedId = insight.relatedNodeIds[0]
  if (firstRelatedId) {
    mapStore.addEdge(firstRelatedId, newNode.id)
  }

  // Remove insight
  semanticStore.removeInsight(insight.id)

  emit('add-insight-node', insight)
}

// Navigate to related nodes
function handleView(insight: Insight) {
  const firstNodeId = insight.relatedNodeIds[0]
  if (firstNodeId) {
    emit('navigate-to-node', firstNodeId)
    mapStore.select(insight.relatedNodeIds)
  }
}

// Hover handlers
function handleMouseEnter(insight: Insight) {
  emit('highlight-nodes', insight.relatedNodeIds)
}

function handleMouseLeave() {
  emit('clear-highlights')
}

// Dismiss insight
function handleDismiss(insightId: string) {
  semanticStore.removeInsight(insightId)
}

// Get action button text based on insight type
function getActionText(insight: Insight): string {
  switch (insight.type) {
    case 'bridge':
      return 'Connect'
    case 'gap':
      return 'Add Node'
    case 'outlier':
      return 'View'
    default:
      return 'Add'
  }
}
</script>

<template>
  <div class="nc-insight-panel">
    <button
      class="nc-insight-header"
      @click="isCollapsed = !isCollapsed"
    >
      <span class="flex items-center gap-2">
        <span class="i-lucide-lightbulb text-sm" />
        <span>Insights</span>
        <span v-if="insights.length > 0" class="nc-insight-count">{{ insights.length }}</span>
      </span>
      <span
        :class="['i-lucide-chevron-down text-sm transition-transform', isCollapsed && '-rotate-90']"
      />
    </button>

    <div
      :class="['nc-insight-content', isCollapsed && 'collapsed']"
    >
      <!-- Analyze button -->
      <button
        class="nc-insight-analyze-btn"
        :disabled="insightEngine.isAnalyzing.value || semanticStore.nodesWithEmbeddings.length < 3"
        @click="handleAnalyze"
      >
        <span
          :class="[
            'text-sm',
            insightEngine.isAnalyzing.value ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-scan'
          ]"
        />
        <span>{{ insightEngine.isAnalyzing.value ? 'Analyzing...' : 'Analyze Map' }}</span>
      </button>

      <!-- Empty state -->
      <div v-if="insights.length === 0 && !insightEngine.isAnalyzing.value" class="nc-insight-empty">
        <span class="i-lucide-brain text-2xl mb-2 text-[#444448]" />
        <p v-if="semanticStore.nodesWithEmbeddings.length < 3">
          Add more nodes to discover insights
        </p>
        <p v-else>
          Click "Analyze Map" to discover insights
        </p>
      </div>

      <!-- Insights list -->
      <div v-else class="nc-insight-list">
        <div
          v-for="insight in insights"
          :key="insight.id"
          class="nc-insight-card"
          @mouseenter="handleMouseEnter(insight)"
          @mouseleave="handleMouseLeave"
        >
          <!-- Header -->
          <div class="nc-insight-card-header">
            <span
              :class="[insightIcons[insight.type as InsightType], 'text-base']"
              :style="{ color: insightColors[insight.type as InsightType] }"
            />
            <span class="nc-insight-title">{{ insight.title }}</span>
            <button
              class="nc-insight-dismiss"
              title="Dismiss"
              @click.stop="handleDismiss(insight.id)"
            >
              <span class="i-lucide-x text-xs" />
            </button>
          </div>

          <!-- Description -->
          <p class="nc-insight-description">
            {{ insight.description }}
          </p>

          <!-- Confidence -->
          <div class="nc-insight-confidence">
            <span class="nc-insight-confidence-bar">
              <span
                class="nc-insight-confidence-fill"
                :style="{
                  width: `${insight.confidence * 100}%`,
                  backgroundColor: insightColors[insight.type as InsightType]
                }"
              />
            </span>
            <span class="nc-insight-confidence-text">
              {{ Math.round(insight.confidence * 100) }}% confidence
            </span>
          </div>

          <!-- Actions -->
          <div class="nc-insight-actions">
            <button
              class="nc-insight-action-btn nc-insight-action-primary"
              @click="handleAddNode(insight)"
            >
              <span :class="insight.type === 'bridge' ? 'i-lucide-link' : 'i-lucide-plus'" class="text-xs" />
              {{ getActionText(insight) }}
            </button>
            <button
              class="nc-insight-action-btn"
              @click="handleView(insight)"
            >
              <span class="i-lucide-eye text-xs" />
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-insight-panel {
  border-bottom: 1px solid #1A1A1E;
}

.nc-insight-header {
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

.nc-insight-header:hover {
  color: #FAFAFA;
}

.nc-insight-count {
  background: #00D2BE;
  color: #0D0D10;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.nc-insight-content {
  padding: 0 16px 16px;
  overflow: hidden;
  max-height: 400px;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.nc-insight-content.collapsed {
  max-height: 0;
  padding-bottom: 0;
  opacity: 0;
}

.nc-insight-analyze-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: rgba(0, 210, 190, 0.1);
  border: 1px solid rgba(0, 210, 190, 0.3);
  border-radius: 6px;
  color: #00D2BE;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-insight-analyze-btn:hover:not(:disabled) {
  background: rgba(0, 210, 190, 0.15);
  border-color: #00D2BE;
}

.nc-insight-analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nc-insight-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  color: #555558;
  font-size: 11px;
  text-align: center;
}

.nc-insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nc-insight-card {
  background: #141418;
  border: 1px solid #1A1A1E;
  border-radius: 8px;
  padding: 12px;
  transition: all 0.15s ease;
}

.nc-insight-card:hover {
  border-color: #2A2A30;
  background: #1A1A1E;
}

.nc-insight-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.nc-insight-title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #FAFAFA;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nc-insight-dismiss {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #555558;
  opacity: 0;
  transition: all 0.15s ease;
}

.nc-insight-card:hover .nc-insight-dismiss {
  opacity: 1;
}

.nc-insight-dismiss:hover {
  color: #FAFAFA;
  background: #2A2A30;
}

.nc-insight-description {
  font-size: 11px;
  color: #888890;
  line-height: 1.5;
  margin-bottom: 10px;
}

.nc-insight-confidence {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.nc-insight-confidence-bar {
  flex: 1;
  height: 4px;
  background: #2A2A30;
  border-radius: 2px;
  overflow: hidden;
}

.nc-insight-confidence-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.nc-insight-confidence-text {
  font-size: 10px;
  color: #555558;
  white-space: nowrap;
}

.nc-insight-actions {
  display: flex;
  gap: 6px;
}

.nc-insight-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid #2A2A30;
  border-radius: 4px;
  color: #888890;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-insight-action-btn:hover {
  border-color: #3A3A42;
  color: #FAFAFA;
  background: #1A1A1E;
}

.nc-insight-action-primary {
  background: rgba(0, 210, 190, 0.1);
  border-color: rgba(0, 210, 190, 0.3);
  color: #00D2BE;
}

.nc-insight-action-primary:hover {
  background: rgba(0, 210, 190, 0.2);
  border-color: #00D2BE;
  color: #00D2BE;
}
</style>
