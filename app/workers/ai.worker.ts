/**
 * AI Worker for NeuroCanvas - Semantic Constellation Engine
 *
 * Handles AI operations in a separate thread using transformers.js:
 * - Real embeddings using all-MiniLM-L6-v2 (~23MB)
 * - True batch inference for performance
 * - Optimized dot-product similarity (pre-normalized embeddings)
 * - Incremental similarity updates
 * - DBSCAN-inspired clustering
 * - Hybrid text + semantic search
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'

// Configure transformers.js to use IndexedDB for model caching
env.cacheDir = 'indexeddb://neurocanvas-models'
env.allowLocalModels = false

// Suppress the specific ONNX Runtime EP assignment info message that fires
// when shape-related ops are assigned to CPU instead of WebGPU.  All other
// warnings pass through unmodified.
const _origWarn = console.warn
console.warn = (...args: unknown[]) => {
  const msg = args[0]
  if (
    typeof msg === 'string' &&
    (msg.includes('Some nodes were not assigned') ||
     msg.includes('Going to re-assign them'))
  ) {
    return
  }
  _origWarn.apply(console, args)
}

// Message types
type MessageType =
  | 'init'
  | 'expand'
  | 'embed'
  | 'embed-batch'
  | 'compute-similarities'
  | 'update-similarities'
  | 'detect-clusters'
  | 'hybrid-search'
  | 'benchmark-batch-size'
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
let _modelLoadProgress = 0
let hasWebGPU = false

// Content hash cache for skipping unchanged embeddings
const contentHashCache = new Map<string, number>()

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
    let device: 'webgpu' | 'wasm' = hasWebGPU ? 'webgpu' : 'wasm'

    const progressCallback = (progress: { status: string; progress?: number; loaded?: number; total?: number }) => {
      if (progress.status === 'progress' && progress.progress !== undefined) {
        _modelLoadProgress = progress.progress
        onProgress?.(progress.progress)
      } else if (progress.status === 'done') {
        _modelLoadProgress = 100
        onProgress?.(100)
      }
    }

    console.log(`[AI Worker] Initializing embedding model with ${device}...`)

    try {
      // Load the all-MiniLM-L6-v2 model (~23MB, 384 dimensions)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embeddingPipeline = await (pipeline as any)(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { device, progress_callback: progressCallback }
      ) as FeatureExtractionPipeline
    } catch (gpuError) {
      // WebGPU init may fail even when adapter exists — fall back to WASM
      if (device === 'webgpu') {
        console.warn('[AI Worker] WebGPU pipeline failed, falling back to WASM:', gpuError)
        hasWebGPU = false
        device = 'wasm'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeddingPipeline = await (pipeline as any)(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          { device, progress_callback: progressCallback }
        ) as FeatureExtractionPipeline
      } else {
        throw gpuError
      }
    }

    console.log(`[AI Worker] Embedding model loaded successfully (${device})`)
  } catch (error) {
    console.error('[AI Worker] Failed to load embedding model:', error)
    throw error
  } finally {
    isModelLoading = false
  }
}

// ═══════════════ BATCH EMBEDDING ═══════════════

/**
 * True batch inference — processes multiple texts in a single forward pass.
 * Falls back to sequential for single items.
 */
async function batchEmbed(
  texts: string[],
  batchSize: number = 16,
  onProgress?: (completed: number, total: number) => void
): Promise<Float32Array[]> {
  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized')
  }

  const results: Float32Array[] = []
  const total = texts.length

  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total)
    const batch = texts.slice(start, end)

    // True batch inference — pipeline accepts array of strings
    const output = await embeddingPipeline(batch, {
      pooling: 'mean',
      normalize: true
    })

    // Extract individual embeddings from the batched output tensor
    const data = output.data as Float32Array
    const dims = 384 // all-MiniLM-L6-v2 dimension
    for (let i = 0; i < batch.length; i++) {
      // Create a view into the output data without copying
      const embedding = new Float32Array(data.buffer, data.byteOffset + i * dims * 4, dims)
      // Copy to own buffer so the pipeline can free the original tensor
      results.push(new Float32Array(embedding))
    }

    onProgress?.(Math.min(end, total), total)
  }

  return results
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

// Generate embeddings for multiple texts (sequential fallback)
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

// ═══════════════ SIMILARITY ═══════════════

/**
 * Optimized dot-product similarity for L2-normalized embeddings.
 * Uses 4-element unrolled loop for better auto-vectorization.
 */
function dotProductSimilarity(a: number[] | Float32Array, b: number[] | Float32Array): number {
  const len = a.length
  let sum0 = 0, sum1 = 0, sum2 = 0, sum3 = 0
  const limit = len - (len % 4)

  for (let i = 0; i < limit; i += 4) {
    sum0 += a[i]! * b[i]!
    sum1 += a[i + 1]! * b[i + 1]!
    sum2 += a[i + 2]! * b[i + 2]!
    sum3 += a[i + 3]! * b[i + 3]!
  }

  let sum = sum0 + sum1 + sum2 + sum3
  for (let i = limit; i < len; i++) {
    sum += a[i]! * b[i]!
  }

  return sum
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
      const similarity = dotProductSimilarity(embI.embedding, embJ.embedding)
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

/**
 * Incremental similarity update: only recompute pairs involving changed nodes.
 * Complexity: O(k*n) instead of O(n^2) where k = changed nodes.
 */
function incrementalSimilarityUpdate(
  changedNodeIds: string[],
  embeddings: Array<{ id: string; embedding: number[] }>,
  currentSimilarities: Array<{ sourceId: string; targetId: string; similarity: number }>,
  threshold: number
): Array<{ sourceId: string; targetId: string; similarity: number }> {
  const changedSet = new Set(changedNodeIds)

  // Keep similarities that don't involve any changed node
  const keptSimilarities = currentSimilarities.filter(
    s => !changedSet.has(s.sourceId) && !changedSet.has(s.targetId)
  )

  // Build embedding lookup
  const embeddingMap = new Map<string, number[]>()
  for (const e of embeddings) {
    embeddingMap.set(e.id, e.embedding)
  }

  // Compute new similarities for changed nodes against all nodes
  const newSimilarities: Array<{ sourceId: string; targetId: string; similarity: number }> = []

  for (const changedId of changedNodeIds) {
    const changedEmb = embeddingMap.get(changedId)
    if (!changedEmb) continue

    for (const other of embeddings) {
      if (other.id === changedId) continue
      // Avoid duplicate: only compute if changedId < other.id, or if other is also changed
      // and changedId < other.id
      const [srcId, tgtId] = changedId < other.id ? [changedId, other.id] : [other.id, changedId]

      // Skip if this pair is between two changed nodes and we already computed it
      if (changedSet.has(other.id) && changedId > other.id) continue

      const similarity = dotProductSimilarity(changedEmb, other.embedding)
      if (similarity >= threshold) {
        newSimilarities.push({ sourceId: srcId, targetId: tgtId, similarity })
      }
    }
  }

  return [...keptSimilarities, ...newSimilarities]
}

// ═══════════════ CLUSTERING ═══════════════

/**
 * DBSCAN-inspired BFS clustering.
 */
function detectClusters(
  embeddings: Array<{ id: string; embedding: number[] }>,
  similarities: Array<{ sourceId: string; targetId: string; similarity: number }>,
  minClusterSize: number = 3,
  minSimilarity: number = 0.5
): Array<{
  id: string
  nodeIds: string[]
  centroid: { x: number; y: number }
  radius: number
  averageSimilarity: number
  dominantCategory: string | null
  keywords: string[]
}> {
  // Build adjacency list from similarities above threshold
  const neighbors = new Map<string, Set<string>>()
  const simMap = new Map<string, number>()

  for (const s of similarities) {
    if (s.similarity < minSimilarity) continue
    if (!neighbors.has(s.sourceId)) neighbors.set(s.sourceId, new Set())
    if (!neighbors.has(s.targetId)) neighbors.set(s.targetId, new Set())
    neighbors.get(s.sourceId)!.add(s.targetId)
    neighbors.get(s.targetId)!.add(s.sourceId)
    const key = s.sourceId < s.targetId ? `${s.sourceId}|${s.targetId}` : `${s.targetId}|${s.sourceId}`
    simMap.set(key, s.similarity)
  }

  // BFS to find connected components
  const visited = new Set<string>()
  const clusters: Array<{
    id: string
    nodeIds: string[]
    centroid: { x: number; y: number }
    radius: number
    averageSimilarity: number
    dominantCategory: string | null
    keywords: string[]
  }> = []

  for (const emb of embeddings) {
    if (visited.has(emb.id)) continue
    if (!neighbors.has(emb.id)) continue

    const cluster: string[] = []
    const queue = [emb.id]
    visited.add(emb.id)

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      cluster.push(nodeId)

      const nodeNeighbors = neighbors.get(nodeId)
      if (!nodeNeighbors) continue

      for (const neighbor of nodeNeighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    if (cluster.length >= minClusterSize) {
      // Compute average similarity within cluster
      let simSum = 0
      let simCount = 0
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          const key = cluster[i]! < cluster[j]! ? `${cluster[i]}|${cluster[j]}` : `${cluster[j]}|${cluster[i]}`
          const sim = simMap.get(key)
          if (sim !== undefined) {
            simSum += sim
            simCount++
          }
        }
      }

      // Find top-3 nodes closest to cluster centroid embedding
      const embeddingMap = new Map<string, number[]>()
      for (const e of embeddings) {
        embeddingMap.set(e.id, e.embedding)
      }

      // Compute centroid embedding (average)
      const dim = embeddings[0]?.embedding.length ?? 384
      const centroidEmb = new Float32Array(dim)
      let count = 0
      for (const nid of cluster) {
        const e = embeddingMap.get(nid)
        if (e) {
          for (let d = 0; d < dim; d++) {
            centroidEmb[d]! += e[d]!
          }
          count++
        }
      }
      if (count > 0) {
        for (let d = 0; d < dim; d++) {
          centroidEmb[d]! /= count
        }
      }

      // Find keywords (top-3 nodes closest to centroid)
      const distancesToCentroid = cluster.map(nid => {
        const e = embeddingMap.get(nid)
        if (!e) return { id: nid, dist: Infinity }
        return { id: nid, dist: dotProductSimilarity(e, centroidEmb) }
      }).sort((a, b) => b.dist - a.dist)

      const keywords = distancesToCentroid.slice(0, 3).map(d => d.id)

      clusters.push({
        id: `cluster-${clusters.length}`,
        nodeIds: cluster,
        centroid: { x: 0, y: 0 }, // Position computed on main thread
        radius: 0,
        averageSimilarity: simCount > 0 ? simSum / simCount : 0,
        dominantCategory: null, // Set on main thread from node metadata
        keywords
      })
    }
  }

  return clusters
}

// ═══════════════ HYBRID SEARCH ═══════════════

/**
 * Combines fuzzy text substring match with semantic similarity.
 */
function hybridSearch(
  query: string,
  nodes: Array<{ id: string; content: string; embedding: number[] }>,
  queryEmbedding: number[],
  topK: number = 10
): Array<{ nodeId: string; content: string; similarity: number; matchType: 'exact' | 'semantic' | 'hybrid' }> {
  const queryLower = query.toLowerCase().trim()
  const results: Array<{ nodeId: string; content: string; similarity: number; matchType: 'exact' | 'semantic' | 'hybrid' }> = []

  for (const node of nodes) {
    const contentLower = node.content.toLowerCase()

    // Text match score (0-1)
    let textScore = 0
    if (contentLower === queryLower) {
      textScore = 1.0
    } else if (contentLower.includes(queryLower)) {
      textScore = 0.8
    } else if (queryLower.split(/\s+/).some(word => contentLower.includes(word))) {
      textScore = 0.4
    }

    // Semantic score
    const semanticScore = dotProductSimilarity(queryEmbedding, node.embedding)

    // Combined score with weights
    const textWeight = 0.4
    const semanticWeight = 0.6
    const combinedScore = textScore * textWeight + semanticScore * semanticWeight

    // Determine match type
    let matchType: 'exact' | 'semantic' | 'hybrid' = 'semantic'
    if (textScore > 0 && semanticScore >= 0.3) {
      matchType = 'hybrid'
    } else if (textScore > 0) {
      matchType = 'exact'
    }

    if (combinedScore > 0.15) {
      results.push({
        nodeId: node.id,
        content: node.content,
        similarity: combinedScore,
        matchType
      })
    }
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
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
        // Start loading model with progress updates (includes WebGPU detection + fallback)
        await initEmbeddingModel((progress) => {
          respond(id, 'progress', {
            model: 'embedding',
            progress: progress / 100
          })
        })

        respond(id, 'success', {
          initialized: true,
          webgpu: hasWebGPU,
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
          texts: Array<{ id: string; text: string; contentHash?: number }>
        }

        // Ensure model is loaded
        if (!embeddingPipeline) {
          await initEmbeddingModel((progress) => {
            respond(id, 'progress', { model: 'embedding', progress: progress / 100 })
          })
        }

        // Filter out texts with unchanged content hash
        const textsToEmbed: Array<{ id: string; text: string; index: number }> = []
        const cachedResults: Array<{ id: string; embedding: number[] | null; index: number }> = []

        for (let i = 0; i < texts.length; i++) {
          const item = texts[i]
          if (!item) continue
          if (item.contentHash !== undefined && item.contentHash === contentHashCache.get(item.id)) {
            // Content unchanged — skip embedding (caller should already have it)
            cachedResults.push({ id: item.id, embedding: null, index: i })
          } else {
            textsToEmbed.push({ id: item.id, text: item.text, index: i })
            if (item.contentHash !== undefined) {
              contentHashCache.set(item.id, item.contentHash)
            }
          }
        }

        // True batch inference for texts that need embedding
        const rawTexts = textsToEmbed.map(t => t.text)
        const batchSize = (payload as { batchSize?: number }).batchSize ?? 16
        const batchResults = rawTexts.length > 0
          ? await batchEmbed(rawTexts, batchSize, (completed, _total) => {
              respond(id, 'progress', {
                completed: cachedResults.length + completed,
                total: texts.length,
                nodeId: textsToEmbed[completed - 1]?.id
              })
            })
          : []

        // Build results array (preserving original order)
        const results: Array<{ id: string; embedding: number[] }> = []
        let batchIdx = 0

        for (let i = 0; i < texts.length; i++) {
          const item = texts[i]
          if (!item) continue

          const cached = cachedResults.find(c => c.index === i)
          if (cached) {
            // Skipped — don't include in results (caller already has it)
            continue
          }

          const emb = batchResults[batchIdx]
          if (emb) {
            results.push({ id: item.id, embedding: Array.from(emb) })
          }
          batchIdx++
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

      case 'update-similarities': {
        const { changedNodeIds, embeddings, currentSimilarities, threshold } = payload as {
          changedNodeIds: string[]
          embeddings: Array<{ id: string; embedding: number[] }>
          currentSimilarities: Array<{ sourceId: string; targetId: string; similarity: number }>
          threshold: number
        }

        const similarities = incrementalSimilarityUpdate(
          changedNodeIds,
          embeddings,
          currentSimilarities,
          threshold
        )

        respond(id, 'success', { similarities })
        break
      }

      case 'detect-clusters': {
        const { embeddings, similarities, minClusterSize, minSimilarity } = payload as {
          embeddings: Array<{ id: string; embedding: number[] }>
          similarities: Array<{ sourceId: string; targetId: string; similarity: number }>
          minClusterSize: number
          minSimilarity: number
        }

        const clusters = detectClusters(embeddings, similarities, minClusterSize, minSimilarity)

        respond(id, 'success', { clusters })
        break
      }

      case 'hybrid-search': {
        const { query, nodes, topK } = payload as {
          query: string
          nodes: Array<{ id: string; content: string; embedding: number[] }>
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

        const results = hybridSearch(query, nodes, queryEmbedding, topK)

        respond(id, 'success', { results })
        break
      }

      case 'benchmark-batch-size': {
        // Ensure model is loaded
        if (!embeddingPipeline) {
          await initEmbeddingModel((progress) => {
            respond(id, 'progress', { model: 'embedding', progress: progress / 100 })
          })
        }

        const batchSizes = [4, 8, 16, 32]
        const testTexts = Array.from({ length: 32 }, (_, i) =>
          `Test sentence number ${i + 1} for benchmarking embedding throughput performance`
        )

        const results: Array<{ batchSize: number; throughput: number; avgTime: number }> = []
        let optimalBatchSize = 16

        for (const bs of batchSizes) {
          const start = performance.now()
          const textsForBatch = testTexts.slice(0, bs)

          try {
            await batchEmbed(textsForBatch, bs)
            const elapsed = performance.now() - start

            // Abort if too slow
            if (elapsed > 500) {
              results.push({ batchSize: bs, throughput: bs / (elapsed / 1000), avgTime: elapsed / bs })
              break
            }

            results.push({
              batchSize: bs,
              throughput: bs / (elapsed / 1000),
              avgTime: elapsed / bs
            })
          } catch {
            break
          }
        }

        // Pick optimal: highest throughput
        if (results.length > 0) {
          optimalBatchSize = results.reduce((best, r) =>
            r.throughput > best.throughput ? r : best
          ).batchSize
        }

        respond(id, 'success', { optimalBatchSize, results })
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

        // Compute similarities with all nodes using optimized dot product
        const results = nodeEmbeddings
          .map(node => ({
            nodeId: node.id,
            similarity: dotProductSimilarity(queryEmbedding, node.embedding)
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

            const similarity = dotProductSimilarity(source.embedding, target.embedding)

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
        contentHashCache.clear()
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
