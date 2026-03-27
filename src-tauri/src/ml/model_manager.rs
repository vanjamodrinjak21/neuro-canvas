use anyhow::Result;
use std::path::{Path, PathBuf};
use tokio::sync::watch;

/// Paths to the two required model artefacts.
pub struct ModelPaths {
    pub onnx: PathBuf,
    pub tokenizer: PathBuf,
}

/// Model variant selector
pub enum ModelVariant {
    Quantized,
    Full,
}

impl ModelVariant {
    pub fn from_str(s: &str) -> Self {
        match s {
            "full" => Self::Full,
            _ => Self::Quantized,
        }
    }
}

/// Resolve model files for the given variant.
/// - `"quantized"` → bundled resources (existing behavior)
/// - `"full"` → downloaded to `$APPDATA/models/all-MiniLM-L6-v2-full/`
pub fn resolve_model_variant(
    resource_dir: &Path,
    app_data_dir: &Path,
    variant: &ModelVariant,
) -> Result<ModelPaths> {
    match variant {
        ModelVariant::Quantized => resolve_bundled_model(resource_dir),
        ModelVariant::Full => resolve_full_model(app_data_dir),
    }
}

/// Resolve the bundled quantized model files from the app's resource directory.
fn resolve_bundled_model(resource_dir: &Path) -> Result<ModelPaths> {
    let dir = resource_dir
        .join("resources")
        .join("models")
        .join("all-MiniLM-L6-v2");

    let onnx = dir.join("model_quantized.onnx");
    let tokenizer = dir.join("tokenizer.json");

    anyhow::ensure!(
        onnx.exists(),
        "Bundled ONNX model not found at {}",
        onnx.display()
    );
    anyhow::ensure!(
        tokenizer.exists(),
        "Bundled tokenizer not found at {}",
        tokenizer.display()
    );

    Ok(ModelPaths { onnx, tokenizer })
}

/// Resolve the downloaded full-precision model from app data.
fn resolve_full_model(app_data_dir: &Path) -> Result<ModelPaths> {
    let dir = full_model_dir(app_data_dir);
    let onnx = dir.join("model.onnx");
    let tokenizer = dir.join("tokenizer.json");

    anyhow::ensure!(
        onnx.exists(),
        "Full model not found at {} — download it first",
        onnx.display()
    );
    anyhow::ensure!(
        tokenizer.exists(),
        "Full model tokenizer not found at {}",
        tokenizer.display()
    );

    Ok(ModelPaths { onnx, tokenizer })
}

/// Keep backward compat: resolve bundled quantized model (used by existing code).
pub fn resolve_model(resource_dir: &Path) -> Result<ModelPaths> {
    resolve_bundled_model(resource_dir)
}

/// Directory where the full model is stored.
fn full_model_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir
        .join("models")
        .join("all-MiniLM-L6-v2-full")
}

/// Check if the full-precision model has been downloaded.
pub fn is_full_model_downloaded(app_data_dir: &Path) -> bool {
    let dir = full_model_dir(app_data_dir);
    dir.join("model.onnx").exists() && dir.join("tokenizer.json").exists()
}

/// Delete the downloaded full-precision model to reclaim space.
pub fn delete_full_model(app_data_dir: &Path) -> Result<()> {
    let dir = full_model_dir(app_data_dir);
    if dir.exists() {
        std::fs::remove_dir_all(&dir)?;
    }
    Ok(())
}

/// HuggingFace base URL for all-MiniLM-L6-v2 (non-quantized).
const HF_BASE: &str =
    "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main";

/// Download the full-precision model from HuggingFace.
/// Reports progress (0.0 → 1.0) via the provided watch channel sender.
pub async fn download_full_model(
    app_data_dir: &Path,
    progress_tx: &watch::Sender<f32>,
) -> Result<()> {
    let dir = full_model_dir(app_data_dir);
    std::fs::create_dir_all(&dir)?;

    let client = reqwest::Client::new();

    // Files to download: (remote filename, local filename, approximate weight for progress)
    let files: &[(&str, &str, f32)] = &[
        ("onnx/model.onnx", "model.onnx", 0.9),
        ("tokenizer.json", "tokenizer.json", 0.1),
    ];

    let mut cumulative = 0.0_f32;

    for &(remote, local, weight) in files {
        let url = format!("{HF_BASE}/{remote}");
        let dest = dir.join(local);

        tracing::info!("Downloading {} → {}", url, dest.display());

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("HTTP request failed for {remote}: {e}"))?;

        if !response.status().is_success() {
            anyhow::bail!(
                "Failed to download {remote}: HTTP {}",
                response.status()
            );
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        let mut file = tokio::fs::File::create(&dest).await?;

        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;

        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| anyhow::anyhow!("download stream error: {e}"))?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            if total_size > 0 {
                let file_progress = downloaded as f32 / total_size as f32;
                let overall = cumulative + file_progress * weight;
                let _ = progress_tx.send(overall.min(0.99));
            }
        }

        file.flush().await?;
        cumulative += weight;
        let _ = progress_tx.send(cumulative.min(0.99));
    }

    let _ = progress_tx.send(1.0);
    tracing::info!("Full model download complete");
    Ok(())
}
