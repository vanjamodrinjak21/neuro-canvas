/**
 * AI Worker for NeuroCanvas - Semantic Constellation Engine
 *
 * Handles AI operations in a separate thread using transformers.js:
 * - Real embeddings using all-MiniLM-L6-v2 (~23MB)
 * - Similarity computation
 * - Smart expansion suggestions
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'

// Configure transformers.js to use IndexedDB for model caching
env.cacheDir = 'indexeddb://neurocanvas-models'
env.allowLocalModels = false

// Suppress expected ONNX runtime warning about execution providers
// This is informational - ONNX assigns shape ops to CPU for performance
const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  const msg = args[0]
  if (typeof msg === 'string' && msg.includes('Some nodes were not assigned')) {
    return // Suppress expected ONNX warning
  }
  originalWarn.apply(console, args)
}

// Message types
type MessageType =
  | 'init'
  | 'expand'
  | 'embed'
  | 'embed-batch'
  | 'compute-similarities'
  | 'search'
  | 'suggest'
  | 'dispose'
  | 'progress'

interface WorkerMessage {
  id: string
  type: MessageType
  payload: unknown
}

interface WorkerResponse {
  id: string
  type: 'success' | 'error' | 'progress'
  payload: unknown
}

// Embedding pipeline (lazy loaded)
let embeddingPipeline: FeatureExtractionPipeline | null = null
let isModelLoading = false
let modelLoadProgress = 0
let hasWebGPU = false

// Check for WebGPU support
async function checkWebGPU(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (!('gpu' in navigator)) return false

  try {
    const adapter = await (navigator as Navigator & { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter()
    return adapter !== null
  } catch {
    return false
  }
}

// Initialize the embedding model
async function initEmbeddingModel(onProgress?: (progress: number) => void): Promise<void> {
  if (embeddingPipeline || isModelLoading) return

  isModelLoading = true

  try {
    // Determine device - use WebGPU if available, otherwise WASM
    hasWebGPU = await checkWebGPU()
    const device = hasWebGPU ? 'webgpu' : 'wasm'

    console.log(`[AI Worker] Initializing embedding model with ${device}...`)

    // Load the all-MiniLM-L6-v2 model (~23MB, 384 dimensions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    embeddingPipeline = await (pipeline as any)(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        device,
        progress_callback: (progress: { status: string; progress?: number; loaded?: number; total?: number }) => {
          if (progress.status === 'progress' && progress.progress !== undefined) {
            modelLoadProgress = progress.progress
            onProgress?.(progress.progress)
          } else if (progress.status === 'done') {
            modelLoadProgress = 100
            onProgress?.(100)
          }
        }
      }
    ) as FeatureExtractionPipeline

    console.log('[AI Worker] Embedding model loaded successfully')
  } catch (error) {
    console.error('[AI Worker] Failed to load embedding model:', error)
    throw error
  } finally {
    isModelLoading = false
  }
}

// Generate embedding for a single text
async function generateEmbedding(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized')
  }

  const output = await embeddingPipeline(text, {
    pooling: 'mean',
    normalize: true
  })

  // Extract the embedding array from the tensor
  return Array.from(output.data as Float32Array)
}

// Generate embeddings for multiple texts
async function generateEmbeddings(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized')
  }

  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]
    if (!text) continue
    const output = await embeddingPipeline(text, {
      pooling: 'mean',
      normalize: true
    })
    embeddings.push(Array.from(output.data as Float32Array))
    onProgress?.(i + 1, texts.length)
  }

  return embeddings
}

// Compute cosine similarity between two embeddings
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0
    const bVal = b[i] ?? 0
    dotProduct += aVal * bVal
    normA += aVal * aVal
    normB += bVal * bVal
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Compute similarity matrix (sparse, only above threshold)
function computeSimilarityMatrix(
  embeddings: Array<{ id: string; embedding: number[] }>,
  threshold: number
): Array<{ sourceId: string; targetId: string; similarity: number }> {
  const similarities: Array<{ sourceId: string; targetId: string; similarity: number }> = []

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const embI = embeddings[i]
      const embJ = embeddings[j]
      if (!embI || !embJ) continue
      const similarity = cosineSimilarity(embI.embedding, embJ.embedding)
      if (similarity >= threshold) {
        similarities.push({
          sourceId: embI.id,
          targetId: embJ.id,
          similarity
        })
      }
    }
  }

  return similarities
}

// Generate expansion suggestions based on content patterns
function generateExpansionSuggestions(content: string, context: string[], maxSuggestions: number): string[] {
  const suggestions: string[] = []
  const topic = content.trim()

  // Generate contextual suggestions based on common knowledge patterns
  const expansionPatterns = [
    `Benefits of ${topic}`,
    `Challenges with ${topic}`,
    `${topic} best practices`,
    `Future of ${topic}`,
    `${topic} alternatives`,
    `How to implement ${topic}`,
    `${topic} examples`,
    `${topic} vs similar concepts`,
    `Key principles of ${topic}`,
    `Common mistakes with ${topic}`
  ]

  // Filter patterns based on context to avoid duplicates
  const contextLower = context.map(c => c.toLowerCase())
  for (const pattern of expansionPatterns) {
    if (suggestions.length >= maxSuggestions) break
    const patternLower = pattern.toLowerCase()
    const isDuplicate = contextLower.some(c =>
      c.includes(patternLower) || patternLower.includes(c)
    )
    if (!isDuplicate) {
      suggestions.push(pattern)
    }
  }

  return suggestions.slice(0, maxSuggestions)
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data

  try {
    switch (type) {
      case 'init': {
        // Initialize the embedding model
        const webgpu = await checkWebGPU()

        // Start loading model with progress updates
        await initEmbeddingModel((progress) => {
          respond(id, 'progress', {
            model: 'embedding',
            progress: progress / 100
          })
        })

        respond(id, 'success', {
          initialized: true,
          webgpu,
          modelLoaded: !!embeddingPipeline,
          availableModels: ['all-MiniLM-L6-v2']
        })
        break
      }

      case 'expand': {
        const { nodeContent, context, maxSuggestions } = payload as {
          nodeContent: string
          context: string[]
          maxSuggestions: number
        }

        // Send progress update
        respond(id, 'progress', { progress: 0.3 })

        const suggestions = generateExpansionSuggestions(nodeContent, context, maxSuggestions)

        respond(id, 'progress', { progress: 1.0 })
        respond(id, 'success', {
          suggestions,
          confidence: 0.85
        })
        break
      }

      case 'embed': {
        const { texts } = payload as { texts: string[] }

        // Ensure model is loaded
        if (!embeddingPipeline) {
          await initEmbeddingModel((progress) => {
            respond(id, 'progress', { model: 'embedding', progress: progress / 100 })
          })
        }

        // Generate embeddings
        const embeddings = await generateEmbeddings(texts, (completed, total) => {
          respond(id, 'progress', { completed, total })
        })

        respond(id, 'success', {
          embeddings,
          dimensions: embeddings[0]?.length || 384
        })
        break
      }

      case 'embed-batch': {
        const { texts } = payload as {
          texts: Array<{ id: string; text: string }>
        }

        // Ensure model is loaded
        if (!embeddingPipeline) {
          await initEmbeddingModel((progress) => {
            respond(id, 'progress', { model: 'embedding', progress: progress / 100 })
          })
        }

        // Generate embeddings with IDs
        const results: Array<{ id: string; embedding: number[] }> = []

        for (let i = 0; i < texts.length; i++) {
          const item = texts[i]
          if (!item) continue
          const { id: textId, text } = item
          const embedding = await generateEmbedding(text)
          results.push({ id: textId, embedding })

          // Report progress
          respond(id, 'progress', {
            completed: i + 1,
            total: texts.length,
            nodeId: textId
          })
        }

        respond(id, 'success', {
          embeddings: results,
          dimensions: results[0]?.embedding.length || 384
        })
        break
      }

      case 'compute-similarities': {
        const { embeddings, threshold } = payload as {
          embeddings: Array<{ id: string; embedding: number[] }>
          threshold: number
        }

        // Compute similarity matrix
        const similarities = computeSimilarityMatrix(embeddings, threshold)

        respond(id, 'success', {
          similarities,
          pairsComputed: (embeddings.length * (embeddings.length - 1)) / 2,
          pairsAboveThreshold: similarities.length
        })
        break
      }

      case 'search': {
        const { query, nodeEmbeddings, topK } = payload as {
          query: string
          nodeEmbeddings: Array<{ id: string; embedding: number[] }>
          topK: number
        }

        // Ensure model is loaded
        if (!embeddingPipeline) {
          await initEmbeddingModel((progress) => {
            respond(id, 'progress', { model: 'embedding', progress: progress / 100 })
          })
        }

        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query)

        // Compute similarities with all nodes
        const results = nodeEmbeddings
          .map(node => ({
            nodeId: node.id,
            similarity: cosineSimilarity(queryEmbedding, node.embedding)
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK)

        respond(id, 'success', {
          results,
          query
        })
        break
      }

      case 'suggest': {
        const { nodes, threshold } = payload as {
          nodes: Array<{ id: string; content: string; embedding?: number[] }>
          threshold: number
        }

        // Ensure model is loaded for embedding generation
        if (!embeddingPipeline) {
          await initEmbeddingModel((progress) => {
            respond(id, 'progress', { model: 'embedding', progress: progress / 100 })
          })
        }

        // Generate embeddings for nodes without them
        const nodesWithEmbeddings: Array<{ id: string; content: string; embedding: number[] }> = []

        for (const node of nodes) {
          if (node.embedding) {
            nodesWithEmbeddings.push({ ...node, embedding: node.embedding })
          } else {
            const embedding = await generateEmbedding(node.content)
            nodesWithEmbeddings.push({ ...node, embedding })
          }
        }

        // Find highly similar pairs that aren't connected
        const suggestions: Array<{
          sourceId: string
          targetId: string
          confidence: number
          reason: string
        }> = []

        for (let i = 0; i < nodesWithEmbeddings.length; i++) {
          for (let j = i + 1; j < nodesWithEmbeddings.length; j++) {
            const source = nodesWithEmbeddings[i]
            const target = nodesWithEmbeddings[j]
            if (!source || !target) continue

            const similarity = cosineSimilarity(source.embedding, target.embedding)

            if (similarity >= threshold) {
              suggestions.push({
                sourceId: source.id,
                targetId: target.id,
                confidence: similarity,
                reason: `"${source.content}" and "${target.content}" are semantically related (${Math.round(similarity * 100)}% similar)`
              })
            }
          }
        }

        // Sort by confidence and limit
        suggestions.sort((a, b) => b.confidence - a.confidence)

        respond(id, 'success', {
          suggestions: suggestions.slice(0, 10),
          threshold
        })
        break
      }

      case 'dispose': {
        // Cleanup resources
        embeddingPipeline = null
        respond(id, 'success', { disposed: true })
        break
      }

      default:
        respond(id, 'error', { message: `Unknown message type: ${type}` })
    }
  } catch (error) {
    respond(id, 'error', {
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

function respond(id: string, type: 'success' | 'error' | 'progress', payload: unknown) {
  const response: WorkerResponse = { id, type, payload }
  self.postMessage(response)
}

// Signal worker is ready
console.log('[AI Worker] Semantic Constellation Engine initialized')
