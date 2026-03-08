import type { AIModelStatus, AISuggestion } from '~/types'
import type {
  RichNodeSuggestion,
  MapStructure,
  GenerationContext,
  MapGenerationOptions,
  HierarchicalExpandOptions,
  TypedConnectionSuggestion,
  NodeDescription
} from '~/types/ai-generation'
import { useSemanticStore } from '~/stores/semanticStore'
import { useAISettings } from '~/composables/useAISettings'
import {
  buildEnhancedExpandPrompt,
  buildNodeDescriptionPrompt,
  buildMapStructurePrompt,
  buildHierarchicalExpandPrompt,
  buildConnectionSuggestionPrompt
} from '~/utils/ai-prompts'
import { aiComplete } from '~/utils/aiClient'
import { streamCompletion } from '~/ai/pipeline/StreamingPipeline'
import { resolveProvider } from '~/ai/utils/resolveProvider'
import {
  parseJsonResponse as parseJson,
  validateRichNodeSuggestions,
  validateMapStructure,
  validateTypedConnections,
  validateNodeDescription
} from '~/ai/utils/parseResponse'
import { executeWithRetry } from '~/ai/pipeline/RetryStrategy'
import { getSemanticCache } from '~/ai/pipeline/SemanticCache'
import { getBatchOptimizer, BatchOptimizer } from '~/ai/pipeline/BatchOptimizer'

function _isTauri(): boolean {
  return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

/**
 * Deep clone data to make it serializable for postMessage
 * Vue's reactive system adds non-cloneable properties that break structured cloning
 */
function makeSerializable<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

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

      worker.postMessage({ id, type, payload: makeSerializable(payload) })
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
   * Falls back to local template-based approach if no provider is configured
   */
  async function smartExpand(
    nodeContent: string,
    context: string[] = [],
    maxSuggestions = 5
  ): Promise<string[]> {
    // Try to use BYOK provider first
    const aiSettings = useAISettings()

    // Check if we have a configured and enabled provider with an API key
    const defaultProvider = aiSettings.defaultProvider.value
    if (defaultProvider?.isEnabled) {
      const apiKey = await aiSettings.getProviderApiKey(defaultProvider.id)
      if (apiKey) {
        try {
          return await smartExpandWithProvider(
            nodeContent,
            context,
            maxSuggestions,
            defaultProvider,
            apiKey
          )
        } catch (e) {
          console.warn('Provider-based expand failed, falling back to local:', e)
          // Fall through to local approach
        }
      }
    }

    // Fall back to local template-based approach
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
   * Smart Expand using a configured BYOK provider via server proxy
   */
  async function smartExpandWithProvider(
    nodeContent: string,
    context: string[],
    maxSuggestions: number,
    provider: { type: string; baseUrl?: string; selectedModelId?: string },
    apiKey: string
  ): Promise<string[]> {
    isLoading.value = true
    error.value = null

    const systemPrompt = `You are a mind mapping assistant. Generate ${maxSuggestions} concise, related concepts for expanding a mind map node. Each suggestion should be 1-5 words, actionable, and directly related to the topic. Return ONLY a JSON array of strings, no explanation.`

    const userPrompt = context.length > 0
      ? `Topic: "${nodeContent}"\n\nExisting related nodes: ${context.join(', ')}\n\nGenerate ${maxSuggestions} new, unique related concepts that aren't already covered.`
      : `Topic: "${nodeContent}"\n\nGenerate ${maxSuggestions} related concepts for this mind map node.`

    try {
      const response = await aiComplete({
        provider: provider.type,
        apiKey,
        baseUrl: provider.baseUrl,
        model: provider.selectedModelId,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 500,
        temperature: 0.7
      })

      const suggestions = parseJsonArray(response.content)
      return suggestions.slice(0, maxSuggestions)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Provider expand failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Enhanced Smart Expand - Generate rich suggestions with descriptions
   * Supports streaming, caching via Redis, and retry with backoff.
   */
  async function enhancedSmartExpand(
    nodeContent: string,
    context: GenerationContext,
    maxSuggestions = 5,
    options?: { stream?: boolean; onPartialResult?: (partial: string) => void }
  ): Promise<RichNodeSuggestion[]> {
    const provider = await resolveProvider()

    isLoading.value = true
    error.value = null

    try {
      const { system, user } = buildEnhancedExpandPrompt(nodeContent, context, maxSuggestions)

      // Check Redis-backed cache first
      const cache = getSemanticCache()
      const cached = await cache.get(system, user)
      if (cached) {
        const parsed = parseJson<unknown[]>(cached.response)
        if (Array.isArray(parsed)) {
          return validateRichNodeSuggestions(parsed, maxSuggestions)
        }
      }

      // Deduplicate identical in-flight requests
      const dedupeKey = BatchOptimizer.makeKey({ type: 'expand', nodeContent, maxSuggestions })
      const optimizer = getBatchOptimizer()

      const content = await optimizer.dedupe(dedupeKey, () =>
        executeWithRetry(async () => {
          if (options?.stream) {
            return streamCompletion(
              {
                provider: provider.type,
                apiKey: provider.apiKey,
                baseUrl: provider.baseUrl,
                model: provider.selectedModelId,
                systemPrompt: system,
                messages: [{ role: 'user', content: user }],
                maxTokens: 2000,
                temperature: 0.7
              },
              { onDelta: (_chunk, accumulated) => options.onPartialResult?.(accumulated) }
            )
          }

          const response = await aiComplete({
            provider: provider.type,
            apiKey: provider.apiKey,
            baseUrl: provider.baseUrl,
            model: provider.selectedModelId,
            systemPrompt: system,
            messages: [{ role: 'user', content: user }],
            maxTokens: 2000,
            temperature: 0.7
          })
          return response.content
        }, {
          onRetry: (attempt, err) => {
            console.warn(`[enhancedSmartExpand] Retry ${attempt}:`, err.message)
          }
        })
      )

      // Cache the response in Redis
      await cache.set(system, user, content, null, 'expand')

      const parsed = parseJson<unknown[]>(content)
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid response format: expected array')
      }

      return validateRichNodeSuggestions(parsed, maxSuggestions)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Enhanced expand failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Generate description for an existing node
   * Uses Redis cache with 24h TTL for descriptions.
   */
  async function generateNodeDescription(
    nodeContent: string,
    contextNodes: Array<{ content: string; description?: { summary: string } }> = [],
    style: 'concise' | 'detailed' | 'academic' = 'detailed'
  ): Promise<NodeDescription> {
    const provider = await resolveProvider()

    isLoading.value = true
    error.value = null

    try {
      const { system, user } = buildNodeDescriptionPrompt(nodeContent, contextNodes, style)

      // Check Redis cache (descriptions are stable, long TTL)
      const cache = getSemanticCache()
      const cached = await cache.get(system, user)
      if (cached) {
        const parsed = parseJson<Record<string, unknown>>(cached.response)
        return validateNodeDescription(parsed)
      }

      const content = await executeWithRetry(async () => {
        const response = await aiComplete({
          provider: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: provider.selectedModelId,
          systemPrompt: system,
          messages: [{ role: 'user', content: user }],
          maxTokens: 500,
          temperature: 0.6
        })
        return response.content
      })

      await cache.set(system, user, content, null, 'describe')

      const parsed = parseJson<Record<string, unknown>>(content)
      return validateNodeDescription(parsed)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Description generation failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Generate complete map structure from a topic
   * Supports streaming with progressive JSON parsing and Redis cache.
   */
  async function generateMapStructure(
    topic: string,
    options: MapGenerationOptions = {},
    streamOptions?: { stream?: boolean; onPartialResult?: (partial: string) => void }
  ): Promise<MapStructure> {
    const provider = await resolveProvider()

    isLoading.value = true
    error.value = null

    try {
      const { system, user } = buildMapStructurePrompt(topic, options)

      // Check Redis cache
      const cache = getSemanticCache()
      const cached = await cache.get(system, user)
      if (cached) {
        const parsed = parseJson<Record<string, unknown>>(cached.response)
        return validateMapStructure(parsed)
      }

      const content = await executeWithRetry(async () => {
        if (streamOptions?.stream) {
          return streamCompletion(
            {
              provider: provider.type,
              apiKey: provider.apiKey,
              baseUrl: provider.baseUrl,
              model: provider.selectedModelId,
              systemPrompt: system,
              messages: [{ role: 'user', content: user }],
              maxTokens: 4000,
              temperature: 0.7
            },
            { onDelta: (_chunk, accumulated) => streamOptions.onPartialResult?.(accumulated) }
          )
        }

        const response = await aiComplete({
          provider: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: provider.selectedModelId,
          systemPrompt: system,
          messages: [{ role: 'user', content: user }],
          maxTokens: 4000,
          temperature: 0.7
        })
        return response.content
      })

      await cache.set(system, user, content, null, 'generate')

      const parsed = parseJson<Record<string, unknown>>(content)
      return validateMapStructure(parsed)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Map structure generation failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Hierarchical expand - Multi-level expansion with children
   * Uses retry strategy and Redis cache.
   */
  async function hierarchicalExpand(
    nodeContent: string,
    context: GenerationContext,
    options: HierarchicalExpandOptions = {}
  ): Promise<RichNodeSuggestion[]> {
    const provider = await resolveProvider()

    isLoading.value = true
    error.value = null

    try {
      const { system, user } = buildHierarchicalExpandPrompt(nodeContent, context, options)

      const cache = getSemanticCache()
      const cached = await cache.get(system, user)
      if (cached) {
        const parsed = parseJson<unknown[]>(cached.response)
        if (Array.isArray(parsed)) return validateRichNodeSuggestions(parsed)
      }

      const content = await executeWithRetry(async () => {
        const response = await aiComplete({
          provider: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: provider.selectedModelId,
          systemPrompt: system,
          messages: [{ role: 'user', content: user }],
          maxTokens: 3000,
          temperature: 0.7
        })
        return response.content
      })

      await cache.set(system, user, content, null, 'expand')

      const parsed = parseJson<unknown[]>(content)
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid response format: expected array')
      }

      return validateRichNodeSuggestions(parsed)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Hierarchical expand failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Suggest typed connections between nodes
   * Uses retry strategy and Redis cache.
   */
  async function suggestTypedConnections(
    nodes: Array<{ id: string; content: string; description?: { summary: string } }>,
    existingEdges: Array<{ sourceId: string; targetId: string }>,
    maxSuggestions = 5
  ): Promise<TypedConnectionSuggestion[]> {
    if (nodes.length < 2) {
      return []
    }

    const provider = await resolveProvider()

    isLoading.value = true
    error.value = null

    try {
      const { system, user } = buildConnectionSuggestionPrompt(nodes, existingEdges, maxSuggestions)

      const cache = getSemanticCache()
      const cached = await cache.get(system, user)
      if (cached) {
        const parsed = parseJson<unknown[]>(cached.response)
        if (Array.isArray(parsed)) {
          const nodeIds = new Set(nodes.map(n => n.id))
          const existingSet = new Set(existingEdges.map(e => `${e.sourceId}-${e.targetId}`))
          return validateTypedConnections(parsed, nodeIds, existingSet, maxSuggestions)
        }
      }

      const content = await executeWithRetry(async () => {
        const response = await aiComplete({
          provider: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          model: provider.selectedModelId,
          systemPrompt: system,
          messages: [{ role: 'user', content: user }],
          maxTokens: 1500,
          temperature: 0.6
        })
        return response.content
      })

      await cache.set(system, user, content, null, 'connect')

      const parsed = parseJson<unknown[]>(content)
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid response format: expected array')
      }

      const nodeIds = new Set(nodes.map(n => n.id))
      const existingSet = new Set(existingEdges.map(e => `${e.sourceId}-${e.targetId}`))

      return validateTypedConnections(parsed, nodeIds, existingSet, maxSuggestions)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Connection suggestion failed'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Parse JSON array from LLM response (handles markdown code blocks)
   */
  function parseJsonArray(content: string): string[] {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\[[\s\S]*\]/)
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content

    try {
      const parsed = JSON.parse(jsonStr.trim())
      if (Array.isArray(parsed)) {
        return parsed.filter(item => typeof item === 'string')
      }
    } catch {
      // If JSON parsing fails, try to extract items from text
      const lines = content.split('\n').filter(line => line.trim())
      return lines
        .map(line => line.replace(/^[-*•\d.)\]]+\s*/, '').replace(/["']/g, '').trim())
        .filter(line => line.length > 0 && line.length < 50)
        .slice(0, 10)
    }
    return []
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
   * Check Redis cache for existing embeddings
   */
  async function checkEmbeddingCache(
    mapId: string,
    nodeIds: string[]
  ): Promise<Map<string, number[]>> {
    const cachedEmbeddings = new Map<string, number[]>()

    if (nodeIds.length === 0 || _isTauri()) return cachedEmbeddings

    try {
      const response = await $fetch<{
        embeddings: Array<{ nodeId: string; embedding: number[] }>
        found: number
        requested: number
      }>('/api/embeddings', {
        method: 'GET',
        query: {
          mapId,
          nodeIds: nodeIds.join(',')
        }
      })

      for (const { nodeId, embedding } of response.embeddings) {
        cachedEmbeddings.set(nodeId, embedding)
      }
    } catch (e) {
      // Cache miss is not an error - just continue without cache
      console.debug('Embedding cache check failed:', e)
    }

    return cachedEmbeddings
  }

  /**
   * Store embeddings in Redis cache
   */
  async function cacheEmbeddings(
    mapId: string,
    embeddings: Array<{ nodeId: string; text: string; embedding: number[] }>
  ): Promise<void> {
    if (embeddings.length === 0 || _isTauri()) return

    try {
      await $fetch('/api/embeddings', {
        method: 'POST',
        body: {
          mapId,
          embeddings: embeddings.map(e => ({
            nodeId: e.nodeId,
            text: e.text,
            embedding: e.embedding
          }))
        }
      })
    } catch (e) {
      // Cache store failure is not critical - log and continue
      console.debug('Failed to cache embeddings:', e)
    }
  }

  /**
   * Embed nodes with Redis cache support
   * Checks cache first, only computes embeddings for cache misses
   */
  async function embedNodesWithCache(
    mapId: string,
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
      // Check cache for existing embeddings
      const nodeIds = nodes.map(n => n.id)
      const cachedEmbeddings = await checkEmbeddingCache(mapId, nodeIds)

      // Separate cached and uncached nodes
      const uncachedNodes: Array<{ id: string; content: string }> = []
      let cachedCount = 0

      for (const node of nodes) {
        const cached = cachedEmbeddings.get(node.id)
        if (cached) {
          // Use cached embedding directly
          semanticStore.setNodeEmbedding(node.id, cached)
          cachedCount++
          onProgress?.(cachedCount, nodes.length, node.id)
        } else {
          uncachedNodes.push(node)
        }
      }

      // Generate embeddings for uncached nodes
      if (uncachedNodes.length > 0) {
        const result = await sendMessage<{
          embeddings: Array<{ id: string; embedding: number[] }>
          dimensions: number
        }>('embed-batch', {
          texts: uncachedNodes.map(n => ({ id: n.id, text: n.content }))
        }, (progress) => {
          const p = progress as { completed?: number; total?: number; nodeId?: string }
          if (p.completed !== undefined && p.total !== undefined && p.nodeId !== undefined) {
            onProgress?.(cachedCount + p.completed, nodes.length, p.nodeId)
          }
        })

        // Update semantic store and prepare for caching
        const newEmbeddings: Array<{ nodeId: string; text: string; embedding: number[] }> = []

        for (const { id, embedding } of result.embeddings) {
          semanticStore.setNodeEmbedding(id, embedding)
          const node = uncachedNodes.find(n => n.id === id)
          if (node) {
            newEmbeddings.push({
              nodeId: id,
              text: node.content,
              embedding
            })
          }
        }

        // Cache the newly computed embeddings
        await cacheEmbeddings(mapId, newEmbeddings)
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
   * Process dirty nodes queue with cache support - debounced embedding updates
   */
  function processQueueWithCache(
    mapId: string,
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
        // Generate embeddings for dirty nodes (with cache)
        await embedNodesWithCache(mapId, nodesToEmbed)

        // Recompute similarities
        await recomputeSimilarities(similarityThreshold)
      } catch (e) {
        console.error('Error processing embedding queue:', e)
      }
    }, PROCESS_QUEUE_DELAY)
  }

  /**
   * Clear cached embeddings for a map
   */
  async function clearEmbeddingCache(mapId: string): Promise<void> {
    if (_isTauri()) return
    try {
      await $fetch(`/api/embeddings/${mapId}`, {
        method: 'DELETE'
      })
    } catch (e) {
      console.debug('Failed to clear embedding cache:', e)
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
    dispose,
    // Cache methods
    checkEmbeddingCache,
    cacheEmbeddings,
    embedNodesWithCache,
    processQueueWithCache,
    clearEmbeddingCache,
    // Enhanced AI methods
    enhancedSmartExpand,
    generateNodeDescription,
    generateMapStructure,
    hierarchicalExpand,
    suggestTypedConnections
  }
}
