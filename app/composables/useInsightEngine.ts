import type { Node, Edge, Point } from '~/types/canvas'
import type { Insight, InsightType, EnrichedInsight, SimilarityEntry } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'
import { generateInsights } from '~/ai/engine/InsightEngineV2'

// ═══════════════ CONFIDENCE CALIBRATION ═══════════════

const TYPE_RELIABILITY: Partial<Record<InsightType, number>> = {
  'hub-node': 0.95,
  'outlier': 0.9,
  'bridge': 0.8,
  'dead-end': 0.85,
  'cluster': 0.75,
  'gap': 0.6,
  'imbalanced-cluster': 0.7,
  'orphan-cluster': 0.65,
  'chain-risk': 0.5,
  'conceptual-gap': 0.5,
  'structural-suggestion': 0.5,
  'balance-issue': 0.5,
  'deepening-opportunity': 0.4,
  'accuracy-concern': 0.4
}

function calibrateConfidence(rawConfidence: number, insightType: InsightType): number {
  const weight = TYPE_RELIABILITY[insightType] ?? 0.5
  return Math.min(rawConfidence * weight, 1)
}

/**
 * Insight Engine composable
 *
 * Discovers emergent insights from semantic data:
 * - Bridge concepts: Nodes that could connect distant clusters
 * - Gap detection: Missing concepts within clusters
 * - Outliers: Nodes with low similarity to everything
 * - Cluster analysis: Groups of highly related nodes
 *
 * v3: Topology-aware insights (hub nodes, dead-ends, chain risk,
 *     cluster imbalance, orphan clusters) + temporal patterns +
 *     confidence calibration.
 */
// Minimum interval between full analyses to prevent rapid re-invocations
const MIN_ANALYSIS_INTERVAL_MS = 5000

export function useInsightEngine() {
  const semanticStore = useSemanticStore()

  // Analysis state
  const isAnalyzing = ref(false)
  const lastAnalysisTime = ref<number | null>(null)
  let pendingAnalysis: ReturnType<typeof setTimeout> | null = null

  /**
   * Find bridge nodes - nodes that connect otherwise distant clusters
   */
  function findBridges(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>
  ): Insight[] {
    const insights: Insight[] = []
    const nodesWithEmbeddings = semanticStore.nodesWithEmbeddings

    if (nodesWithEmbeddings.length < 4) return insights

    // Find nodes that have moderate similarity to multiple distinct groups
    for (const nodeData of nodesWithEmbeddings) {
      const node = nodes.get(nodeData.nodeId)
      if (!node) continue

      const similarities = semanticStore.getTopSimilar(nodeData.nodeId, 10)
      if (similarities.length < 2) continue

      // Check if this node connects two clusters
      // A bridge node has moderate similarity (0.3-0.6) to multiple nodes
      // that themselves have low similarity to each other
      const moderateSims = similarities.filter((s: SimilarityEntry) => s.similarity >= 0.3 && s.similarity <= 0.7)

      if (moderateSims.length >= 2) {
        // Check if the nodes this connects are dissimilar to each other
        let foundDisconnect = false
        for (let i = 0; i < moderateSims.length && !foundDisconnect; i++) {
          for (let j = i + 1; j < moderateSims.length; j++) {
            const simI = moderateSims[i]
            const simJ = moderateSims[j]
            if (!simI || !simJ) continue

            const crossSim = semanticStore.getSimilarity(simI.nodeId, simJ.nodeId)
            if (crossSim !== null && crossSim < 0.3) {
              foundDisconnect = true

              // Check if there's already an edge between these clusters
              const hasEdge = Array.from(edges.values()).some(
                e => (e.sourceId === simI.nodeId && e.targetId === simJ.nodeId) ||
                     (e.sourceId === simJ.nodeId && e.targetId === simI.nodeId)
              )

              if (!hasEdge) {
                const node1 = nodes.get(simI.nodeId)
                const node2 = nodes.get(simJ.nodeId)

                if (node1 && node2) {
                  const rawConfidence = (simI.similarity + simJ.similarity) / 2
                  insights.push({
                    id: `bridge-${nodeData.nodeId}`,
                    type: 'bridge',
                    title: `Potential Bridge: ${node.content.slice(0, 30)}`,
                    description: `"${node.content}" could bridge "${node1.content.slice(0, 20)}" and "${node2.content.slice(0, 20)}" which appear to be in separate clusters.`,
                    confidence: calibrateConfidence(rawConfidence, 'bridge'),
                    relatedNodeIds: [nodeData.nodeId, simI.nodeId, simJ.nodeId],
                    suggestedConnections: [
                      { sourceId: nodeData.nodeId, targetId: simI.nodeId },
                      { sourceId: nodeData.nodeId, targetId: simJ.nodeId }
                    ],
                    createdAt: Date.now()
                  })
                }
              }
              break
            }
          }
        }
      }
    }

    return insights.slice(0, 3) // Limit to top 3 bridges
  }

  /**
   * Find gaps - potential missing concepts within a cluster
   */
  function findGaps(
    nodes: Map<string, Node>,
    threshold: number = 0.6
  ): Insight[] {
    const insights: Insight[] = []
    const nodesWithEmbeddings = semanticStore.nodesWithEmbeddings

    if (nodesWithEmbeddings.length < 3) return insights

    // Find clusters of highly similar nodes
    const clusters: Set<string>[] = []
    const visited = new Set<string>()

    for (const nodeData of nodesWithEmbeddings) {
      if (visited.has(nodeData.nodeId)) continue

      const cluster = new Set<string>([nodeData.nodeId])
      const queue = [nodeData.nodeId]
      visited.add(nodeData.nodeId)

      while (queue.length > 0) {
        const currentId = queue.shift()!
        const similarities = semanticStore.getTopSimilar(currentId, 5)

        for (const sim of similarities) {
          if (sim.similarity >= threshold && !visited.has(sim.nodeId)) {
            cluster.add(sim.nodeId)
            queue.push(sim.nodeId)
            visited.add(sim.nodeId)
          }
        }
      }

      if (cluster.size >= 2) {
        clusters.push(cluster)
      }
    }

    // For each cluster, suggest a gap concept
    for (const cluster of clusters) {
      if (cluster.size < 2) continue

      const clusterNodes = Array.from(cluster)
        .map(id => nodes.get(id))
        .filter((n): n is Node => n !== undefined)

      if (clusterNodes.length < 2) continue

      // Find common themes in cluster (simple keyword extraction)
      const words = clusterNodes
        .flatMap(n => n.content.toLowerCase().split(/\s+/))
        .filter(w => w.length > 3)

      const wordCount = new Map<string, number>()
      for (const word of words) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }

      const commonWords = Array.from(wordCount.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word)

      if (commonWords.length > 0) {
        // Calculate centroid position for suggested node placement
        const centroid: Point = {
          x: clusterNodes.reduce((sum, n) => sum + n.position.x, 0) / clusterNodes.length,
          y: clusterNodes.reduce((sum, n) => sum + n.position.y, 0) / clusterNodes.length
        }

        // Offset position slightly
        const suggestedPosition: Point = {
          x: centroid.x + 100 + Math.random() * 50,
          y: centroid.y + Math.random() * 100 - 50
        }

        insights.push({
          id: `gap-${Array.from(cluster)[0]}`,
          type: 'gap',
          title: `Missing Concept?`,
          description: `This cluster about "${commonWords.join(', ')}" might benefit from exploring: "${commonWords[0]} considerations" or "${commonWords[0]} alternatives"`,
          confidence: calibrateConfidence(0.6, 'gap'),
          relatedNodeIds: Array.from(cluster).slice(0, 3),
          suggestedPosition,
          suggestedContent: `${commonWords[0]} ${['considerations', 'implications', 'alternatives', 'examples'][Math.floor(Math.random() * 4)]}`,
          createdAt: Date.now()
        })
      }
    }

    return insights.slice(0, 2) // Limit to top 2 gaps
  }

  /**
   * Find outliers - nodes with low similarity to everything
   */
  function findOutliers(
    nodes: Map<string, Node>,
    threshold: number = 0.3
  ): Insight[] {
    const insights: Insight[] = []
    const nodesWithEmbeddings = semanticStore.nodesWithEmbeddings

    if (nodesWithEmbeddings.length < 3) return insights

    for (const nodeData of nodesWithEmbeddings) {
      const node = nodes.get(nodeData.nodeId)
      if (!node) continue

      const similarities = semanticStore.getTopSimilar(nodeData.nodeId, 5)

      // Check if all similarities are below threshold
      const maxSimilarity = similarities.length > 0
        ? Math.max(...similarities.map((s: { similarity: number }) => s.similarity))
        : 0

      if (maxSimilarity < threshold) {
        // This is an outlier
        insights.push({
          id: `outlier-${nodeData.nodeId}`,
          type: 'outlier',
          title: `Outlier: ${node.content.slice(0, 25)}`,
          description: `"${node.content}" seems disconnected from other concepts. Consider adding related ideas or connecting it to existing nodes.`,
          confidence: calibrateConfidence(1 - maxSimilarity, 'outlier'),
          relatedNodeIds: [nodeData.nodeId],
          createdAt: Date.now()
        })
      }
    }

    return insights.slice(0, 3) // Limit to top 3 outliers
  }

  // ═══════════════ TOPOLOGY ANALYSIS (v3) ═══════════════

  /**
   * Analyze map topology for structural insights.
   */
  function analyzeTopology(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>
  ): Insight[] {
    const insights: Insight[] = []
    if (nodes.size < 3) return insights

    // Build adjacency from edges
    const adjacency = new Map<string, Set<string>>()
    for (const edge of edges.values()) {
      if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, new Set())
      if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, new Set())
      adjacency.get(edge.sourceId)!.add(edge.targetId)
      adjacency.get(edge.targetId)!.add(edge.sourceId)
    }

    // ── Hub node detection: nodes with 5+ connections ──
    for (const [nodeId, neighbors] of adjacency) {
      if (neighbors.size >= 5) {
        const node = nodes.get(nodeId)
        if (!node) continue
        insights.push({
          id: `hub-${nodeId}`,
          type: 'hub-node',
          title: `Hub Node: ${node.content.slice(0, 25)}`,
          description: `"${node.content}" has ${neighbors.size} connections. Consider breaking it into sub-topics for better organization.`,
          confidence: calibrateConfidence(Math.min(neighbors.size / 8, 1), 'hub-node'),
          relatedNodeIds: [nodeId, ...Array.from(neighbors).slice(0, 3)],
          createdAt: Date.now()
        })
      }
    }

    // ── Dead-end detection: leaf nodes with no semantic neighbors ──
    for (const [nodeId, node] of nodes) {
      const edgeNeighbors = adjacency.get(nodeId)
      const edgeCount = edgeNeighbors?.size ?? 0

      if (edgeCount <= 1) {
        // Leaf node — check semantic neighbors
        const semanticSims = semanticStore.getTopSimilar(nodeId, 3)
        const hasSemanticNeighbor = semanticSims.some(s => s.similarity >= 0.4)

        if (!hasSemanticNeighbor && semanticStore.nodeData.has(nodeId)) {
          insights.push({
            id: `dead-end-${nodeId}`,
            type: 'dead-end',
            title: `Dead End: ${node.content.slice(0, 25)}`,
            description: `"${node.content}" has no strong connections or semantic neighbors. Consider connecting it to related concepts.`,
            confidence: calibrateConfidence(0.8, 'dead-end'),
            relatedNodeIds: [nodeId],
            createdAt: Date.now()
          })
        }
      }
    }

    // ── Chain risk: linear chains of 4+ nodes ──
    const visited = new Set<string>()
    for (const [startId] of adjacency) {
      if (visited.has(startId)) continue
      if ((adjacency.get(startId)?.size ?? 0) !== 1) continue

      // Follow chain
      const chain: string[] = [startId]
      visited.add(startId)
      let current = startId

      while (true) {
        const neighbors = adjacency.get(current)
        if (!neighbors) break
        const next = Array.from(neighbors).find(n => !visited.has(n))
        if (!next) break
        const nextNeighbors = adjacency.get(next)
        if (!nextNeighbors || nextNeighbors.size > 2) {
          chain.push(next)
          visited.add(next)
          break
        }
        chain.push(next)
        visited.add(next)
        current = next
      }

      if (chain.length >= 4) {
        const startNode = nodes.get(chain[0]!)
        const endNode = nodes.get(chain[chain.length - 1]!)
        if (startNode && endNode) {
          insights.push({
            id: `chain-${chain[0]}`,
            type: 'chain-risk',
            title: `Long Chain Detected`,
            description: `A linear chain of ${chain.length} nodes from "${startNode.content.slice(0, 20)}" to "${endNode.content.slice(0, 20)}". Consider adding cross-links for resilience.`,
            confidence: calibrateConfidence(Math.min(chain.length / 6, 1), 'chain-risk'),
            relatedNodeIds: chain.slice(0, 5),
            suggestedConnections: chain.length >= 4 ? [
              { sourceId: chain[0]!, targetId: chain[Math.floor(chain.length / 2)]! }
            ] : undefined,
            createdAt: Date.now()
          })
        }
      }
    }

    // ── Cluster imbalance: largest cluster >3x second largest ──
    const clusters = semanticStore.clusters
    if (clusters.length >= 2) {
      const sorted = [...clusters].sort((a, b) => b.nodeIds.length - a.nodeIds.length)
      const largest = sorted[0]!
      const secondLargest = sorted[1]!

      if (largest.nodeIds.length > secondLargest.nodeIds.length * 3) {
        insights.push({
          id: `imbalanced-${largest.id}`,
          type: 'imbalanced-cluster',
          title: `Imbalanced Cluster`,
          description: `One cluster has ${largest.nodeIds.length} nodes while others have ${secondLargest.nodeIds.length} or fewer. Consider breaking the large cluster into sub-topics.`,
          confidence: calibrateConfidence(0.7, 'imbalanced-cluster'),
          relatedNodeIds: largest.nodeIds.slice(0, 3),
          createdAt: Date.now()
        })
      }
    }

    // ── Orphan cluster: cluster with no cross-cluster similarity pairs ──
    for (const cluster of clusters) {
      let hasCrossCluster = false
      for (const nodeId of cluster.nodeIds) {
        const sims = semanticStore.getTopSimilar(nodeId, 10)
        for (const sim of sims) {
          if (!cluster.nodeIds.includes(sim.nodeId) && sim.similarity >= 0.3) {
            hasCrossCluster = true
            break
          }
        }
        if (hasCrossCluster) break
      }

      if (!hasCrossCluster && cluster.nodeIds.length >= 3) {
        const firstNode = nodes.get(cluster.nodeIds[0]!)
        insights.push({
          id: `orphan-${cluster.id}`,
          type: 'orphan-cluster',
          title: `Isolated Cluster`,
          description: `A cluster of ${cluster.nodeIds.length} nodes around "${firstNode?.content.slice(0, 20) ?? '...'}" has no connections to other groups. Consider how it relates to the rest of the map.`,
          confidence: calibrateConfidence(0.65, 'orphan-cluster'),
          relatedNodeIds: cluster.nodeIds.slice(0, 3),
          createdAt: Date.now()
        })
      }
    }

    return insights.slice(0, 5)
  }

  // ═══════════════ TEMPORAL PATTERNS (v3) ═══════════════

  /**
   * Analyze temporal patterns in node creation and editing.
   */
  function analyzeTemporalPatterns(
    nodes: Map<string, Node>
  ): Insight[] {
    const insights: Insight[] = []
    const now = Date.now()
    const ONE_HOUR = 60 * 60 * 1000
    const ONE_DAY = 24 * ONE_HOUR

    // ── Recent burst: 10+ nodes created in last hour within 500px spread ──
    const recentNodes: Node[] = []
    for (const node of nodes.values()) {
      const createdAt = node.metadata?.createdAt as number | undefined
      if (createdAt && now - createdAt < ONE_HOUR) {
        recentNodes.push(node)
      }
    }

    if (recentNodes.length >= 10) {
      // Check spatial spread
      const xs = recentNodes.map(n => n.position.x)
      const ys = recentNodes.map(n => n.position.y)
      const spreadX = Math.max(...xs) - Math.min(...xs)
      const spreadY = Math.max(...ys) - Math.min(...ys)
      const spread = Math.sqrt(spreadX * spreadX + spreadY * spreadY)

      if (spread < 500) {
        insights.push({
          id: `burst-${now}`,
          type: 'cluster',
          title: `Active Brainstorm Detected`,
          description: `${recentNodes.length} nodes created in the last hour in a concentrated area. Great momentum! Consider organizing and connecting them.`,
          confidence: calibrateConfidence(0.8, 'cluster'),
          relatedNodeIds: recentNodes.slice(0, 5).map(n => n.id),
          createdAt: now
        })
      }
    }

    // ── Stale area: >30% of nodes untouched in 24h ──
    if (nodes.size >= 5) {
      let staleCount = 0
      const staleNodeIds: string[] = []
      for (const node of nodes.values()) {
        const updatedAt = node.metadata?.updatedAt as number | undefined
        const createdAt = node.metadata?.createdAt as number | undefined
        const lastTouch = updatedAt ?? createdAt ?? 0
        if (lastTouch > 0 && now - lastTouch > ONE_DAY) {
          staleCount++
          if (staleNodeIds.length < 3) staleNodeIds.push(node.id)
        }
      }

      const staleRatio = staleCount / nodes.size
      if (staleRatio > 0.3 && staleCount >= 3) {
        insights.push({
          id: `stale-${now}`,
          type: 'balance-issue',
          title: `Stale Area`,
          description: `${Math.round(staleRatio * 100)}% of nodes (${staleCount}) haven't been updated in over 24 hours. Consider revisiting and expanding on these concepts.`,
          confidence: calibrateConfidence(0.5, 'balance-issue'),
          relatedNodeIds: staleNodeIds,
          createdAt: now
        })
      }
    }

    return insights
  }

  /**
   * Run full analysis and return top insights (v3).
   * Debounced: if called again within MIN_ANALYSIS_INTERVAL_MS of the last
   * completed analysis, the call is deferred.
   */
  async function analyzeMap(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    maxInsights: number = 10
  ): Promise<Insight[]> {
    // Debounce guard: skip if analysis ran very recently
    if (lastAnalysisTime.value !== null) {
      const elapsed = Date.now() - lastAnalysisTime.value
      if (elapsed < MIN_ANALYSIS_INTERVAL_MS) {
        // Return current insights from store instead of re-running
        return semanticStore.insights as Insight[]
      }
    }

    // Cancel any pending deferred analysis
    if (pendingAnalysis) {
      clearTimeout(pendingAnalysis)
      pendingAnalysis = null
    }

    isAnalyzing.value = true

    try {
      // Clear existing insights
      semanticStore.clearInsights()

      // Run all analysis algorithms
      const bridges = findBridges(nodes, edges)
      const gaps = findGaps(nodes)
      const outliers = findOutliers(nodes)
      const topology = analyzeTopology(nodes, edges)
      const temporal = analyzeTemporalPatterns(nodes)

      // Combine, calibrate, and sort by confidence
      const allInsights = [...bridges, ...gaps, ...outliers, ...topology, ...temporal]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxInsights)

      // Add to store
      for (const insight of allInsights) {
        semanticStore.addInsight(insight)
      }

      lastAnalysisTime.value = Date.now()
      return allInsights
    } finally {
      isAnalyzing.value = false
    }
  }

  /**
   * Analyze map with LLM-powered insights (v2).
   * Runs heuristic analysis first, then enriches with LLM if provider available.
   * Merges and deduplicates results.
   */
  async function analyzeMapWithAI(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    mapTitle?: string,
    maxInsights: number = 10
  ): Promise<(Insight | EnrichedInsight)[]> {
    isAnalyzing.value = true

    try {
      // Step 1: Run existing heuristic analysis (now includes topology + temporal)
      const heuristicInsights = await analyzeMap(nodes, edges, maxInsights)

      // Step 2: Try LLM-powered analysis
      let llmInsights: EnrichedInsight[] = []
      try {
        llmInsights = await generateInsights(nodes, edges, mapTitle)
      } catch {
        // LLM not available — heuristic results are sufficient
      }

      if (llmInsights.length === 0) {
        return heuristicInsights
      }

      // Step 3: Merge and deduplicate
      const merged: (Insight | EnrichedInsight)[] = [...heuristicInsights]
      const existingTitles = new Set(heuristicInsights.map(i => i.title.toLowerCase()))

      for (const llmInsight of llmInsights) {
        // Skip if similar title already exists
        if (!existingTitles.has(llmInsight.title.toLowerCase())) {
          merged.push(llmInsight)
          semanticStore.addInsight(llmInsight)
        }
      }

      // Sort by confidence and limit
      return merged
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxInsights)
    } finally {
      isAnalyzing.value = false
    }
  }

  /**
   * Get insights for a specific node
   */
  function getInsightsForNode(nodeId: string): Insight[] {
    return semanticStore.insights.filter(
      (insight: Insight) => insight.relatedNodeIds.includes(nodeId)
    )
  }

  /**
   * Get insights by type
   */
  function getInsightsByType(type: InsightType): Insight[] {
    return semanticStore.insights.filter((insight: Insight) => insight.type === type)
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    lastAnalysisTime: readonly(lastAnalysisTime),

    // Methods
    analyzeMap,
    analyzeMapWithAI,
    findBridges,
    findGaps,
    findOutliers,
    analyzeTopology,
    analyzeTemporalPatterns,
    getInsightsForNode,
    getInsightsByType
  }
}
