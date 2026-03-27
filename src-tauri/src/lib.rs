//! NeuroCanvas - Tauri Backend Library
//!
//! This module provides the Rust backend functionality for NeuroCanvas,
//! including native commands and platform-specific optimizations.

pub mod commands;
pub mod ml;

/// Initialize logging for development (non-panicking)
fn init_logging() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("neurocanvas=debug".parse().unwrap()),
        )
        .try_init();
}

/// Main entry point for the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .manage(ml::state::MLState::new())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_system_info,
            commands::get_hardware_capabilities,
            commands::ml::ml_init,
            commands::ml::ml_embed,
            commands::ml::ml_embed_batch,
            commands::ml::ml_compute_similarities,
            commands::ml::ml_get_progress,
            commands::ml::ml_download_full_model,
            commands::ml::ml_is_full_model_available,
            commands::ml::ml_delete_full_model,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("FATAL: Tauri failed to start: {e}");
            eprintln!("FATAL: Debug info: {e:?}");
            std::process::exit(1);
        });
}
