<script setup lang="ts">
import type { Node, Edge } from '~/types/canvas'
import type { Insight, InsightType, EnrichedInsight } from '~/types/semantic'
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

// Insight type icons (v1 + v2 types)
const insightIcons: Record<string, string> = {
  bridge: 'i-lucide-git-merge',
  gap: 'i-lucide-circle-plus',
  outlier: 'i-lucide-circle-alert',
  cluster: 'i-lucide-network',
  'conceptual-gap': 'i-lucide-puzzle',
  'structural-suggestion': 'i-lucide-layout-grid',
  'balance-issue': 'i-lucide-scale',
  'deepening-opportunity': 'i-lucide-arrow-down-circle',
  'accuracy-concern': 'i-lucide-alert-triangle'
}

// Insight type colors (v1 + v2 types)
const insightColors: Record<string, string> = {
  bridge: '#60A5FA',              // Blue
  gap: '#4ADE80',                 // Green
  outlier: '#FB923C',             // Orange
  cluster: '#A78BFA',             // Purple
  'conceptual-gap': '#38BDF8',    // Sky blue
  'structural-suggestion': '#818CF8', // Indigo
  'balance-issue': '#FBBF24',     // Amber
  'deepening-opportunity': '#34D399', // Emerald
  'accuracy-concern': '#F87171'   // Red
}

// Expanded reasoning visibility
const expandedInsights = ref(new Set<string>())

// Get insights from store
const insights = computed(() => semanticStore.insights)

// Analyze map (heuristic only)
async function handleAnalyze() {
  await insightEngine.analyzeMap(mapStore.nodes, mapStore.edges)
}

// Analyze map with AI (heuristic + LLM)
async function handleAIAnalyze() {
  await insightEngine.analyzeMapWithAI(mapStore.nodes, mapStore.edges, mapStore.title)
}

// Check if insight is enriched (has LLM data)
function isEnriched(insight: Insight): insight is EnrichedInsight {
  return 'isLLMGenerated' in insight && (insight as EnrichedInsight).isLLMGenerated === true
}

// Toggle reasoning visibility
function toggleReasoning(insightId: string) {
  if (expandedInsights.value.has(insightId)) {
    expandedInsights.value.delete(insightId)
  } else {
    expandedInsights.value.add(insightId)
  }
}

// Apply an enriched insight's suggested action
function handleApplyAction(insight: EnrichedInsight) {
  if (!insight.suggestedAction || !insight.actionPayload) {
    handleAddNode(insight)
    return
  }

  switch (insight.suggestedAction) {
    case 'add-node': {
      const payload = insight.actionPayload as { title?: string; parentNodeId?: string }
      const position = insight.suggestedPosition || { x: 400, y: 400 }
      const newNode = mapStore.addNode({
        position,
        content: payload.title || insight.suggestedContent || 'New Concept'
      })
      if (payload.parentNodeId) {
        mapStore.addEdge(payload.parentNodeId, newNode.id)
      }
      break
    }
    case 'add-connection': {
      const payload = insight.actionPayload as { sourceId?: string; targetId?: string }
      if (payload.sourceId && payload.targetId) {
        mapStore.addEdge(payload.sourceId, payload.targetId)
      }
      break
    }
    default:
      handleAddNode(insight)
  }

  semanticStore.removeInsight(insight.id)
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
  if (isEnriched(insight) && insight.suggestedAction) {
    switch (insight.suggestedAction) {
      case 'add-node': return 'Add Node'
      case 'add-connection': return 'Connect'
      case 'restructure': return 'Restructure'
      case 'merge': return 'Merge'
      case 'expand': return 'Expand'
      case 'delete': return 'Remove'
    }
  }
  switch (insight.type) {
    case 'bridge': return 'Connect'
    case 'gap': case 'conceptual-gap': return 'Add Node'
    case 'outlier': return 'View'
    case 'structural-suggestion': return 'Apply'
    case 'deepening-opportunity': return 'Expand'
    case 'balance-issue': return 'Fix'
    case 'accuracy-concern': return 'Review'
    default: return 'Add'
  }
}
</script>

<template>
  <div class="nc-insight-panel">
    <div class="nc-insight-header">
      <span class="flex items-center gap-2">
        <span class="i-lucide-lightbulb text-sm" />
        <span>Insights</span>
        <span v-if="insights.length > 0" class="nc-insight-count">{{ insights.length }}</span>
      </span>
    </div>

    <div class="nc-insight-content">
      <!-- Analyze buttons -->
      <div class="nc-insight-analyze-row">
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
          <span>{{ insightEngine.isAnalyzing.value ? 'Analyzing...' : 'Analyze' }}</span>
        </button>
        <button
          class="nc-insight-analyze-btn nc-insight-ai-btn"
          :disabled="insightEngine.isAnalyzing.value"
          @click="handleAIAnalyze"
        >
          <span
            :class="[
              'text-sm',
              insightEngine.isAnalyzing.value ? 'i-lucide-loader-2 animate-spin' : 'i-lucide-sparkles'
            ]"
          />
          <span>AI Analyze</span>
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="insights.length === 0 && !insightEngine.isAnalyzing.value" class="nc-insight-empty">
        <span class="i-lucide-brain text-2xl mb-2 text-nc-ink-muted" />
        <p v-if="semanticStore.nodesWithEmbeddings.length < 3">
          Add more nodes to discover insights
        </p>
        <p v-else>
          Click "Analyze Map" to discover insights
        </p>
      </div>

      <!-- Insights list -->
      <TransitionGroup v-else name="nc-fade-up" tag="div" class="nc-insight-list">
        <div
          v-for="(insight, index) in insights"
          :key="insight.id"
          class="nc-insight-card"
          :style="{ transitionDelay: `${index * 50}ms` }"
          @mouseenter="handleMouseEnter(insight)"
          @mouseleave="handleMouseLeave"
        >
          <!-- Header -->
          <div class="nc-insight-card-header">
            <span
              :class="[insightIcons[insight.type] || 'i-lucide-lightbulb', 'text-base']"
              :style="{ color: insightColors[insight.type] || '#AAAAB0' }"
            />
            <span class="nc-insight-title">{{ insight.title }}</span>
            <span v-if="isEnriched(insight)" class="nc-insight-ai-badge">AI</span>
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

          <!-- Reasoning (expandable, LLM insights only) -->
          <div v-if="isEnriched(insight) && (insight as EnrichedInsight).reasoning" class="nc-insight-reasoning-toggle">
            <button
              class="nc-insight-reasoning-btn"
              @click.stop="toggleReasoning(insight.id)"
            >
              <span :class="expandedInsights.has(insight.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="text-xs" />
              {{ expandedInsights.has(insight.id) ? 'Hide reasoning' : 'Show reasoning' }}
            </button>
            <p v-if="expandedInsights.has(insight.id)" class="nc-insight-reasoning-text">
              {{ (insight as EnrichedInsight).reasoning }}
            </p>
          </div>

          <!-- Confidence -->
          <div class="nc-insight-confidence">
            <span class="nc-insight-confidence-bar">
              <span
                class="nc-insight-confidence-fill"
                :style="{
                  width: `${insight.confidence * 100}%`,
                  backgroundColor: insightColors[insight.type] || '#AAAAB0'
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
              @click="isEnriched(insight) ? handleApplyAction(insight as EnrichedInsight) : handleAddNode(insight)"
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
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.nc-insight-panel {
  content-visibility: auto;
  contain-intrinsic-size: auto 400px;
  border-bottom: 1px solid var(--nc-border, #1A1A1E);
}

.nc-insight-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;
}

.nc-insight-header:hover {
  color: var(--nc-ink);
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
  padding: 0 14px 14px;
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
  padding: 8px 12px;
  margin-bottom: 8px;
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
  opacity: 0.4;
  filter: grayscale(0.3);
  cursor: not-allowed;
}

.nc-insight-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  color: var(--nc-ink-muted);
  font-size: 11px;
  text-align: center;
}

.nc-insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nc-insight-card {
  background: var(--nc-surface, #141418);
  border: 1px solid var(--nc-border, #1A1A1E);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.15s ease;
}

.nc-insight-card:hover {
  border-color: #2A2A30;
  background: rgba(255, 255, 255, 0.08);
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
  color: var(--nc-ink-muted);
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
  color: var(--nc-ink-soft);
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
  color: var(--nc-ink-muted);
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
  color: var(--nc-ink-soft);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nc-insight-action-btn:hover {
  border-color: #3A3A42;
  color: #FAFAFA;
  background: var(--nc-surface-3, #1A1A1E);
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

.nc-insight-analyze-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.nc-insight-analyze-row .nc-insight-analyze-btn {
  margin-bottom: 0;
}

.nc-insight-ai-btn {
  background: rgba(167, 139, 250, 0.1) !important;
  border-color: rgba(167, 139, 250, 0.3) !important;
  color: #A78BFA !important;
}

.nc-insight-ai-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.15) !important;
  border-color: #A78BFA !important;
}

.nc-insight-ai-badge {
  font-size: 9px;
  font-weight: 700;
  color: #A78BFA;
  background: rgba(167, 139, 250, 0.15);
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.nc-insight-reasoning-toggle {
  margin-bottom: 8px;
}

.nc-insight-reasoning-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--nc-ink-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
}

.nc-insight-reasoning-btn:hover {
  color: #FAFAFA;
}

.nc-insight-reasoning-text {
  font-size: 11px;
  color: var(--nc-ink-soft);
  line-height: 1.5;
  margin-top: 6px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  border-left: 2px solid #A78BFA;
}

@media (prefers-reduced-motion: reduce) {
  .nc-insight-card {
    transition: none;
  }
  .nc-insight-content {
    transition: none;
  }
}

/* Light theme */
:root.light .nc-insight-panel {
  border-bottom-color: #E8E8E6;
}

:root.light .nc-insight-header {
  color: #777777;
}

:root.light .nc-insight-header:hover {
  color: #111111;
}

:root.light .nc-insight-count {
  color: #FFFFFF;
}

:root.light .nc-insight-empty {
  color: #A1A1AA;
}

:root.light .nc-insight-card {
  background: #F5F5F3;
  border-color: #E8E8E6;
}

:root.light .nc-insight-card:hover {
  border-color: #D4D4D8;
  background: #EEEEEC;
}

:root.light .nc-insight-title {
  color: #111111;
}

:root.light .nc-insight-dismiss {
  color: #A1A1AA;
}

:root.light .nc-insight-dismiss:hover {
  color: #111111;
  background: #E8E8E6;
}

:root.light .nc-insight-description {
  color: #777777;
}

:root.light .nc-insight-confidence-bar {
  background: #E8E8E6;
}

:root.light .nc-insight-confidence-text {
  color: #A1A1AA;
}

:root.light .nc-insight-action-btn {
  border-color: #E8E8E6;
  color: #777777;
}

:root.light .nc-insight-action-btn:hover {
  border-color: #D4D4D8;
  color: #111111;
  background: #E8E8E6;
}

:root.light .nc-insight-reasoning-btn {
  color: #777777;
}

:root.light .nc-insight-reasoning-btn:hover {
  color: #111111;
}

:root.light .nc-insight-reasoning-text {
  color: #777777;
  background: rgba(0, 0, 0, 0.03);
}
</style>
