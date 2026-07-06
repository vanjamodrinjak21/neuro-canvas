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
const { t } = useI18n()

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

// Insight type colors live in scoped CSS as per-type modifier classes
// (`nc-insight-card--<type>`) bound to the --nc-* node tokens — the type
// set is fixed, so no inline styles are needed (REDESIGN.md §9).

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
      case 'add-node': return t('canvas.insight_panel.action_add_node')
      case 'add-connection': return t('canvas.insight_panel.action_connect')
      case 'restructure': return t('canvas.insight_panel.action_restructure')
      case 'merge': return t('canvas.insight_panel.action_merge')
      case 'expand': return t('canvas.insight_panel.action_expand')
      case 'delete': return t('canvas.insight_panel.action_remove')
    }
  }
  switch (insight.type) {
    case 'bridge': return t('canvas.insight_panel.action_connect')
    case 'gap': case 'conceptual-gap': return t('canvas.insight_panel.action_add_node')
    case 'outlier': return t('canvas.insight_panel.action_view')
    case 'structural-suggestion': return t('canvas.insight_panel.action_apply')
    case 'deepening-opportunity': return t('canvas.insight_panel.action_expand')
    case 'balance-issue': return t('canvas.insight_panel.action_fix')
    case 'accuracy-concern': return t('canvas.insight_panel.action_review')
    default: return t('canvas.insight_panel.action_add')
  }
}
</script>

<template>
  <div class="nc-insight-panel">
    <div class="nc-insight-header">
      <span class="flex items-center gap-2">
        <span class="i-lucide-lightbulb text-sm" />
        <span>{{ $t('canvas.insight_panel.title') }}</span>
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
          <span>{{ insightEngine.isAnalyzing.value ? $t('canvas.insight_panel.analyzing') : $t('canvas.insight_panel.analyze') }}</span>
        </button>
        <button
          class="nc-insight-analyze-btn nc-insight-ai-btn"
          :disabled="insightEngine.isAnalyzing.value"
          @click="handleAIAnalyze"
        >
          <span
            :class="[
              'text-sm',
              insightEngine.isAnalyzing.value ? 'i-lucide-loader-2 animate-pulse' : 'i-lucide-scan-eye'
            ]"
          />
          <span>{{ $t('canvas.insight_panel.ai_analyze') }}</span>
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="insights.length === 0 && !insightEngine.isAnalyzing.value" class="nc-insight-empty">
        <span class="i-lucide-brain text-2xl mb-2 text-nc-ink-muted" />
        <p v-if="semanticStore.nodesWithEmbeddings.length < 3">
          {{ $t('canvas.insight_panel.add_more_nodes') }}
        </p>
        <p v-else>
          {{ $t('canvas.insight_panel.click_analyze') }}
        </p>
      </div>

      <!-- Insights list -->
      <TransitionGroup v-else name="nc-fade-up" tag="div" class="nc-insight-list">
        <div
          v-for="(insight, index) in insights"
          :key="insight.id"
          :class="['nc-insight-card', `nc-insight-card--${insight.type}`]"
          :style="{ '--delay': `${index * 50}ms` }"
          @mouseenter="handleMouseEnter(insight)"
          @mouseleave="handleMouseLeave"
        >
          <!-- Header -->
          <div class="nc-insight-card-header">
            <span :class="[insightIcons[insight.type] || 'i-lucide-lightbulb', 'text-base', 'nc-insight-type-icon']" />
            <span class="nc-insight-title">{{ insight.title }}</span>
            <span v-if="isEnriched(insight)" class="nc-insight-ai-badge">AI</span>
            <button
              class="nc-insight-dismiss"
              :title="$t('canvas.insight_panel.dismiss')"
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
              {{ expandedInsights.has(insight.id) ? $t('canvas.insight_panel.hide_reasoning') : $t('canvas.insight_panel.show_reasoning') }}
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
                :style="{ '--fill': `${insight.confidence * 100}%` }"
              />
            </span>
            <span class="nc-insight-confidence-text">
              {{ $t('canvas.insight_panel.confidence', { n: Math.round(insight.confidence * 100) }) }}
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
              {{ $t('canvas.insight_panel.action_view') }}
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
  border-bottom: 1px solid var(--nc-border);
}

/* Section header — mono uppercase micro-label (REDESIGN.md §4) */
.nc-insight-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-family: var(--nc-font-mono);
  font-size: calc(10.5px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 150ms var(--nc-ease);
}

.nc-insight-header:hover {
  color: var(--nc-text);
}

.nc-insight-count {
  background: var(--nc-accent);
  color: var(--nc-bg);
  font-family: var(--nc-font-mono);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 2rem;
  min-width: 18px;
  text-align: center;
}

.nc-insight-content {
  padding: 0 14px 14px;
  overflow: hidden;
  max-height: 400px;
  transition:
    max-height 300ms var(--nc-ease),
    padding 300ms var(--nc-ease),
    opacity 300ms var(--nc-ease);
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
  background: rgba(var(--nc-accent-rgb), 0.1);
  border: 1px solid rgba(var(--nc-accent-rgb), 0.3);
  border-radius: 6px;
  color: var(--nc-accent-text);
  font-family: var(--nc-font-body);
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.nc-insight-analyze-btn:hover:not(:disabled) {
  background: rgba(var(--nc-accent-rgb), 0.15);
  border-color: var(--nc-accent);
}

.nc-insight-analyze-btn:active:not(:disabled) {
  transform: scale(0.97);
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
  color: var(--nc-text-muted);
  font-size: calc(11px * var(--nc-text-scale, 1));
  text-align: center;
}

.nc-insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nc-insight-card {
  --insight-color: var(--nc-text-muted);
  background: var(--nc-surface-2);
  border: 1px solid var(--nc-border);
  border-radius: 0.5rem;
  padding: 12px;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    opacity 150ms var(--nc-ease),
    transform 150ms var(--nc-ease);
  /* Entrance stagger from the list index (single custom property) */
  transition-delay: var(--delay, 0ms);
}

/* Insight-type accents — fixed type set mapped to the --nc-* node tokens.
   Coral marks accuracy concerns only (attention), per accent discipline. */
.nc-insight-card--bridge { --insight-color: var(--nc-node-blue); }
.nc-insight-card--gap { --insight-color: var(--nc-node-green); }
.nc-insight-card--outlier { --insight-color: var(--nc-node-orange); }
.nc-insight-card--cluster { --insight-color: var(--nc-node-purple); }
.nc-insight-card--conceptual-gap { --insight-color: var(--nc-node-blue); }
.nc-insight-card--structural-suggestion { --insight-color: var(--nc-node-purple); }
.nc-insight-card--balance-issue { --insight-color: var(--nc-node-yellow); }
.nc-insight-card--deepening-opportunity { --insight-color: var(--nc-node-green); }
.nc-insight-card--accuracy-concern { --insight-color: var(--nc-coral); }

.nc-insight-card:hover {
  border-color: var(--nc-border-active);
  background: var(--nc-surface-3);
}

.nc-insight-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.nc-insight-type-icon {
  color: var(--insight-color);
}

.nc-insight-title {
  flex: 1;
  font-size: calc(12px * var(--nc-text-scale, 1));
  font-weight: 600;
  color: var(--nc-text);
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
  color: var(--nc-text-muted);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 150ms var(--nc-ease),
    color 150ms var(--nc-ease),
    background 150ms var(--nc-ease);
}

.nc-insight-card:hover .nc-insight-dismiss {
  opacity: 1;
}

.nc-insight-dismiss:hover {
  color: var(--nc-text);
  background: var(--nc-surface-3);
}

.nc-insight-description {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
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
  background: var(--nc-surface-3);
  border-radius: 2px;
  overflow: hidden;
}

/* Fill width is JS-driven via the --fill custom property */
.nc-insight-confidence-fill {
  display: block;
  height: 100%;
  width: var(--fill, 0%);
  background: var(--insight-color);
  border-radius: 2px;
  transition: width 300ms var(--nc-ease);
}

.nc-insight-confidence-text {
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
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
  border: 1px solid var(--nc-border);
  border-radius: 4px;
  color: var(--nc-text-secondary);
  font-size: calc(10px * var(--nc-text-scale, 1));
  font-weight: 500;
  cursor: pointer;
  transition:
    background 150ms var(--nc-ease),
    border-color 150ms var(--nc-ease),
    color 150ms var(--nc-ease),
    transform var(--nc-duration-press) var(--nc-ease);
}

.nc-insight-action-btn:hover {
  border-color: var(--nc-border-active);
  color: var(--nc-text);
  background: var(--nc-surface-3);
}

.nc-insight-action-btn:active {
  transform: scale(0.97);
}

.nc-insight-action-primary {
  background: rgba(var(--nc-accent-rgb), 0.1);
  border-color: rgba(var(--nc-accent-rgb), 0.3);
  color: var(--nc-accent-text);
}

.nc-insight-action-primary:hover {
  background: rgba(var(--nc-accent-rgb), 0.15);
  border-color: var(--nc-accent);
  color: var(--nc-accent-text);
}

.nc-insight-analyze-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.nc-insight-analyze-row .nc-insight-analyze-btn {
  margin-bottom: 0;
}

/* AI analyze — neutral chip; accent stays the single interactive hue */
.nc-insight-ai-btn {
  background: var(--nc-chip-bg);
  border-color: var(--nc-border);
  color: var(--nc-text-secondary);
}

.nc-insight-ai-btn:hover:not(:disabled) {
  background: var(--nc-surface-3);
  border-color: var(--nc-border-active);
  color: var(--nc-text);
}

.nc-insight-ai-badge {
  font-family: var(--nc-font-mono);
  font-size: calc(9px * var(--nc-text-scale, 1));
  font-weight: 700;
  color: var(--nc-text-secondary);
  background: var(--nc-chip-bg);
  border: 1px solid var(--nc-border);
  padding: 1px 5px;
  border-radius: 4px;
  letter-spacing: 0.14em;
}

.nc-insight-reasoning-toggle {
  margin-bottom: 8px;
}

.nc-insight-reasoning-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: calc(10px * var(--nc-text-scale, 1));
  color: var(--nc-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  transition: color 150ms var(--nc-ease);
}

.nc-insight-reasoning-btn:hover {
  color: var(--nc-text);
}

.nc-insight-reasoning-text {
  font-size: calc(11px * var(--nc-text-scale, 1));
  color: var(--nc-text-secondary);
  line-height: 1.5;
  margin-top: 6px;
  padding: 8px;
  background: var(--nc-chip-bg);
  border-radius: 4px;
  border-left: 2px solid var(--nc-border-active);
}

@media (prefers-reduced-motion: reduce) {
  .nc-insight-card {
    transition: none;
  }
  .nc-insight-content {
    transition: none;
  }
}
</style>
