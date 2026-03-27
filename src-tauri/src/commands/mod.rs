//! Tauri Commands Module
//!
//! This module contains all the commands that can be invoked from the frontend.

pub mod ml;

use serde::{Deserialize, Serialize};

/// System information response
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub platform: String,
    pub arch: String,
    pub os_version: String,
    pub hostname: String,
}

/// Hardware capability info for ML model selection
#[derive(Debug, Serialize, Deserialize)]
pub struct HardwareCapabilities {
    pub is_apple_silicon: bool,
    pub has_discrete_gpu: bool,
    pub capable_hardware: bool,
}

/// Simple greeting command for testing
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to NeuroCanvas.", name)
}

/// Get system information
#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        os_version: "Unknown".to_string(),
        hostname: hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "Unknown".to_string()),
    }
}

/// Detect hardware capabilities for ML model selection
#[tauri::command]
pub async fn get_hardware_capabilities() -> HardwareCapabilities {
    let is_apple_silicon = cfg!(target_arch = "aarch64") && cfg!(target_os = "macos");

    let has_discrete_gpu = detect_discrete_gpu();

    HardwareCapabilities {
        is_apple_silicon,
        has_discrete_gpu,
        capable_hardware: is_apple_silicon || has_discrete_gpu,
    }
}

/// Check for a discrete (non-Intel) GPU on macOS via system_profiler
fn detect_discrete_gpu() -> bool {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("system_profiler")
            .arg("SPDisplaysDataType")
            .arg("-detailLevel")
            .arg("mini")
            .output();

        if let Ok(output) = output {
            let text = String::from_utf8_lossy(&output.stdout);
            // Apple Silicon has "Apple M" GPU; discrete GPUs have AMD/NVIDIA
            let has_apple_gpu = text.contains("Apple M");
            let has_amd = text.contains("AMD");
            let has_nvidia = text.contains("NVIDIA");
            return has_apple_gpu || has_amd || has_nvidia;
        }
        false
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}
