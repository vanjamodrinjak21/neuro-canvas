use std::sync::Arc;
use tokio::sync::{watch, Mutex};

use super::embedding::EmbeddingEngine;

/// Tauri-managed state for the ML subsystem.
pub struct MLState {
    pub engine: Arc<Mutex<Option<EmbeddingEngine>>>,
    pub progress_tx: watch::Sender<f32>,
    pub progress_rx: watch::Receiver<f32>,
}

impl MLState {
    pub fn new() -> Self {
        let (tx, rx) = watch::channel(0.0_f32);
        Self {
            engine: Arc::new(Mutex::new(None)),
            progress_tx: tx,
            progress_rx: rx,
        }
    }
}
