// Spatial clustering for minimap region labels
// Groups nearby nodes into clusters using distance-based approach (DBSCAN-like)

import type { Node, MapRegion } from '~/types/canvas'

const CLUSTER_DISTANCE = 300 // Max distance to consider nodes as neighbors

export function useMapRegions() {
  const regions = ref<MapRegion[]>([])

  let recomputeTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Schedule recomputation (debounced 500ms)
   */
  function scheduleRecompute(nodes: Map<string, Node>) {
    if (recomputeTimeout) clearTimeout(recomputeTimeout)
    recomputeTimeout = setTimeout(() => {
      regions.value = computeRegions(nodes)
    }, 500)
  }

  /**
   * Compute regions from node positions
   */
  function computeRegions(nodes: Map<string, Node>): MapRegion[] {
    if (nodes.size === 0) return []

    const nodeArray = Array.from(nodes.values())
    const visited = new Set<string>()
    const clusters: Node[][] = []

    for (const node of nodeArray) {
      if (visited.has(node.id)) continue

      // BFS to find cluster
      const cluster: Node[] = []
      const queue: Node[] = [node]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current.id)) continue
        visited.add(current.id)
        cluster.push(current)

        // Find neighbors
        for (const other of nodeArray) {
          if (visited.has(other.id)) continue
          const dx = (current.position.x + current.size.width / 2) - (other.position.x + other.size.width / 2)
          const dy = (current.position.y + current.size.height / 2) - (other.position.y + other.size.height / 2)
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CLUSTER_DISTANCE) {
            queue.push(other)
          }
        }
      }

      if (cluster.length >= 2) {
        clusters.push(cluster)
      }
    }

    // Convert clusters to regions
    return clusters.map((cluster, index) => {
      let sumX = 0, sumY = 0

      for (const node of cluster) {
        sumX += node.position.x + node.size.width / 2
        sumY += node.position.y + node.size.height / 2
      }

      const centerX = sumX / cluster.length
      const centerY = sumY / cluster.length

      // Generate label from root/parent or most common word
      const label = generateClusterLabel(cluster)

      // Get color from first node with a custom border color
      const colorNode = cluster.find(n => n.style.borderColor && n.style.borderColor !== '#3A3A42')
      const color = colorNode?.style.borderColor

      return {
        id: `region-${index}`,
        label,
        centerX,
        centerY,
        nodeIds: cluster.map(n => n.id),
        color
      }
    })
  }

  /**
   * Generate a label for a cluster based on node content
   */
  function generateClusterLabel(nodes: Node[]): string {
    // Prefer root node content
    const root = nodes.find(n => n.isRoot)
    if (root) return truncateLabel(root.content)

    // Use most frequent meaningful word
    const wordCounts = new Map<string, number>()
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'new', 'node'])

    for (const node of nodes) {
      const words = node.content.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (word.length > 2 && !stopWords.has(word)) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
        }
      }
    }

    // Find most common word
    let bestWord = ''
    let bestCount = 0
    for (const [word, count] of wordCounts) {
      if (count > bestCount) {
        bestWord = word
        bestCount = count
      }
    }

    if (bestWord) {
      return bestWord.charAt(0).toUpperCase() + bestWord.slice(1)
    }

    // Fallback: first node content
    return truncateLabel(nodes[0]?.content || 'Region')
  }

  function truncateLabel(text: string): string {
    if (text.length <= 20) return text
    return text.slice(0, 17) + '...'
  }

  function cleanup() {
    if (recomputeTimeout) clearTimeout(recomputeTimeout)
  }

  return {
    regions: regions as Ref<MapRegion[]>,
    scheduleRecompute,
    computeRegions,
    cleanup
  }
}
