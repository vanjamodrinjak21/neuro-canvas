use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};

use crate::ml::{embedding::EmbeddingEngine, model_manager, state::MLState};

// ── Response types ───────────────────────────────────────────────────

#[derive(Serialize)]
pub struct InitResult {
    pub initialized: bool,
    pub model_loaded: bool,
}

#[derive(Serialize)]
pub struct EmbedResult {
    pub embedding: Vec<f32>,
    pub dimensions: usize,
}

#[derive(Deserialize)]
pub struct TextWithId {
    pub id: String,
    pub text: String,
}

#[derive(Serialize)]
pub struct EmbeddingWithId {
    pub id: String,
    pub embedding: Vec<f32>,
}

#[derive(Serialize)]
pub struct BatchEmbedResult {
    pub embeddings: Vec<EmbeddingWithId>,
    pub dimensions: usize,
}

#[derive(Deserialize)]
pub struct EmbeddingEntry {
    pub id: String,
    pub embedding: Vec<f32>,
}

#[derive(Serialize)]
pub struct SimilarityPair {
    pub source_id: String,
    pub target_id: String,
    pub similarity: f32,
}

#[derive(Serialize)]
pub struct SimilaritiesResult {
    pub similarities: Vec<SimilarityPair>,
    pub pairs_computed: usize,
    pub pairs_above_threshold: usize,
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    completed: usize,
    total: usize,
    phase: String,
}

// ── Commands ─────────────────────────────────────────────────────────

/// Load ONNX model. Accepts a `model_variant` parameter:
/// - `"quantized"` (default) — bundled quantized model
/// - `"full"` — downloaded full-precision model from app data
#[tauri::command]
pub async fn ml_init(
    app: tauri::AppHandle,
    state: State<'_, MLState>,
    model_variant: Option<String>,
) -> Result<InitResult, String> {
    let variant = model_manager::ModelVariant::from_str(
        model_variant.as_deref().unwrap_or("quantized"),
    );

    // Drop existing engine so we can re-initialize with a different variant
    {
        let mut engine_guard = state.engine.lock().await;
        *engine_guard = None;
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resolve resource dir: {e}"))?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;

    let paths = model_manager::resolve_model_variant(&resource_dir, &app_data_dir, &variant)
        .map_err(|e| format!("resolve_model: {e}"))?;

    let _ = state.progress_tx.send(0.5);

    // Load the ONNX session (blocking CPU work – run on blocking thread)
    let onnx = paths.onnx.clone();
    let tok = paths.tokenizer.clone();
    let mut engine = tokio::task::spawn_blocking(move || EmbeddingEngine::new(&onnx, &tok))
        .await
        .map_err(|e| format!("spawn_blocking join: {e}"))?
        .map_err(|e| format!("EmbeddingEngine::new: {e}"))?;

    // Run warmup inference to pre-allocate memory
    tokio::task::spawn_blocking(move || {
        if let Err(e) = engine.warmup() {
            tracing::warn!("Model warmup failed (non-fatal): {e}");
        }
        engine
    })
    .await
    .map(|engine| {
        let mut engine_guard = state.engine.blocking_lock();
        *engine_guard = Some(engine);
    })
    .map_err(|e| format!("warmup spawn_blocking join: {e}"))?;

    let _ = state.progress_tx.send(1.0);

    Ok(InitResult {
        initialized: true,
        model_loaded: true,
    })
}

/// Single text embedding.
#[tauri::command]
pub async fn ml_embed(text: String, state: State<'_, MLState>) -> Result<EmbedResult, String> {
    let mut engine_guard = state.engine.lock().await;
    let engine = engine_guard
        .as_mut()
        .ok_or("ML engine not initialised – call ml_init first")?;

    let embedding = engine.embed(&text).map_err(|e| format!("embed: {e}"))?;
    let dimensions = embedding.len();

    Ok(EmbedResult {
        embedding,
        dimensions,
    })
}

/// Batch embeddings with IDs (mirrors web worker's `embed-batch` shape).
/// Emits `ml:progress` events per chunk for progress tracking.
#[tauri::command]
pub async fn ml_embed_batch(
    app: tauri::AppHandle,
    texts: Vec<TextWithId>,
    state: State<'_, MLState>,
) -> Result<BatchEmbedResult, String> {
    let mut engine_guard = state.engine.lock().await;
    let engine = engine_guard
        .as_mut()
        .ok_or("ML engine not initialised – call ml_init first")?;

    let total = texts.len();
    let chunk_size = 32; // MAX_BATCH from EmbeddingEngine
    let mut all_embeddings = Vec::with_capacity(total);
    let mut completed: usize = 0;
    let _ = completed; // suppress unused-assignment warning; updated in loop for progress

    for chunk_start in (0..total).step_by(chunk_size) {
        let chunk_end = (chunk_start + chunk_size).min(total);
        let chunk_texts: Vec<&str> = texts[chunk_start..chunk_end]
            .iter()
            .map(|t| t.text.as_str())
            .collect();

        let raw = engine
            .embed_batch(&chunk_texts)
            .map_err(|e| format!("embed_batch: {e}"))?;

        for (i, emb) in raw.into_iter().enumerate() {
            all_embeddings.push(EmbeddingWithId {
                id: texts[chunk_start + i].id.clone(),
                embedding: emb,
            });
        }

        completed = chunk_end;

        // Emit progress event
        let _ = app.emit("ml:progress", ProgressPayload {
            completed,
            total,
            phase: "embedding".to_string(),
        });
    }

    let dimensions = all_embeddings.first().map(|v| v.embedding.len()).unwrap_or(384);

    Ok(BatchEmbedResult {
        embeddings: all_embeddings,
        dimensions,
    })
}

/// Compute all pairwise similarities above `threshold`.
#[tauri::command]
pub async fn ml_compute_similarities(
    embeddings: Vec<EmbeddingEntry>,
    threshold: f32,
    state: State<'_, MLState>,
) -> Result<SimilaritiesResult, String> {
    // This is pure math – doesn't need the engine, but we validate it's ready
    let _guard = state.engine.lock().await;

    let n = embeddings.len();
    let pairs_computed = n * (n.saturating_sub(1)) / 2;
    let mut similarities = Vec::new();

    for i in 0..n {
        for j in (i + 1)..n {
            let sim =
                EmbeddingEngine::cosine_similarity(&embeddings[i].embedding, &embeddings[j].embedding);
            if sim >= threshold {
                similarities.push(SimilarityPair {
                    source_id: embeddings[i].id.clone(),
                    target_id: embeddings[j].id.clone(),
                    similarity: sim,
                });
            }
        }
    }

    let pairs_above_threshold = similarities.len();

    Ok(SimilaritiesResult {
        similarities,
        pairs_computed,
        pairs_above_threshold,
    })
}

/// Poll model download / init progress (0.0 → 1.0).
#[tauri::command]
pub async fn ml_get_progress(state: State<'_, MLState>) -> Result<f32, String> {
    Ok(*state.progress_rx.borrow())
}

/// Download the full-precision model from HuggingFace.
/// Progress is reported via the shared progress channel (poll with ml_get_progress).
#[tauri::command]
pub async fn ml_download_full_model(
    app: tauri::AppHandle,
    state: State<'_, MLState>,
) -> Result<bool, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;

    // Reset progress
    let _ = state.progress_tx.send(0.0);

    model_manager::download_full_model(&app_data_dir, &state.progress_tx)
        .await
        .map_err(|e| format!("download_full_model: {e}"))?;

    Ok(true)
}

/// Check if the full-precision model has been downloaded.
#[tauri::command]
pub async fn ml_is_full_model_available(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;

    Ok(model_manager::is_full_model_downloaded(&app_data_dir))
}

/// Delete the downloaded full-precision model.
#[tauri::command]
pub async fn ml_delete_full_model(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("resolve app data dir: {e}"))?;

    model_manager::delete_full_model(&app_data_dir)
        .map_err(|e| format!("delete_full_model: {e}"))?;

    Ok(true)
}
