use anyhow::{Context, Result};
use ndarray::{Array1, Array2, Axis};
use ort::session::Session;
use ort::value::Tensor;
use std::path::Path;
use std::time::Instant;
use tokenizers::Tokenizer;

/// Maximum batch size to prevent OOM on GPU.
pub const MAX_BATCH: usize = 32;

/// Target output dimension after Matryoshka truncation.
///
/// This MUST match `EMBEDDING_DIMS` in `server/utils/embeddings.ts` and the
/// `MATRYOSHKA_DIM` constant in `app/workers/ai.worker.ts`. The pgvector
/// column is defined as `vector(256)` and HNSW cosine indexes assume this
/// exact dim — changing it requires a schema migration AND re-embedding
/// every row across web, desktop, and server pipelines.
pub const MATRYOSHKA_DIM: usize = 256;

/// Public alias so call sites (Tauri commands, tests) can reference the
/// canonical 256d constant without hard-coding the number.
pub const EMBEDDING_DIMS: usize = MATRYOSHKA_DIM;

/// Core ONNX embedding engine. Holds a loaded ONNX session and tokenizer.
pub struct EmbeddingEngine {
    session: Session,
    tokenizer: Tokenizer,
    /// The execution provider name actually in use ("coreml", "directml", "cpu").
    /// Surfaced for telemetry / debug UIs so we can verify GPU acceleration is live.
    execution_provider: &'static str,
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
    ///
    /// Execution provider selection is explicit and platform-gated:
    ///   - macOS (Apple Silicon, full model): CoreML actively registered
    ///   - macOS (Apple Silicon, quantized):  CPU (avoids 30s+ CoreML compile)
    ///   - Windows:                           DirectML (DX12 GPU)
    ///   - everything else:                   CPU
    ///
    /// The chosen provider is logged via `tracing::info!("ml: execution_provider=…")`
    /// at startup AND stored on the engine so the IPC layer can include it in
    /// telemetry. If the requested GPU EP fails to register, we fall back to CPU
    /// and log a `warn!` — never silently degrade.
    pub fn new_with_hardware(
        onnx_path: &Path,
        tokenizer_path: &Path,
        hw: &HardwareInfo,
    ) -> Result<Self> {
        tracing::info!("Loading ONNX session from {}", onnx_path.display());

        // Build the session via a self-contained helper that returns the final
        // builder plus the EP name that actually got registered. Doing it this
        // way sidesteps Cargo feature-gating issues (the `directml` feature is
        // only declared on Windows targets) AND the `with_execution_providers`
        // move semantics (it consumes `self` and gives back a `Result<Self>`,
        // so a failed register on macOS would otherwise leave `builder` moved).
        let (builder, mut execution_provider) = build_session_builder(onnx_path, hw)?;

        // A GPU EP (CoreML/DirectML) can register successfully yet still fail to
        // COMPILE the session (e.g. an int8 op the EP doesn't implement). The
        // EP-registration fallback in build_session_builder can't catch that, so
        // guard the commit too: on a non-CPU commit failure, rebuild a plain CPU
        // session. Guarantees the engine always loads — never a hard "AI Error".
        let session = match builder
            .with_intra_threads(num_cpus())?
            .commit_from_file(onnx_path)
        {
            Ok(session) => session,
            Err(e) if execution_provider != "cpu" => {
                tracing::warn!(
                    "{execution_provider} session commit failed ({e}); falling back to CPU"
                );
                execution_provider = "cpu";
                Session::builder()
                    .context("rebuild CPU session builder")?
                    .with_intra_threads(num_cpus())?
                    .commit_from_file(onnx_path)
                    .context("load ONNX model (CPU fallback)")?
            }
            Err(e) => return Err(e).context("load ONNX model"),
        };

        // Visible at startup for ops / debug UI parity-check with the web
        // worker's "[ai-worker] device=…" log line.
        tracing::info!("ml: execution_provider={execution_provider}");

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

        Ok(Self { session, tokenizer, execution_provider })
    }

    /// Name of the execution provider in use ("coreml", "directml", "cpu").
    /// Stable identifier — safe to log/emit in telemetry.
    pub fn execution_provider(&self) -> &'static str {
        self.execution_provider
    }

    /// Run a single dummy inference to pre-allocate memory and warm up the session.
    pub fn warmup(&mut self) -> Result<()> {
        tracing::info!("Running warmup inference...");
        let _ = self.embed("warmup")?;
        tracing::info!("Warmup complete");
        Ok(())
    }

    /// Generate a `MATRYOSHKA_DIM`-dim L2-renormalised embedding for a single text.
    ///
    /// Emits a `tracing::info!` telemetry line with the uniform shape used by
    /// the web worker + server (`runtime=tauri-…, dimensions=256, batch_size=1`),
    /// so latency can be compared across surfaces without parsing different
    /// log formats. Also asserts the output length matches the canonical
    /// `EMBEDDING_DIMS` — a hard guarantee against a regressed model that
    /// would silently write incompatible vectors into pgvector.
    pub fn embed(&mut self, text: &str) -> Result<Vec<f32>> {
        let start = Instant::now();
        let batch = self.embed_batch_inner(&[text])?;
        let mut iter = batch.into_iter();
        let embedding = iter
            .next()
            .ok_or_else(|| anyhow::anyhow!("empty batch result"))?;

        // Boundary assertion: every single-text embedding must be exactly
        // EMBEDDING_DIMS long. Anything else is a parity bug.
        anyhow::ensure!(
            embedding.len() == EMBEDDING_DIMS,
            "embed: dim mismatch — got {}, expected {EMBEDDING_DIMS}",
            embedding.len()
        );

        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
        tracing::info!(
            duration_ms = %format!("{duration_ms:.2}"),
            runtime = %format!("tauri-{}", self.execution_provider),
            dimensions = EMBEDDING_DIMS,
            batch_size = 1,
            "ml: embed"
        );

        Ok(embedding)
    }

    /// Generate embeddings for a batch of texts.
    /// Automatically chunks into sub-batches of MAX_BATCH to prevent OOM.
    pub fn embed_batch(&mut self, texts: &[&str]) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(vec![]);
        }

        let start = Instant::now();
        let mut all_results = Vec::with_capacity(texts.len());

        // Process in bounded chunks
        for chunk_start in (0..texts.len()).step_by(MAX_BATCH) {
            let chunk_end = (chunk_start + MAX_BATCH).min(texts.len());
            let chunk = &texts[chunk_start..chunk_end];
            let chunk_results = self.embed_batch_inner(chunk)?;
            all_results.extend(chunk_results);
        }

        // Boundary assertion on every embedding in the batch — surface any
        // dim drift loudly rather than burying garbage in pgvector.
        for (i, emb) in all_results.iter().enumerate() {
            anyhow::ensure!(
                emb.len() == EMBEDDING_DIMS,
                "embed_batch[{i}]: dim mismatch — got {}, expected {EMBEDDING_DIMS}",
                emb.len()
            );
        }

        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
        tracing::info!(
            duration_ms = %format!("{duration_ms:.2}"),
            runtime = %format!("tauri-{}", self.execution_provider),
            dimensions = EMBEDDING_DIMS,
            batch_size = texts.len(),
            "ml: embed_batch"
        );

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

            // Truncate to Matryoshka target dimensions and L2-renormalize
            let truncated = truncate_matryoshka(&normalized, MATRYOSHKA_DIM);
            results.push(truncated);
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

/// Build the ONNX `SessionBuilder` with the best execution provider available
/// for the current target. Returns the (possibly EP-augmented) builder plus
/// the stable name of the EP that was registered ("coreml", "directml",
/// "cpu"). This is split out so the platform `cfg` gates are isolated and
/// `with_execution_providers`'s consuming semantics don't poison the caller.
fn build_session_builder(
    onnx_path: &Path,
    hw: &HardwareInfo,
) -> Result<(ort::session::builder::SessionBuilder, &'static str)> {
    let builder = ort::session::Session::builder().context("create session builder")?;
    let _ = onnx_path; // EP choice no longer depends on the model variant

    // ── macOS: always CoreML (Neural Engine / GPU) on Apple Silicon ──
    // The compiled MLProgram is cached on disk (ModelCacheDirectory), so the
    // one-time compile (~tens of seconds) only happens on the first launch —
    // the bundled model never changes, so the cache stays valid afterwards.
    // CoreML falls back to CPU here (registration) and again at session commit
    // (new_with_hardware) if the graph can't run on the EP.
    #[cfg(target_os = "macos")]
    {
        if hw.is_apple_silicon {
            let cache_dir = std::env::var_os("HOME")
                .map(std::path::PathBuf::from)
                .map(|home| home.join("Library/Caches/com.neurocanvas.app/coreml"))
                .unwrap_or_else(std::env::temp_dir);
            let _ = std::fs::create_dir_all(&cache_dir);

            tracing::info!(
                "Apple Silicon — registering CoreML EP (Neural Engine/GPU), cache={}",
                cache_dir.display()
            );
            let coreml = ort::execution_providers::CoreMLExecutionProvider::default()
                .with_compute_units(ort::execution_providers::coreml::ComputeUnits::All)
                .with_model_format(ort::execution_providers::coreml::ModelFormat::MLProgram)
                .with_model_cache_dir(cache_dir.to_string_lossy())
                .build();
            match builder.with_execution_providers([coreml]) {
                Ok(b) => {
                    tracing::info!("CoreML EP registered");
                    return Ok((b, "coreml"));
                }
                Err(e) => {
                    tracing::warn!("CoreML EP failed to register, falling back to CPU: {e}");
                    // Builder is consumed by the call — rebuild a fresh one.
                    return Ok((
                        ort::session::Session::builder().context("rebuild session builder after coreml fail")?,
                        "cpu",
                    ));
                }
            }
        }
    }

    // ── Windows: DirectML on DX12-capable GPUs (Intel/AMD/NVIDIA) ──
    // The `directml` feature is declared in Cargo.toml only on Windows
    // targets, so the inner block compiles on Windows and is dead-elided
    // on every other platform (no `cfg(feature = ...)` mismatch warning).
    #[cfg(target_os = "windows")]
    {
        tracing::info!("Windows — registering DirectML EP (DX12)");
        match builder.with_execution_providers([
            ort::execution_providers::DirectMLExecutionProvider::default().build(),
        ]) {
            Ok(b) => {
                tracing::info!("DirectML EP registered");
                return Ok((b, "directml"));
            }
            Err(e) => {
                tracing::warn!("DirectML EP failed, falling back to CPU: {e}");
                return Ok((
                    ort::session::Session::builder().context("rebuild session builder after directml fail")?,
                    "cpu",
                ));
            }
        }
    }

    // Linux / other: CPU only.
    #[cfg(not(target_os = "macos"))]
    let _ = hw; // keep hw param used on non-mac targets

    Ok((builder, "cpu"))
}

/// Truncate a Matryoshka embedding to target dimensions and L2-renormalize.
fn truncate_matryoshka(embedding: &[f32], target_dim: usize) -> Vec<f32> {
    let truncated = &embedding[..target_dim.min(embedding.len())];
    let norm: f32 = truncated.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm == 0.0 {
        return truncated.to_vec();
    }
    truncated.iter().map(|v| v / norm).collect()
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
//
// The dimension test loads the actual bundled quantized model so it exercises
// the full pipeline (tokenizer → ONNX → mean-pool → L2 → Matryoshka). Because
// the model lives under `src-tauri/resources/models/nomic-embed-text-v1.5/`
// the test is gated on the file actually existing — CI without LFS or a
// stripped checkout won't fail spuriously, but local runs will confirm the
// 256d boundary contract end-to-end.
//
// Run locally:
//     cd src-tauri
//     cargo test --lib ml::embedding -- --nocapture
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn bundled_model_paths() -> Option<(PathBuf, PathBuf)> {
        // src-tauri/src/ml/embedding.rs  ->  src-tauri/resources/models/…
        let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("models")
            .join("nomic-embed-text-v1.5");
        let onnx = base.join("model_quantized.onnx");
        let tok = base.join("tokenizer.json");
        if onnx.exists() && tok.exists() {
            Some((onnx, tok))
        } else {
            None
        }
    }

    #[test]
    fn embed_returns_exactly_matryoshka_dim() {
        let Some((onnx, tok)) = bundled_model_paths() else {
            eprintln!("skipping: bundled model not present (run `pnpm fetch-onnx-model`)");
            return;
        };

        let mut engine = EmbeddingEngine::new(&onnx, &tok)
            .expect("load EmbeddingEngine from bundled resources");

        let v = engine.embed("hello").expect("embed");
        assert_eq!(
            v.len(),
            EMBEDDING_DIMS,
            "single embed must be exactly {EMBEDDING_DIMS}d (the pgvector schema is vector(256))"
        );

        // L2-normalised => sum of squares ≈ 1.0
        let norm_sq: f32 = v.iter().map(|x| x * x).sum();
        assert!(
            (norm_sq - 1.0).abs() < 1e-3,
            "embed output must be L2-normalised, got |v|^2 = {norm_sq}"
        );
    }

    #[test]
    fn embed_batch_returns_exactly_matryoshka_dim_for_each() {
        let Some((onnx, tok)) = bundled_model_paths() else {
            eprintln!("skipping: bundled model not present");
            return;
        };

        let mut engine = EmbeddingEngine::new(&onnx, &tok).expect("load engine");

        let texts = ["alpha", "beta gamma", "the quick brown fox"];
        let out = engine
            .embed_batch(&texts)
            .expect("embed_batch");

        assert_eq!(out.len(), texts.len());
        for (i, emb) in out.iter().enumerate() {
            assert_eq!(
                emb.len(),
                EMBEDDING_DIMS,
                "batch[{i}] must be exactly {EMBEDDING_DIMS}d"
            );
        }
    }
}
