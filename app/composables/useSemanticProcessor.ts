import type { ProcessorState } from '~/types/semantic'
import { fnv1aHash } from '~/types/semantic'
import { useSemanticStore } from '~/stores/semanticStore'
import { useMapStore } from '~/stores/mapStore'

// ═══════════════ PRIORITY QUEUE ═══════════════

type EmbeddingPriority = 'immediate' | 'high' | 'normal' | 'low'

interface QueueItem {
  nodeId: string
  priority: EmbeddingPriority
  addedAt: number
}

const PRIORITY_ORDER: Record<EmbeddingPriority, number> = {
  immediate: 0,
  high: 1,
  normal: 2,
  low: 3
}

const DEBOUNCE_MS: Record<EmbeddingPriority, number> = {
  immediate: 0,
  high: 1500,
  normal: 300,
  low: 60000
}

class EmbeddingQueue {
  private items = new Map<string, QueueItem>()

  enqueue(nodeId: string, priority: EmbeddingPriority) {
    const existing = this.items.get(nodeId)
    // Only upgrade priority, never downgrade
    if (existing && PRIORITY_ORDER[existing.priority] <= PRIORITY_ORDER[priority]) {
      return
    }
    this.items.set(nodeId, { nodeId, priority, addedAt: Date.now() })
  }

  dequeueAll(): QueueItem[] {
    const items = Array.from(this.items.values())
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    this.items.clear()
    return items
  }

  get size() { return this.items.size }

  has(nodeId: string) { return this.items.has(nodeId) }

  clear() { this.items.clear() }
}

// ═══════════════ PROCESSOR ═══════════════

/**
 * Semantic Processor composable.
 * Central orchestrator for embedding, similarity, and clustering pipeline.
 *
 * Watches for node changes, manages a priority queue, and drives the
 * embed → similarity → cluster pipeline automatically.
 */
export function useSemanticProcessor() {
  const semanticStore = useSemanticStore()
  const mapStore = useMapStore()

  const queue = new EmbeddingQueue()
  const processorState = ref<ProcessorState>('idle')
  const queueSize = computed(() => queue.size)
  const isRunning = ref(false)

  // Timers
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let clusterTimer: ReturnType<typeof setTimeout> | null = null
  let periodicTimer: ReturnType<typeof setInterval> | null = null
  let changeDetectionTimer: ReturnType<typeof setTimeout> | null = null
  const CHANGE_DETECTION_DEBOUNCE_MS = 150

  // Track content hashes for change detection
  const nodeHashes = new Map<string, number>()

  // Reference to the sendMessage function — set by the caller
  let _sendMessage: (<T>(type: string, payload: unknown, onProgress?: (progress: unknown) => void) => Promise<T>) | null = null

  function setSendMessage(fn: <T>(type: string, payload: unknown, onProgress?: (progress: unknown) => void) => Promise<T>) {
    _sendMessage = fn
  }

  // ── Queue management ──

  function enqueueNode(nodeId: string, priority: EmbeddingPriority = 'normal') {
    queue.enqueue(nodeId, priority)
    semanticStore.setEmbeddingQueueSize(queue.size)
    scheduleFlush(priority)
  }

  function enqueueNodes(nodeIds: string[], priority: EmbeddingPriority = 'normal') {
    for (const id of nodeIds) {
      queue.enqueue(id, priority)
    }
    semanticStore.setEmbeddingQueueSize(queue.size)
    scheduleFlush(priority)
  }

  function scheduleFlush(priority: EmbeddingPriority) {
    if (flushTimer) clearTimeout(flushTimer)
    const delay = DEBOUNCE_MS[priority]
    if (delay === 0) {
      flush()
    } else {
      flushTimer = setTimeout(flush, delay)
    }
  }

  // ── Pipeline ──

  async function flush() {
    if (!_sendMessage || queue.size === 0) return

    const items = queue.dequeueAll()
    semanticStore.setEmbeddingQueueSize(0)

    // Build texts to embed
    const nodesToEmbed: Array<{ id: string; text: string; contentHash: number }> = []
    const changedNodeIds: string[] = []

    for (const item of items) {
      const node = mapStore.nodes.get(item.nodeId)
      if (!node || !node.content.trim()) continue

      const hash = fnv1aHash(node.content)
      const existing = semanticStore.nodeData.get(item.nodeId)

      // Skip if content hash matches (already embedded with same content)
      if (existing && existing.contentHash === hash) continue

      nodeHashes.set(item.nodeId, hash)
      changedNodeIds.push(item.nodeId)
      nodesToEmbed.push({ id: item.nodeId, text: node.content, contentHash: hash })
    }

    if (nodesToEmbed.length === 0) return

    try {
      // ── Step 1: Embedding ──
      processorState.value = 'embedding'
      semanticStore.setProcessorState('embedding')

      const batchSize = semanticStore.fieldSettings.embeddingBatchSize
      const result = await _sendMessage<{
        embeddings: Array<{ id: string; embedding: number[] }>
        dimensions: number
      }>('embed-batch', {
        texts: nodesToEmbed,
        batchSize
      })

      // Update store
      for (const { id, embedding } of result.embeddings) {
        const hash = nodeHashes.get(id) ?? 0
        semanticStore.setNodeEmbedding(id, embedding, 1, hash)
      }

      // ── Step 2: Incremental similarity ──
      processorState.value = 'similarity'
      semanticStore.setProcessorState('similarity')

      const allEmbeddings = semanticStore.nodesWithEmbeddings.map(n => ({
        id: n.nodeId,
        embedding: n.embedding
      }))

      if (allEmbeddings.length >= 2) {
        // Get current similarities as flat array
        const currentSimilarities: Array<{ sourceId: string; targetId: string; similarity: number }> = []
        for (const [sourceId, entries] of semanticStore.similarities) {
          for (const entry of entries) {
            if (sourceId < entry.nodeId) {
              currentSimilarities.push({
                sourceId,
                targetId: entry.nodeId,
                similarity: entry.similarity
              })
            }
          }
        }

        const simResult = await _sendMessage<{
          similarities: Array<{ sourceId: string; targetId: string; similarity: number }>
        }>('update-similarities', {
          changedNodeIds,
          embeddings: allEmbeddings,
          currentSimilarities,
          threshold: semanticStore.fieldSettings.similarityThreshold
        })

        semanticStore.updateSimilaritiesIncremental(simResult.similarities)
      }

      // ── Step 3: Schedule cluster detection (debounced) ──
      scheduleClusterDetection()

    } catch (e) {
      console.error('[SemanticProcessor] Pipeline error:', e)
    } finally {
      processorState.value = 'idle'
      semanticStore.setProcessorState('idle')
    }
  }

  function scheduleClusterDetection() {
    if (clusterTimer) clearTimeout(clusterTimer)
    clusterTimer = setTimeout(detectClusters, 5000)
  }

  async function detectClusters() {
    if (!_sendMessage) return

    const allEmbeddings = semanticStore.nodesWithEmbeddings.map(n => ({
      id: n.nodeId,
      embedding: n.embedding
    }))

    if (allEmbeddings.length < 3) {
      semanticStore.setClusters([])
      return
    }

    try {
      processorState.value = 'clustering'
      semanticStore.setProcessorState('clustering')

      // Flatten current similarities
      const similarities: Array<{ sourceId: string; targetId: string; similarity: number }> = []
      for (const [sourceId, entries] of semanticStore.similarities) {
        for (const entry of entries) {
          if (sourceId < entry.nodeId) {
            similarities.push({ sourceId, targetId: entry.nodeId, similarity: entry.similarity })
          }
        }
      }

      const result = await _sendMessage<{
        clusters: Array<{
          id: string
          nodeIds: string[]
          centroid: { x: number; y: number }
          radius: number
          averageSimilarity: number
          dominantCategory: string | null
          keywords: string[]
        }>
      }>('detect-clusters', {
        embeddings: allEmbeddings,
        similarities,
        minClusterSize: 3,
        minSimilarity: 0.5
      })

      // Enrich clusters with position data from nodes
      const enrichedClusters = result.clusters.map(cluster => {
        let sumX = 0, sumY = 0, count = 0
        let maxDist = 0

        for (const nodeId of cluster.nodeIds) {
          const node = mapStore.nodes.get(nodeId)
          if (node) {
            const cx = node.position.x + node.size.width / 2
            const cy = node.position.y + node.size.height / 2
            sumX += cx
            sumY += cy
            count++
          }
        }

        const centroid = count > 0
          ? { x: sumX / count, y: sumY / count }
          : { x: 0, y: 0 }

        // Compute radius
        for (const nodeId of cluster.nodeIds) {
          const node = mapStore.nodes.get(nodeId)
          if (node) {
            const cx = node.position.x + node.size.width / 2
            const cy = node.position.y + node.size.height / 2
            const dist = Math.sqrt((cx - centroid.x) ** 2 + (cy - centroid.y) ** 2)
            if (dist > maxDist) maxDist = dist
          }
        }

        // Detect dominant category
        const categories = new Map<string, number>()
        for (const nodeId of cluster.nodeIds) {
          const node = mapStore.nodes.get(nodeId)
          const cat = node?.metadata?.category as string | undefined
          if (cat) {
            categories.set(cat, (categories.get(cat) ?? 0) + 1)
          }
        }
        let dominantCategory: string | null = null
        let maxCatCount = 0
        for (const [cat, cnt] of categories) {
          if (cnt > maxCatCount) {
            maxCatCount = cnt
            dominantCategory = cat
          }
        }

        return {
          ...cluster,
          centroid,
          radius: maxDist + 60,
          dominantCategory
        }
      })

      semanticStore.setClusters(enrichedClusters)
    } catch (e) {
      console.error('[SemanticProcessor] Cluster detection error:', e)
    } finally {
      processorState.value = 'idle'
      semanticStore.setProcessorState('idle')
    }
  }

  // ── Change detection via nodesVersion watcher ──

  let watchStop: (() => void) | null = null

  function startProcessor() {
    if (isRunning.value) return
    isRunning.value = true

    // Watch for node changes via mapStore.nodesVersion (debounced)
    watchStop = watch(
      () => mapStore.nodesVersion,
      () => {
        if (changeDetectionTimer) clearTimeout(changeDetectionTimer)
        changeDetectionTimer = setTimeout(detectChangedNodes, CHANGE_DETECTION_DEBOUNCE_MS)
      }
    )

    // Periodic refresh (every 60s for low-priority re-embedding)
    periodicTimer = setInterval(() => {
      if (!semanticStore.fieldSettings.enabled) return
      const allNodeIds = Array.from(mapStore.nodes.keys())
      // Check if any nodes don't have embeddings yet
      const unembedded = allNodeIds.filter(id => !semanticStore.nodeData.has(id))
      if (unembedded.length > 0) {
        enqueueNodes(unembedded, 'low')
      }
    }, 60000)
  }

  function pauseProcessor() {
    isRunning.value = false
    if (watchStop) {
      watchStop()
      watchStop = null
    }
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (clusterTimer) {
      clearTimeout(clusterTimer)
      clusterTimer = null
    }
    if (periodicTimer) {
      clearInterval(periodicTimer)
      periodicTimer = null
    }
    if (changeDetectionTimer) {
      clearTimeout(changeDetectionTimer)
      changeDetectionTimer = null
    }
    queue.clear()
    semanticStore.setEmbeddingQueueSize(0)
  }

  function detectChangedNodes() {
    if (!semanticStore.fieldSettings.enabled) return

    for (const [nodeId, node] of mapStore.nodes) {
      if (!node.content.trim()) continue

      const hash = fnv1aHash(node.content)
      const prevHash = nodeHashes.get(nodeId)
      const existing = semanticStore.nodeData.get(nodeId)

      if (!existing) {
        // New node — immediate priority
        nodeHashes.set(nodeId, hash)
        enqueueNode(nodeId, 'immediate')
      } else if (prevHash !== hash) {
        // Content changed — high priority
        nodeHashes.set(nodeId, hash)
        enqueueNode(nodeId, 'high')
      }
    }

    // Detect deleted nodes
    for (const nodeId of nodeHashes.keys()) {
      if (!mapStore.nodes.has(nodeId)) {
        nodeHashes.delete(nodeId)
        semanticStore.removeNodeData(nodeId)
      }
    }
  }

  // ── Benchmark ──

  async function benchmarkBatchSize(): Promise<number> {
    if (!_sendMessage) return 16
    try {
      const result = await _sendMessage<{ optimalBatchSize: number }>('benchmark-batch-size', {})
      return result.optimalBatchSize
    } catch {
      return 16
    }
  }

  // ── Lifecycle ──

  onUnmounted(() => {
    pauseProcessor()
  })

  return {
    processorState: readonly(processorState),
    queueSize,
    isRunning: readonly(isRunning),
    startProcessor,
    pauseProcessor,
    enqueueNode,
    enqueueNodes,
    setSendMessage,
    benchmarkBatchSize,
    flush,
    detectClusters
  }
}
