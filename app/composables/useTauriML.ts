/**
 * Tauri ML Bridge
 *
 * Wraps `@tauri-apps/api/core` invoke() calls for native ONNX Runtime
 * inference running in the Rust backend.
 */

import { invoke } from '@tauri-apps/api/core'

// ── Response types (mirror Rust serde structs) ──────────────────────

interface InitResult {
  initialized: boolean
  model_loaded: boolean
}

interface EmbedResult {
  embedding: number[]
  dimensions: number
}

interface EmbeddingWithId {
  id: string
  embedding: number[]
}

interface BatchEmbedResult {
  embeddings: EmbeddingWithId[]
  dimensions: number
}

interface SimilarityPair {
  source_id: string
  target_id: string
  similarity: number
}

interface SimilaritiesResult {
  similarities: SimilarityPair[]
  pairs_computed: number
  pairs_above_threshold: number
}

interface HardwareCapabilities {
  is_apple_silicon: boolean
  has_discrete_gpu: boolean
  capable_hardware: boolean
}

// ── Public API ──────────────────────────────────────────────────────

export function useTauriML() {
  /**
   * Load ONNX model session.
   * @param modelVariant — `"quantized"` (default) or `"full"`
   */
  async function initialize(
    onProgress?: (progress: number) => void,
    modelVariant: 'quantized' | 'full' = 'quantized'
  ): Promise<{ initialized: boolean; modelLoaded: boolean }> {
    onProgress?.(0.1)
    try {
      // Add a timeout — ONNX model loading can hang with certain execution providers
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('ONNX model loading timed out after 30s')), 30000)
      )
      const init = invoke<InitResult>('ml_init', { modelVariant })

      const result = await Promise.race([init, timeout])
      onProgress?.(1.0)
      return {
        initialized: result.initialized,
        modelLoaded: result.model_loaded
      }
    } catch (e) {
      console.error('[TauriML] ml_init failed:', e)
      return { initialized: false, modelLoaded: false }
    }
  }

  /** Generate a single embedding. */
  async function embed(text: string): Promise<number[]> {
    const result = await invoke<EmbedResult>('ml_embed', { text })
    return result.embedding
  }

  /** Batch embed texts with IDs. */
  async function embedBatch(
    texts: Array<{ id: string; text: string }>
  ): Promise<{ embeddings: EmbeddingWithId[]; dimensions: number }> {
    const result = await invoke<BatchEmbedResult>('ml_embed_batch', { texts })
    return result
  }

  /** Compute pairwise similarities above threshold. */
  async function computeSimilarities(
    embeddings: Array<{ id: string; embedding: number[] }>,
    threshold: number
  ): Promise<{
    similarities: Array<{ sourceId: string; targetId: string; similarity: number }>
    pairsComputed: number
    pairsAboveThreshold: number
  }> {
    const result = await invoke<SimilaritiesResult>('ml_compute_similarities', {
      embeddings,
      threshold
    })

    // Map snake_case Rust response → camelCase
    return {
      similarities: result.similarities.map(s => ({
        sourceId: s.source_id,
        targetId: s.target_id,
        similarity: s.similarity
      })),
      pairsComputed: result.pairs_computed,
      pairsAboveThreshold: result.pairs_above_threshold
    }
  }

  /**
   * Download the full-precision model from HuggingFace.
   * Progress can be polled via ml_get_progress.
   */
  async function downloadFullModel(
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    // Start polling progress in the background
    let polling = true
    if (onProgress) {
      const poll = async () => {
        while (polling) {
          try {
            const progress = await invoke<number>('ml_get_progress')
            onProgress(progress)
          } catch {
            // ignore polling errors
          }
          await new Promise(r => setTimeout(r, 250))
        }
      }
      poll()
    }

    try {
      const result = await invoke<boolean>('ml_download_full_model')
      onProgress?.(1.0)
      return result
    } finally {
      polling = false
    }
  }

  /** Check if the full-precision model has been downloaded. */
  async function isFullModelAvailable(): Promise<boolean> {
    return invoke<boolean>('ml_is_full_model_available')
  }

  /** Delete the downloaded full-precision model. */
  async function deleteFullModel(): Promise<boolean> {
    return invoke<boolean>('ml_delete_full_model')
  }

  /** Get hardware capabilities for ML model selection. */
  async function getHardwareCapabilities(): Promise<{
    isAppleSilicon: boolean
    hasDiscreteGpu: boolean
    capableHardware: boolean
  }> {
    const result = await invoke<HardwareCapabilities>('get_hardware_capabilities')
    return {
      isAppleSilicon: result.is_apple_silicon,
      hasDiscreteGpu: result.has_discrete_gpu,
      capableHardware: result.capable_hardware
    }
  }

  return {
    initialize,
    embed,
    embedBatch,
    computeSimilarities,
    downloadFullModel,
    isFullModelAvailable,
    deleteFullModel,
    getHardwareCapabilities
  }
}
