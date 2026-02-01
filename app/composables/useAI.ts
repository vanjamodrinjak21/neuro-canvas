import type { AIModelStatus, AISuggestion } from '~/types'
import { useSemanticStore } from '~/stores/semanticStore'

/**
 * AI Integration composable for NeuroCanvas
 *
 * Provides a high-level API for AI features including:
 * - Smart Expand (generate related concepts)
 * - Semantic Search
 * - Auto-Connect suggestions
 * - Real embeddings with transformers.js
 * - Similarity computation
 */
export function useAI() {
  // State
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const hasWebGPU = ref(false)
  const modelStatus = ref<Record<string, AIModelStatus>>({})
  const loadProgress = ref<Record<string, number>>({})
  const error = ref<string | null>(null)

  // Semantic store for state management
  const semanticStore = useSemanticStore()

  // Worker reference
  let worker: Worker | null = null
  const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
  }>()

  // Debounce timer for processing dirty nodes
  let processQueueTimer: ReturnType<typeof setTimeout> | null = null
  const PROCESS_QUEUE_DELAY = 500 // ms

  /**
   * Generate unique request ID
   */
  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  /**
   * Send message to worker and wait for response
   */
  function sendMessage<T>(
    type: string,
    payload: unknown,
    onProgress?: (progress: unknown) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!worker) {
        reject(new Error('AI worker not initialized'))
        return
      }

      const id = generateId()
      pendingRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject
      })

      // Set up progress handler if provided
      if (onProgress) {
        const progressHandler = (event: MessageEvent) => {
          const { id: responseId, type: responseType, payload: responsePayload } = event.data
          if (responseId === id && responseType === 'progress') {
            onProgress(responsePayload)
          }
        }
        worker.addEventListener('message', progressHandler)

        // Clean up on completion
        const cleanup = () => {
          worker?.removeEventListener('message', progressHandler)
        }
        const originalResolve = pendingRequests.get(id)!.resolve
        pendingRequests.get(id)!.resolve = (value) => {
          cleanup()
          originalResolve(value)
        }
      }

      worker.postMessage({ id, type, payload })
    })
  }

  /**
   * Handle worker messages
   */
  function handleWorkerMessage(event: MessageEvent) {
    const { id, type, payload } = event.data

    // Handle progress updates separately
    if (type === 'progress') {
      const { model, progress } = payload as { model?: string; progress?: number }
      if (model && progress !== undefined) {
        loadProgress.value[model] = progress
        semanticStore.setModelProgress(progress * 100)
      }
      return
    }

    const request = pendingRequests.get(id)
    if (!request) return

    pendingRequests.delete(id)

    if (type === 'success') {
      request.resolve(payload)
    } else if (type === 'error') {
      request.reject(new Error(payload.message || 'Unknown error'))
    }
  }

  /**
   * Initialize the AI system
   */
  async function initialize(): Promise<boolean> {
    if (isInitialized.value) return true
    if (typeof Worker === 'undefined') {
      error.value = 'Web Workers not supported'
      semanticStore.setAIError('Web Workers not supported')
      return false
    }

    isLoading.value = true
    error.value = null
    semanticStore.setAIStatus('loading-model')

    try {
      // Create worker
      worker = new Worker(
        new URL('../workers/ai.worker.ts', import.meta.url),
        { type: 'module' }
      )

      // Set up message handler
      worker.onmessage = handleWorkerMessage
      worker.onerror = (e) => {
        error.value = e.message
        semanticStore.setAIError(e.message)
        console.error('AI Worker error:', e)
      }

      // Initialize the worker
      const result = await sendMessage<{
        initialized: boolean
        webgpu: boolean
        modelLoaded: boolean
        availableModels: string[]
      }>('init', {}, (progress) => {
        const p = progress as { model?: string; progress?: number }
        if (p.progress !== undefined) {
          semanticStore.setModelProgress(p.progress * 100)
        }
      })

      isInitialized.value = result.initialized
      hasWebGPU.value = result.webgpu
      semanticStore.setHasWebGPU(result.webgpu)
      semanticStore.setModelLoaded(result.modelLoaded)

      return result.initialized
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to initialize AI'
      semanticStore.setAIError(error.value)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Smart Expand - Generate related concepts for a node
   */
  async function smartExpand(
    nodeContent: string,
    context: string[] = [],
    maxSuggestions = 5
  ): Promise<string[]> {
    if (!isInitialized.value) {
      await initialize()
    }

    isLoading.value = true
    error.value = null

    try {
      const result = await sendMessage<{
        suggestions: string[]
        confidence: number
      }>('expand', {
        nodeContent,
        context,
        maxSuggestions
      }, (progress) => {
        console.log('Smart Expand progress:', progress)
      })

      return result.suggestions
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Smart Expand failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Generate embeddings for texts
   */
  async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!isInitialized.value) {
      await initialize()
    }

    isLoading.value = true
    error.value = null
    semanticStore.setAIStatus('computing')

    try {
      const result = await sendMessage<{
        embeddings: number[][]
        dimensions: number
      }>('embed', { texts })

      return result.embeddings
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Embedding generation failed'
      throw e
    } finally {
      isLoading.value = false
      semanticStore.setAIStatus('ready')
    }
  }

  /**
   * Embed nodes by ID - generates embeddings and updates semantic store
   */
  async function embedNodes(
    nodes: Array<{ id: string; content: string }>,
    onProgress?: (completed: number, total: number, nodeId: string) => void
  ): Promise<void> {
    if (!isInitialized.value) {
      await initialize()
    }

    if (nodes.length === 0) return

    isLoading.value = true
    error.value = null
    semanticStore.setAIStatus('computing')

    try {
      const result = await sendMessage<{
        embeddings: Array<{ id: string; embedding: number[] }>
        dimensions: number
      }>('embed-batch', {
        texts: nodes.map(n => ({ id: n.id, text: n.content }))
      }, (progress) => {
        const p = progress as { completed?: number; total?: number; nodeId?: string }
        if (p.completed !== undefined && p.total !== undefined && p.nodeId !== undefined) {
          onProgress?.(p.completed, p.total, p.nodeId)
        }
      })

      // Update semantic store with embeddings
      for (const { id, embedding } of result.embeddings) {
        semanticStore.setNodeEmbedding(id, embedding)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Embedding generation failed'
      throw e
    } finally {
      isLoading.value = false
      semanticStore.setAIStatus('ready')
    }
  }

  /**
   * Recompute similarity matrix for all embedded nodes
   */
  async function recomputeSimilarities(threshold: number = 0.3): Promise<void> {
    if (!isInitialized.value) {
      await initialize()
    }

    const nodesWithEmbeddings = semanticStore.nodesWithEmbeddings
    if (nodesWithEmbeddings.length < 2) {
      semanticStore.updateSimilarities([])
      return
    }

    isLoading.value = true
    semanticStore.setAIStatus('computing')

    try {
      const result = await sendMessage<{
        similarities: Array<{ sourceId: string; targetId: string; similarity: number }>
        pairsComputed: number
        pairsAboveThreshold: number
      }>('compute-similarities', {
        embeddings: nodesWithEmbeddings.map((n: { nodeId: string; embedding: number[] }) => ({
          id: n.nodeId,
          embedding: n.embedding
        })),
        threshold
      })

      semanticStore.updateSimilarities(result.similarities)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Similarity computation failed'
      throw e
    } finally {
      isLoading.value = false
      semanticStore.setAIStatus('ready')
    }
  }

  /**
   * Process dirty nodes queue - debounced embedding updates
   */
  function processQueue(
    getNodeContent: (nodeId: string) => string | undefined,
    similarityThreshold: number = 0.3
  ) {
    // Clear existing timer
    if (processQueueTimer) {
      clearTimeout(processQueueTimer)
    }

    // Set new debounced timer
    processQueueTimer = setTimeout(async () => {
      const dirtyIds = Array.from(semanticStore.dirtyNodeIds) as string[]
      if (dirtyIds.length === 0) return

      // Build nodes array with content
      const nodesToEmbed: Array<{ id: string; content: string }> = []
      for (const nodeId of dirtyIds) {
        const content = getNodeContent(nodeId)
        if (content && content.trim().length > 0) {
          nodesToEmbed.push({ id: nodeId, content })
        }
      }

      if (nodesToEmbed.length === 0) return

      try {
        // Generate embeddings for dirty nodes
        await embedNodes(nodesToEmbed)

        // Recompute similarities
        await recomputeSimilarities(similarityThreshold)
      } catch (e) {
        console.error('Error processing embedding queue:', e)
      }
    }, PROCESS_QUEUE_DELAY)
  }

  /**
   * Semantic search across nodes
   */
  async function semanticSearch(
    query: string,
    nodeEmbeddings: Array<{ id: string; embedding: number[] }>,
    topK = 10
  ): Promise<Array<{ nodeId: string; similarity: number }>> {
    if (!isInitialized.value) {
      await initialize()
    }

    isLoading.value = true
    error.value = null

    try {
      const result = await sendMessage<{
        results: Array<{ nodeId: string; similarity: number }>
        query: string
      }>('search', {
        query,
        nodeEmbeddings,
        topK
      })

      return result.results
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Semantic search failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Suggest connections between nodes
   */
  async function suggestConnections(
    nodes: Array<{ id: string; content: string; embedding?: number[] }>,
    threshold = 0.7
  ): Promise<AISuggestion[]> {
    if (!isInitialized.value) {
      await initialize()
    }

    isLoading.value = true
    error.value = null

    try {
      const result = await sendMessage<{
        suggestions: Array<{
          sourceId: string
          targetId: string
          confidence: number
          reason: string
        }>
        threshold: number
      }>('suggest', {
        nodes,
        threshold
      })

      // Convert to AISuggestion format
      return result.suggestions.map((s, index) => ({
        id: `connection-${index}`,
        type: 'connect' as const,
        content: s.reason,
        confidence: s.confidence,
        nodeId: s.sourceId,
        targetNodeId: s.targetId
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Connection suggestion failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Dispose of AI resources
   */
  async function dispose(): Promise<void> {
    if (processQueueTimer) {
      clearTimeout(processQueueTimer)
      processQueueTimer = null
    }

    if (worker) {
      try {
        await sendMessage('dispose', {})
      } catch {
        // Ignore errors during disposal
      }
      worker.terminate()
      worker = null
    }

    isInitialized.value = false
    pendingRequests.clear()
    semanticStore.$reset()
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    dispose()
  })

  return {
    // State
    isInitialized: readonly(isInitialized),
    isLoading: readonly(isLoading),
    hasWebGPU: readonly(hasWebGPU),
    modelStatus: readonly(modelStatus),
    loadProgress: readonly(loadProgress),
    error: readonly(error),

    // Methods
    initialize,
    smartExpand,
    generateEmbeddings,
    embedNodes,
    recomputeSimilarities,
    processQueue,
    semanticSearch,
    suggestConnections,
    dispose
  }
}
