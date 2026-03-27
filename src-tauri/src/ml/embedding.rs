use anyhow::{Context, Result};
use ndarray::{Array1, Array2, Axis};
use ort::session::Session;
use ort::value::Tensor;
use std::path::Path;
use tokenizers::Tokenizer;

/// Maximum batch size to prevent OOM on GPU.
const MAX_BATCH: usize = 32;

/// Core ONNX embedding engine. Holds a loaded ONNX session and tokenizer.
pub struct EmbeddingEngine {
    session: Session,
    tokenizer: Tokenizer,
}

/// Hardware info for choosing execution providers.
pub struct HardwareInfo {
    pub is_apple_silicon: bool,
}

impl HardwareInfo {
    pub fn detect() -> Self {
        #[cfg(target_os = "macos")]
        let is_apple_silicon = std::env::consts::ARCH == "aarch64";
        #[cfg(not(target_os = "macos"))]
        let is_apple_silicon = false;

        Self { is_apple_silicon }
    }
}

impl EmbeddingEngine {
    /// Load an ONNX session + tokenizer from the given paths.
    /// Selects the best execution provider based on hardware.
    pub fn new(onnx_path: &Path, tokenizer_path: &Path) -> Result<Self> {
        let hw = HardwareInfo::detect();
        Self::new_with_hardware(onnx_path, tokenizer_path, &hw)
    }

    /// Load an ONNX session + tokenizer with explicit hardware info.
    pub fn new_with_hardware(
        onnx_path: &Path,
        tokenizer_path: &Path,
        hw: &HardwareInfo,
    ) -> Result<Self> {
        tracing::info!("Loading ONNX session from {}", onnx_path.display());

        let mut builder = Session::builder()
            .context("create session builder")?;

        // Try CoreML on Apple Silicon for acceleration
        #[cfg(target_os = "macos")]
        if hw.is_apple_silicon {
            tracing::info!("Apple Silicon detected — attempting CoreML EP");
            // CoreML EP requires the `coreml` feature on ort.
            // If not available, fall through to CPU gracefully.
            match builder.with_execution_providers([
                ort::execution_providers::CoreMLExecutionProvider::default().build(),
            ]) {
                Ok(b) => {
                    builder = b;
                    tracing::info!("CoreML EP registered");
                }
                Err(e) => {
                    tracing::warn!("CoreML EP failed, falling back to CPU: {e}");
                }
            }
        }

        #[cfg(not(target_os = "macos"))]
        let _ = hw; // suppress unused warning

        let session = builder
            .with_intra_threads(num_cpus())?
            .commit_from_file(onnx_path)
            .context("load ONNX model")?;

        tracing::info!("Loading tokenizer from {}", tokenizer_path.display());
        let mut tokenizer = Tokenizer::from_file(tokenizer_path)
            .map_err(|e| anyhow::anyhow!("load tokenizer: {e}"))?;

        // Configure tokenizer padding and truncation for batch inference
        let pad_id = tokenizer.get_vocab(true).get("[PAD]").copied().unwrap_or(0);
        tokenizer.with_padding(Some(tokenizers::PaddingParams {
            strategy: tokenizers::PaddingStrategy::BatchLongest,
            pad_id,
            pad_token: "[PAD]".to_string(),
            ..Default::default()
        }));
        tokenizer.with_truncation(Some(tokenizers::TruncationParams {
            max_length: 512,
            ..Default::default()
        })).map_err(|e| anyhow::anyhow!("set truncation: {e}"))?;

        Ok(Self { session, tokenizer })
    }

    /// Run a single dummy inference to pre-allocate memory and warm up the session.
    pub fn warmup(&mut self) -> Result<()> {
        tracing::info!("Running warmup inference...");
        let _ = self.embed("warmup")?;
        tracing::info!("Warmup complete");
        Ok(())
    }

    /// Generate a 384-dim L2-normalised embedding for a single text.
    pub fn embed(&mut self, text: &str) -> Result<Vec<f32>> {
        let batch = self.embed_batch(&[text])?;
        batch
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("empty batch result"))
    }

    /// Generate embeddings for a batch of texts.
    /// Automatically chunks into sub-batches of MAX_BATCH to prevent OOM.
    pub fn embed_batch(&mut self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let mut all_results = Vec::with_capacity(texts.len());

        // Process in bounded chunks
        for chunk_start in (0..texts.len()).step_by(MAX_BATCH) {
            let chunk_end = (chunk_start + MAX_BATCH).min(texts.len());
            let chunk = &texts[chunk_start..chunk_end];
            let chunk_results = self.embed_batch_inner(chunk)?;
            all_results.extend(chunk_results);
        }

        Ok(all_results)
    }

    /// Inner batch embedding for a single chunk.
    fn embed_batch_inner(&mut self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        let batch_size = texts.len();

        // Tokenize — padding and truncation handled by tokenizer config
        let encodings = self
            .tokenizer
            .encode_batch(texts.to_vec(), true)
            .map_err(|e| anyhow::anyhow!("tokenize: {e}"))?;

        let max_len = encodings.iter().map(|e| e.get_ids().len()).max().unwrap_or(0);

        // Build flat input vectors: input_ids, attention_mask, token_type_ids
        let mut input_ids = vec![0i64; batch_size * max_len];
        let mut attention_mask = vec![0i64; batch_size * max_len];
        let mut token_type_ids = vec![0i64; batch_size * max_len];

        for (i, enc) in encodings.iter().enumerate() {
            let ids = enc.get_ids();
            let mask = enc.get_attention_mask();
            let type_ids = enc.get_type_ids();

            for (j, (&id, (&m, &t))) in ids.iter().zip(mask.iter().zip(type_ids.iter())).enumerate()
            {
                let idx = i * max_len + j;
                input_ids[idx] = id as i64;
                attention_mask[idx] = m as i64;
                token_type_ids[idx] = t as i64;
            }
        }

        // Create ort Tensor values
        let shape = vec![batch_size as i64, max_len as i64];
        let ids_tensor = Tensor::<i64>::from_array(
            (shape.clone(), input_ids),
        )
        .context("create input_ids tensor")?;
        let mask_tensor = Tensor::<i64>::from_array(
            (shape.clone(), attention_mask),
        )
        .context("create attention_mask tensor")?;
        let type_tensor = Tensor::<i64>::from_array(
            (shape, token_type_ids),
        )
        .context("create token_type_ids tensor")?;

        // Run inference
        let outputs = self
            .session
            .run(ort::inputs![ids_tensor, mask_tensor, type_tensor])
            .context("ONNX run")?;

        // The first output is last_hidden_state: [batch, seq_len, hidden_dim]
        let (hidden_shape, hidden_data) = outputs[0]
            .try_extract_tensor::<f32>()
            .context("extract tensor")?;

        // hidden_shape dimensions: [batch_size, seq_len, hidden_dim]
        let hidden_dim = hidden_shape[2] as usize;

        let hidden_nd = Array2::from_shape_vec(
            [batch_size * max_len, hidden_dim],
            hidden_data.to_vec(),
        )
        .context("reshape hidden")?
        .into_shape_with_order([batch_size, max_len, hidden_dim])
        .context("reshape 3d")?;

        // Mean pooling with attention mask
        let mask_f32: Array2<f32> = Array2::from_shape_vec(
            [batch_size, max_len],
            encodings
                .iter()
                .flat_map(|e| e.get_attention_mask().iter().map(|&v| v as f32))
                .collect(),
        )
        .context("mask f32")?;

        let mut results = Vec::with_capacity(batch_size);
        for i in 0..batch_size {
            let token_embeddings = hidden_nd.index_axis(Axis(0), i); // [seq_len, hidden_dim]
            let mask_row = mask_f32.row(i); // [seq_len]
            let mask_sum: f32 = mask_row.sum().max(1e-9);

            // Weighted sum: multiply each token embedding by its mask value
            let mut pooled = Array1::<f32>::zeros(hidden_dim);
            for (j, m) in mask_row.iter().enumerate() {
                if *m > 0.0 {
                    let tok = token_embeddings.row(j);
                    pooled = pooled + &(&tok * *m);
                }
            }
            pooled /= mask_sum;

            // L2 normalize
            let norm = pooled.iter().map(|v| v * v).sum::<f32>().sqrt().max(1e-12);
            let normalized: Vec<f32> = pooled.iter().map(|v| v / norm).collect();
            results.push(normalized);
        }

        Ok(results)
    }

    /// Cosine similarity between two L2-normalised vectors (= dot product).
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }
        a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
    }
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}
