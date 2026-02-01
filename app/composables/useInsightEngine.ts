import type { Node, Edge, Point } from '~/types/canvas'
import type { Insight, InsightType, SimilarityEntry } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'

/**
 * Insight Engine composable
 *
 * Discovers emergent insights from semantic data:
 * - Bridge concepts: Nodes that could connect distant clusters
 * - Gap detection: Missing concepts within clusters
 * - Outliers: Nodes with low similarity to everything
 * - Cluster analysis: Groups of highly related nodes
 */
export function useInsightEngine() {
  const semanticStore = useSemanticStore()

  // Analysis state
  const isAnalyzing = ref(false)
  const lastAnalysisTime = ref<number | null>(null)

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
                  insights.push({
                    id: `bridge-${nodeData.nodeId}`,
                    type: 'bridge',
                    title: `Potential Bridge: ${node.content.slice(0, 30)}`,
                    description: `"${node.content}" could bridge "${node1.content.slice(0, 20)}" and "${node2.content.slice(0, 20)}" which appear to be in separate clusters.`,
                    confidence: (simI.similarity + simJ.similarity) / 2,
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
          confidence: 0.6,
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
          confidence: 1 - maxSimilarity,
          relatedNodeIds: [nodeData.nodeId],
          createdAt: Date.now()
        })
      }
    }

    return insights.slice(0, 3) // Limit to top 3 outliers
  }

  /**
   * Run full analysis and return top insights
   */
  async function analyzeMap(
    nodes: Map<string, Node>,
    edges: Map<string, Edge>,
    maxInsights: number = 10
  ): Promise<Insight[]> {
    isAnalyzing.value = true

    try {
      // Clear existing insights
      semanticStore.clearInsights()

      // Run all analysis algorithms
      const bridges = findBridges(nodes, edges)
      const gaps = findGaps(nodes)
      const outliers = findOutliers(nodes)

      // Combine and sort by confidence
      const allInsights = [...bridges, ...gaps, ...outliers]
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
    findBridges,
    findGaps,
    findOutliers,
    getInsightsForNode,
    getInsightsByType
  }
}
