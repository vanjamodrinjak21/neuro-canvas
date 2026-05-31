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

    // `mut` is only required when the single-instance plugin is added below
    // (Windows / Linux); on macOS the binding stays immutable, so silence the
    // unused-mut warning without losing the cfg-gated mutation path.
    #[cfg_attr(not(any(target_os = "windows", target_os = "linux")), allow(unused_mut))]
    let mut builder = tauri::Builder::default();

    // ── single-instance + deep-link forwarder (Windows / Linux only) ────
    // On Windows and Linux, the OS spawns a new process when a deep-link URL
    // (e.g. `neurocanvas://...` or Google's reverse-client-ID scheme) is
    // opened while the app is already running. Without the single-instance
    // plugin, that new process would silently exit and the running window
    // would never see the OAuth `code`, so Google sign-in would just hang on
    // the "Open NeuroCanvas?" browser prompt.
    //
    // The plugin must be registered FIRST (per Tauri docs) and its callback
    // a) brings the existing window to the front, and b) feeds the deep-link
    // URL argv back through tauri-plugin-deep-link via the enabled
    // `deep-link` feature, which re-emits `deep-link://new-url`. The JS
    // composable's `onOpenUrl` listener picks it up unchanged.
    //
    // macOS is intentionally skipped — its NSApplicationDelegate delivers
    // deep links natively to the running process, so adding single-instance
    // there would suppress legitimate re-launches without benefit.
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        use tauri::Manager;
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, _argv, _cwd| {
                // Re-focus the existing window so the user sees the OAuth
                // completion instead of an orphan background process.
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                // The `deep-link` feature of tauri-plugin-single-instance
                // already forwards the URL argv into the deep-link plugin's
                // `deep-link://new-url` event, so nothing else is needed here.
            },
        ));
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:neurocanvas.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "create_initial_tables",
                        sql: include_str!("../migrations/001_initial.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(ml::state::MLState::new())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // ── Windows-only: idempotent runtime scheme registration ──────
            //
            // The NSIS installer (see `src-tauri/windows/hooks.nsh`, AER-11)
            // is the PRIMARY source of truth — it writes both URL schemes
            // (`neurocanvas` and the Google reverse-client-ID scheme) to
            // SHCTX\Software\Classes at install time, picking HKLM for
            // per-machine installs and HKCU for current-user installs.
            //
            // This runtime call is a SAFETY NET for cases the installer
            // didn't cover:
            //   - Portable / sideloaded binaries that never ran the .exe
            //     installer (e.g. `cargo run --release`, dev builds).
            //   - Upgrades from a version that pre-dates AER-11 where the
            //     installer-written keys are absent.
            //
            // `register_all()` writes HKCU only, which is harmless if HKLM
            // already has the same payload — Windows resolves HKLM first
            // for ShellExecute, so the per-machine entries take precedence.
            // macOS auto-registers via Info.plist (handled by the bundler),
            // so this block is intentionally Windows-only.
            #[cfg(target_os = "windows")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(e) = app.deep_link().register_all() {
                    // Non-fatal — the user can still sign in via credentials
                    // and the installer-written keys may already be present.
                    tracing::warn!("failed to register deep-link schemes: {e}");
                }
            }

            // Pre-warm the ONNX embedding engine in the background so the
            // first user-facing search isn't blocked behind a cold model
            // load. Non-blocking — Tauri main thread keeps the window
            // responsive while the bundled quantized model compiles.
            commands::ml::spawn_preload_default_model(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
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
