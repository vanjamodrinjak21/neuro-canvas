import type {
  NodeSemanticData,
  SimilarityEntry,
  Insight,
  AIState,
  FieldSettings,
  SemanticCluster,
  FieldInteractionState,
  ProcessorState
} from '~/types/semantic'

// Semantic store state interface
export interface SemanticState {
  nodeData: Map<string, NodeSemanticData>
  similarities: Map<string, SimilarityEntry[]>
  insights: Insight[]
  aiState: AIState
  fieldSettings: FieldSettings
  dirtyNodeIds: Set<string>
  currentMapId: string | null
  clusters: SemanticCluster[]
  fieldInteraction: FieldInteractionState
  processorState: ProcessorState
  embeddingQueueSize: number
}

// Semantic store actions interface
export interface SemanticActions {
  setCurrentMap(mapId: string | null): void
  markDirty(nodeId: string): void
  markDirtyBatch(nodeIds: string[]): void
  clearDirty(nodeId: string): void
  clearAllDirty(): void
  setNodeEmbedding(nodeId: string, embedding: number[], version?: number, contentHash?: number): void
  removeNodeData(nodeId: string): void
  updateSimilarities(pairs: Array<{ sourceId: string; targetId: string; similarity: number }>): void
  updateSimilaritiesIncremental(pairs: Array<{ sourceId: string; targetId: string; similarity: number }>): void
  getTopSimilar(nodeId: string, limit?: number): SimilarityEntry[]
  getSimilarity(nodeId1: string, nodeId2: string): number | null
  addInsight(insight: Omit<Insight, 'id' | 'createdAt'>): void
  removeInsight(insightId: string): void
  clearInsights(): void
  setAIStatus(status: AIState['status']): void
  setModelLoaded(loaded: boolean): void
  setModelProgress(progress: number): void
  setHasWebGPU(hasWebGPU: boolean): void
  setAIError(error: string | undefined): void
  toggleField(enabled?: boolean): void
  updateFieldSettings(settings: Partial<FieldSettings>): void
  setClusters(clusters: SemanticCluster[]): void
  setFieldInteraction(interaction: Partial<FieldInteractionState>): void
  setProcessorState(state: ProcessorState): void
  setEmbeddingQueueSize(size: number): void
  $reset(): void
}

// Combined store type
export type SemanticStore = SemanticState & SemanticActions & {
  // Getters
  readonly isAIReady: boolean
  readonly isAIBusy: boolean
  readonly nodesWithEmbeddings: NodeSemanticData[]
  readonly dirtyNodeCount: number
  readonly shouldRenderField: boolean
  readonly visibleSimilarityPairs: Array<{ sourceId: string; targetId: string; similarity: number }>
  readonly clusterCount: number
  readonly embeddedNodeCount: number
  clusterForNode(nodeId: string): SemanticCluster | undefined
}

// Default field settings
const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  enabled: false,
  intensity: 0.7,
  showParticles: true,
  showPulses: true,
  similarityThreshold: 0.5,
  maxFieldLines: 50,
  maxParticles: 200,
  showClusterGlow: true,
  showClusterLabels: true,
  interactiveExploration: false,
  adaptiveLineCount: true,
  embeddingBatchSize: 16
}

// Default AI state
const DEFAULT_AI_STATE: AIState = {
  status: 'idle',
  modelLoaded: false,
  modelProgress: 0,
  hasWebGPU: false,
  backendType: null
}

// Default field interaction state
const DEFAULT_FIELD_INTERACTION: FieldInteractionState = {
  hoveredNodeId: null,
  highlightedLineIds: new Set(),
  dimmedLineIds: new Set(),
  showSimilarityLabels: false
}

// Create initial state
function createInitialState(): SemanticState {
  return {
    nodeData: new Map(),
    similarities: new Map(),
    insights: [],
    aiState: { ...DEFAULT_AI_STATE },
    fieldSettings: { ...DEFAULT_FIELD_SETTINGS },
    dirtyNodeIds: new Set(),
    currentMapId: null,
    clusters: [],
    fieldInteraction: { ...DEFAULT_FIELD_INTERACTION },
    processorState: 'idle',
    embeddingQueueSize: 0
  }
}

// Store instance
const state = reactive<SemanticState>(createInitialState())

// Store actions
const actions: SemanticActions = {
  setCurrentMap(mapId: string | null) {
    if (state.currentMapId !== mapId) {
      state.nodeData.clear()
      state.similarities.clear()
      state.insights = []
      state.dirtyNodeIds.clear()
      state.clusters = []
      state.currentMapId = mapId
    }
  },

  markDirty(nodeId: string) {
    state.dirtyNodeIds.add(nodeId)
  },

  markDirtyBatch(nodeIds: string[]) {
    for (const id of nodeIds) {
      state.dirtyNodeIds.add(id)
    }
  },

  clearDirty(nodeId: string) {
    state.dirtyNodeIds.delete(nodeId)
  },

  clearAllDirty() {
    state.dirtyNodeIds.clear()
  },

  setNodeEmbedding(nodeId: string, embedding: number[], version: number = 1, contentHash: number = 0) {
    const existing = state.nodeData.get(nodeId)
    state.nodeData.set(nodeId, {
      nodeId,
      embedding,
      embeddingVersion: version,
      updatedAt: Date.now(),
      contentHash,
      clusterId: existing?.clusterId ?? null
    })
    state.dirtyNodeIds.delete(nodeId)
  },

  removeNodeData(nodeId: string) {
    state.nodeData.delete(nodeId)
    state.similarities.delete(nodeId)
    state.dirtyNodeIds.delete(nodeId)

    // Remove from other nodes' similarity lists
    for (const [, entries] of state.similarities) {
      const index = entries.findIndex(e => e.nodeId === nodeId)
      if (index !== -1) {
        entries.splice(index, 1)
      }
    }

    // Remove from clusters
    for (const cluster of state.clusters) {
      const idx = cluster.nodeIds.indexOf(nodeId)
      if (idx !== -1) {
        cluster.nodeIds.splice(idx, 1)
      }
    }
    // Remove empty clusters
    state.clusters = state.clusters.filter(c => c.nodeIds.length >= 2)
  },

  updateSimilarities(pairs: Array<{ sourceId: string; targetId: string; similarity: number }>) {
    state.similarities.clear()

    for (const pair of pairs) {
      // Add to source's list
      if (!state.similarities.has(pair.sourceId)) {
        state.similarities.set(pair.sourceId, [])
      }
      state.similarities.get(pair.sourceId)!.push({
        nodeId: pair.targetId,
        similarity: pair.similarity
      })

      // Add to target's list (bidirectional)
      if (!state.similarities.has(pair.targetId)) {
        state.similarities.set(pair.targetId, [])
      }
      state.similarities.get(pair.targetId)!.push({
        nodeId: pair.sourceId,
        similarity: pair.similarity
      })
    }
  },

  updateSimilaritiesIncremental(pairs: Array<{ sourceId: string; targetId: string; similarity: number }>) {
    // Collect which nodes have changed pairs
    const changedNodes = new Set<string>()
    for (const pair of pairs) {
      changedNodes.add(pair.sourceId)
      changedNodes.add(pair.targetId)
    }

    // Remove old entries for changed nodes
    for (const nodeId of changedNodes) {
      state.similarities.delete(nodeId)
    }

    // Also remove references to changed nodes from other nodes' lists
    for (const [sourceId, entries] of state.similarities) {
      if (changedNodes.has(sourceId)) continue
      const filtered = entries.filter(e => !changedNodes.has(e.nodeId))
      if (filtered.length !== entries.length) {
        state.similarities.set(sourceId, filtered)
      }
    }

    // Re-insert all pairs involving changed nodes from the full set
    for (const pair of pairs) {
      if (!state.similarities.has(pair.sourceId)) {
        state.similarities.set(pair.sourceId, [])
      }
      state.similarities.get(pair.sourceId)!.push({
        nodeId: pair.targetId,
        similarity: pair.similarity
      })

      if (!state.similarities.has(pair.targetId)) {
        state.similarities.set(pair.targetId, [])
      }
      state.similarities.get(pair.targetId)!.push({
        nodeId: pair.sourceId,
        similarity: pair.similarity
      })
    }
  },

  getTopSimilar(nodeId: string, limit: number = 5): SimilarityEntry[] {
    const entries = state.similarities.get(nodeId) || []
    return [...entries]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  },

  getSimilarity(nodeId1: string, nodeId2: string): number | null {
    const entries = state.similarities.get(nodeId1)
    if (!entries) return null
    const entry = entries.find(e => e.nodeId === nodeId2)
    return entry?.similarity ?? null
  },

  addInsight(insight: Omit<Insight, 'id' | 'createdAt'>) {
    const newInsight: Insight = {
      ...insight,
      id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now()
    }
    state.insights.push(newInsight)
  },

  removeInsight(insightId: string) {
    const index = state.insights.findIndex(i => i.id === insightId)
    if (index !== -1) {
      state.insights.splice(index, 1)
    }
  },

  clearInsights() {
    state.insights = []
  },

  setAIStatus(status: AIState['status']) {
    state.aiState.status = status
  },

  setModelLoaded(loaded: boolean) {
    state.aiState.modelLoaded = loaded
    if (loaded) {
      state.aiState.status = 'ready'
    }
  },

  setModelProgress(progress: number) {
    state.aiState.modelProgress = progress
  },

  setHasWebGPU(hasWebGPU: boolean) {
    state.aiState.hasWebGPU = hasWebGPU
  },

  setAIError(error: string | undefined) {
    state.aiState.error = error
    if (error) {
      state.aiState.status = 'error'
    }
  },

  toggleField(enabled?: boolean) {
    state.fieldSettings.enabled = enabled ?? !state.fieldSettings.enabled
  },

  updateFieldSettings(settings: Partial<FieldSettings>) {
    state.fieldSettings = { ...state.fieldSettings, ...settings }
  },

  setClusters(clusters: SemanticCluster[]) {
    state.clusters = clusters
    // Update clusterId on node data
    for (const cluster of clusters) {
      for (const nodeId of cluster.nodeIds) {
        const data = state.nodeData.get(nodeId)
        if (data) {
          data.clusterId = cluster.id
        }
      }
    }
  },

  setFieldInteraction(interaction: Partial<FieldInteractionState>) {
    if (interaction.hoveredNodeId !== undefined) {
      state.fieldInteraction.hoveredNodeId = interaction.hoveredNodeId
    }
    if (interaction.highlightedLineIds !== undefined) {
      state.fieldInteraction.highlightedLineIds = interaction.highlightedLineIds
    }
    if (interaction.dimmedLineIds !== undefined) {
      state.fieldInteraction.dimmedLineIds = interaction.dimmedLineIds
    }
    if (interaction.showSimilarityLabels !== undefined) {
      state.fieldInteraction.showSimilarityLabels = interaction.showSimilarityLabels
    }
  },

  setProcessorState(processorState: ProcessorState) {
    state.processorState = processorState
  },

  setEmbeddingQueueSize(size: number) {
    state.embeddingQueueSize = size
  },

  $reset() {
    state.nodeData.clear()
    state.similarities.clear()
    state.insights = []
    state.aiState = { ...DEFAULT_AI_STATE }
    state.fieldSettings = { ...DEFAULT_FIELD_SETTINGS }
    state.dirtyNodeIds.clear()
    state.currentMapId = null
    state.clusters = []
    state.fieldInteraction = { ...DEFAULT_FIELD_INTERACTION }
    state.processorState = 'idle'
    state.embeddingQueueSize = 0
  }
}

// Composable for using the store
export function useSemanticStore(): SemanticStore {
  return reactive({
    // State properties (reactive getters)
    get nodeData() { return state.nodeData },
    get similarities() { return state.similarities },
    get insights() { return state.insights },
    get aiState() { return state.aiState },
    get fieldSettings() { return state.fieldSettings },
    get dirtyNodeIds() { return state.dirtyNodeIds },
    get currentMapId() { return state.currentMapId },
    get clusters() { return state.clusters },
    get fieldInteraction() { return state.fieldInteraction },
    get processorState() { return state.processorState },
    get embeddingQueueSize() { return state.embeddingQueueSize },

    // Computed getters
    get isAIReady() {
      return state.aiState.modelLoaded && state.aiState.status !== 'error'
    },

    get isAIBusy() {
      return state.aiState.status === 'loading-model' || state.aiState.status === 'computing'
    },

    get nodesWithEmbeddings() {
      return Array.from(state.nodeData.values()).filter(d => d.embedding && d.embedding.length > 0)
    },

    get dirtyNodeCount() {
      return state.dirtyNodeIds.size
    },

    get shouldRenderField() {
      return state.fieldSettings.enabled && state.similarities.size > 0
    },

    get visibleSimilarityPairs() {
      const pairs: Array<{ sourceId: string; targetId: string; similarity: number }> = []
      const threshold = state.fieldSettings.similarityThreshold

      for (const [sourceId, entries] of state.similarities) {
        for (const entry of entries) {
          // Only include each pair once (source < target)
          if (sourceId < entry.nodeId && entry.similarity >= threshold) {
            pairs.push({
              sourceId,
              targetId: entry.nodeId,
              similarity: entry.similarity
            })
          }
        }
      }

      return pairs
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, state.fieldSettings.maxFieldLines)
    },

    get clusterCount() {
      return state.clusters.length
    },

    get embeddedNodeCount() {
      return Array.from(state.nodeData.values()).filter(d => d.embedding && d.embedding.length > 0).length
    },

    clusterForNode(nodeId: string): SemanticCluster | undefined {
      return state.clusters.find(c => c.nodeIds.includes(nodeId))
    },

    // Actions
    ...actions
  }) as unknown as SemanticStore
}

// Export for direct access if needed
export { state as semanticState, actions as semanticActions }
