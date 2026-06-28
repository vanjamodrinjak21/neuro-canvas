/**
 * AI Worker for NeuroCanvas - Semantic Constellation Engine
 *
 * Handles AI operations in a separate thread using transformers.js:
 * - Real embeddings using nomic-embed-text-v1.5 (~111MB, 768→256d Matryoshka)
 * - True batch inference for performance
 * - Optimized dot-product similarity (pre-normalized embeddings)
 * - Incremental similarity updates
 * - DBSCAN-inspired clustering
 * - Hybrid text + semantic search
 */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { SEMANTIC_EMBEDDING_MODEL_ID } from '../utils/embeddingModel'
import { rankHybridSearch, dotProductSimilarity } from '../utils/hybridSearch'

// Configure transformers.js to use IndexedDB for model caching
env.cacheDir = 'indexeddb://neurocanvas-models-v2'
env.allowLocalModels = false

/** Target dimension for Matryoshka truncation — must match Rust EMBEDDING_DIMS + server EMBEDDING_DIMS. */
const MATRYOSHKA_DIM = 256

/**
 * Quantization dtype fallback chain. We try the smallest/fastest first, then
 * step up if the model variant isn't published on HuggingFace or fails to
 * load. Why this order:
 *   - `q4f16`  ≈  60 MB, fastest on WebGPU (FP16 activations + INT4 weights)
 *   - `q8`     ≈  37 MB, our previous default for WASM; well-tested
 *   - `fp16`   ≈ 138 MB, near-fp32 quality, GPU-friendly
 *   - `fp32`   ≈ 274 MB, last-resort native precision
 *
 * Recall on the AER-5 cluster fixture is the gate — anything that drops
 * below recall@3 = 0.9 we reject at evaluation time. The default `q8`
 * variant has been shipping in production since AER-5 and passes the
 * existing parity tests, so it's a safe baseline.
 */
type EmbeddingDtype = 'q4f16' | 'q8' | 'fp16' | 'fp32'
const DTYPE_FALLBACK_CHAIN: readonly EmbeddingDtype[] = ['q4f16', 'q8', 'fp16', 'fp32'] as const

/**
 * Truncate a Matryoshka embedding to target dimensions and L2-renormalize.
 * nomic-embed-text-v1.5 outputs 768d; we store 256d for efficiency.
 */
function truncateAndNormalize(data: Float32Array, _sourceDim: number, targetDim: number): Float32Array {
  const truncated = new Float32Array(targetDim)
  for (let i = 0; i < targetDim; i++) {
    truncated[i] = data[i]!
  }
  let norm = 0
  for (let i = 0; i < targetDim; i++) {
    norm += truncated[i]! * truncated[i]!
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < targetDim; i++) {
      truncated[i]! /= norm
    }
  }
  return truncated
}

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
let hasWebGPU = false
let activeDevice: 'webgpu' | 'wasm' = 'wasm'
let activeDtype: EmbeddingDtype = 'q8'

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

// Initialize the embedding model.
//
// Two axes of selection happen here:
//   1. Device — WebGPU if the adapter is available + a pipeline actually
//      compiles; otherwise WASM (with SIMD + threading, transformers.js
//      handles ORT setup internally).
//   2. Dtype  — walk DTYPE_FALLBACK_CHAIN, stopping at the first variant
//      that loads. q4f16 is smallest/fastest; q8 is our previous default and
//      passes the AER-5 parity fixture; fp16/fp32 are quality fallbacks if a
//      quant variant isn't published on HF for this exact model.
//
// Logs a one-time `[ai-worker] device=… dtype=…` line on success so dev/ops
// can confirm acceleration is live in the console without spelunking.
async function initEmbeddingModel(onProgress?: (progress: number) => void): Promise<void> {
  if (embeddingPipeline || isModelLoading) return

  isModelLoading = true

  try {
    hasWebGPU = await checkWebGPU()
    activeDevice = hasWebGPU ? 'webgpu' : 'wasm'

    const progressCallback = (progress: { status: string; progress?: number; loaded?: number; total?: number }) => {
      if (progress.status === 'progress' && progress.progress !== undefined) {
        onProgress?.(progress.progress)
      } else if (progress.status === 'done') {
        onProgress?.(100)
      }
    }

    console.log(`[AI Worker] Initializing nomic-embed-text-v1.5 (device=${activeDevice})…`)

    embeddingPipeline = await loadPipelineWithFallback(
      activeDevice,
      DTYPE_FALLBACK_CHAIN,
      progressCallback,
    )

    // If WebGPU failed completely we silently flipped to WASM inside the
    // helper. Mirror that back to the public flag so the UI doesn't claim
    // GPU acceleration when CPU was what actually loaded.
    if (activeDevice === 'wasm') hasWebGPU = false

    // Single, structured device + dtype log. Matches Tauri's
    // `ml: execution_provider=…` shape so cross-surface telemetry parses
    // with the same regex.
    console.info(`[ai-worker] device=${activeDevice} dtype=${activeDtype} dimensions=${MATRYOSHKA_DIM}`)
    console.log(`[AI Worker] Embedding model loaded successfully (device=${activeDevice}, dtype=${activeDtype})`)
  } catch (error) {
    console.error('[AI Worker] Failed to load embedding model:', error)
    throw error
  } finally {
    isModelLoading = false
  }
}

/**
 * Try each dtype in `chain` on `preferredDevice`. On the first hard failure
 * across all dtypes on WebGPU, drop to WASM and retry the chain there. Sets
 * the module-scope `activeDevice` + `activeDtype` to whatever ended up
 * actually loading. Throws the LAST error if every combination fails.
 */
async function loadPipelineWithFallback(
  preferredDevice: 'webgpu' | 'wasm',
  chain: readonly EmbeddingDtype[],
  progressCallback: (p: { status: string; progress?: number; loaded?: number; total?: number }) => void,
): Promise<FeatureExtractionPipeline> {
  const devicesToTry: Array<'webgpu' | 'wasm'> = preferredDevice === 'webgpu'
    ? ['webgpu', 'wasm']
    : ['wasm']

  let lastError: unknown = null

  for (const device of devicesToTry) {
    for (const dtype of chain) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = await (pipeline as any)(
          'feature-extraction',
          SEMANTIC_EMBEDDING_MODEL_ID,
          { device, dtype, progress_callback: progressCallback }
        ) as FeatureExtractionPipeline
        activeDevice = device
        activeDtype = dtype
        return p
      } catch (err) {
        lastError = err
        // Quant variant probably doesn't exist on HF for this model — try
        // the next one. Logged as warn so curious devs can see the chain.
        console.warn(`[AI Worker] dtype=${dtype} device=${device} failed, trying next:`, err)
      }
    }
    // All dtypes failed on this device. If we were on WebGPU, drop to WASM.
    if (device === 'webgpu') {
      console.warn('[AI Worker] WebGPU exhausted — falling back to WASM')
    }
  }

  throw lastError ?? new Error('All dtype/device combinations failed to load')
}

// ═══════════════ BATCH EMBEDDING ═══════════════

/**
 * True batch inference — processes multiple texts in a single forward pass.
 * Falls back to sequential for single items.
 *
 * Default batch size is 32 to saturate WebGPU (matches Tauri MAX_BATCH).
 * For very long inputs the caller can pass a smaller batchSize to avoid
 * GPU memory pressure.
 *
 * Emits one telemetry line per call with the cross-surface uniform shape:
 *   `[ai-worker-telemetry] {"duration_ms":N,"runtime":"webgpu","dimensions":256,"batch_size":N}`
 */
async function batchEmbed(
  texts: string[],
  batchSize: number = 32,
  onProgress?: (completed: number, total: number) => void
): Promise<Float32Array[]> {
  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized')
  }

  const startedAt = performance.now()
  const results: Float32Array[] = []
  const total = texts.length

  for (let start = 0; start < total; start += batchSize) {
    const end = Math.min(start + batchSize, total)
    const batch = texts.slice(start, end)

    const output = await embeddingPipeline(batch, {
      pooling: 'mean',
      normalize: true
    })

    const data = output.data as Float32Array
    const nativeDim = data.length / batch.length
    for (let i = 0; i < batch.length; i++) {
      const offset = i * nativeDim
      const fullEmbedding = new Float32Array(data.buffer, data.byteOffset + offset * 4, nativeDim)
      const truncated = truncateAndNormalize(fullEmbedding, nativeDim, MATRYOSHKA_DIM)
      // Boundary assertion: truncated MUST be exactly MATRYOSHKA_DIM long.
      // Anything else means our truncator broke OR the native model changed
      // shape mid-flight — fail loud rather than ship a mis-shaped vector
      // into pgvector / similarity computation.
      if (truncated.length !== MATRYOSHKA_DIM) {
        throw new Error(
          `batchEmbed: dim mismatch — got ${truncated.length}, expected ${MATRYOSHKA_DIM}`
        )
      }
      results.push(truncated)
    }

    onProgress?.(Math.min(end, total), total)
  }

  emitEmbedTelemetry('batchEmbed', performance.now() - startedAt, total)
  return results
}

/**
 * Emit a structured telemetry line for a single embed call. The shape
 * matches Tauri's `tracing::info!` fields and the server's structured log so
 * cross-surface latency dashboards can use one schema.
 *
 * Stays a console.info (not a postMessage) — keeping the worker thread free
 * of UI plumbing for what is effectively a debug breadcrumb.
 */
function emitEmbedTelemetry(op: 'embed' | 'batchEmbed', durationMs: number, batchSize: number): void {
  const payload = {
    op,
    duration_ms: Number(durationMs.toFixed(2)),
    runtime: activeDevice,
    dtype: activeDtype,
    dimensions: MATRYOSHKA_DIM,
    batch_size: batchSize,
  }
  console.info(`[ai-worker-telemetry] ${JSON.stringify(payload)}`)
}

// Generate embedding for a single text
async function generateEmbedding(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    throw new Error('Embedding model not initialized')
  }

  const startedAt = performance.now()
  const output = await embeddingPipeline(text, {
    pooling: 'mean',
    normalize: true
  })

  const fullData = output.data as Float32Array
  const truncated = truncateAndNormalize(fullData, fullData.length, MATRYOSHKA_DIM)
  if (truncated.length !== MATRYOSHKA_DIM) {
    throw new Error(
      `generateEmbedding: dim mismatch — got ${truncated.length}, expected ${MATRYOSHKA_DIM}`
    )
  }
  emitEmbedTelemetry('embed', performance.now() - startedAt, 1)
  return Array.from(truncated)
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
    const fullData = output.data as Float32Array
    const truncated = truncateAndNormalize(fullData, fullData.length, MATRYOSHKA_DIM)
    embeddings.push(Array.from(truncated))
    onProgress?.(i + 1, texts.length)
  }

  return embeddings
}

// ═══════════════ SIMILARITY ═══════════════

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
      const dim = embeddings[0]?.embedding.length ?? 256
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

// Hybrid (text + semantic) ranking lives in ~/utils/hybridSearch (rankHybridSearch),
// shared verbatim with the native main-thread path in useAI.

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
          // Surface the device + dtype that actually ended up loading so the
          // UI / debug panel reports reality, not the requested config.
          device: activeDevice,
          dtype: activeDtype,
          dimensions: MATRYOSHKA_DIM,
          availableModels: ['nomic-embed-text-v1.5']
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

        // True batch inference for texts that need embedding.
        // Default batch size 32 matches the Tauri MAX_BATCH and saturates
        // WebGPU well for short-to-medium inputs (< 256 tokens). Callers
        // can lower it via `payload.batchSize` for very long inputs to
        // avoid OOM on memory-constrained GPUs.
        const rawTexts = textsToEmbed.map(t => `search_document: ${t.text}`)
        const batchSize = (payload as { batchSize?: number }).batchSize ?? 32
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
          dimensions: results[0]?.embedding.length || 256
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

        const results = rankHybridSearch(query, nodes, queryEmbedding, topK)

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
