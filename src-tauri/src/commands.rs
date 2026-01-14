use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

// State wrapper for the OpenCode server process
pub struct OpenCodeState {
    pub process: Mutex<Option<OpenCodeProcess>>,
}

impl Default for OpenCodeState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }
}

pub struct OpenCodeProcess {
    pub child: Child,
    pub port: u16,
    pub project_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub port: u16,
    pub url: String,
    pub project_path: String,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeConfig {
    pub provider: String,
    pub model: String,
    pub api_key: Option<String>,
}

/// Find an available port for the OpenCode server
fn find_available_port() -> Option<u16> {
    portpicker::pick_unused_port()
}

/// Start the OpenCode server for a given project path
#[tauri::command]
pub async fn start_opencode_server(
    state: State<'_, OpenCodeState>,
    project_path: String,
    config: Option<OpenCodeConfig>,
) -> Result<ServerInfo, String> {
    let mut guard = state.process.lock().map_err(|e| e.to_string())?;

    // If server is already running for the same project, return its info
    if let Some(ref server) = *guard {
        if server.project_path == project_path {
            return Ok(ServerInfo {
                port: server.port,
                url: format!("http://127.0.0.1:{}", server.port),
                project_path: server.project_path.clone(),
                running: true,
            });
        }
        // Different project - need to stop first
        // Kill the existing process
        if let Some(mut old_server) = guard.take() {
            let _ = old_server.child.kill();
            let _ = old_server.child.wait();
        }
    }

    // Find an available port
    let port = find_available_port().ok_or("No available ports")?;

    // Build the command
    let mut cmd = Command::new("opencode");
    cmd.args(["serve", "--port", &port.to_string(), "--hostname", "127.0.0.1"]);
    cmd.current_dir(&project_path);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Set environment variables for the provider/model if provided
    if let Some(cfg) = config {
        if let Some(api_key) = cfg.api_key {
            match cfg.provider.as_str() {
                "openrouter" => {
                    cmd.env("OPENROUTER_API_KEY", api_key);
                }
                "anthropic" => {
                    cmd.env("ANTHROPIC_API_KEY", api_key);
                }
                "openai" => {
                    cmd.env("OPENAI_API_KEY", api_key);
                }
                "google" => {
                    cmd.env("GOOGLE_API_KEY", api_key);
                }
                _ => {}
            }
        }
    }

    // Spawn the process
    let child = cmd.spawn().map_err(|e| format!("Failed to start opencode: {}", e))?;

    let server = OpenCodeProcess {
        child,
        port,
        project_path: project_path.clone(),
    };

    let info = ServerInfo {
        port,
        url: format!("http://127.0.0.1:{}", port),
        project_path,
        running: true,
    };

    *guard = Some(server);

    Ok(info)
}

/// Stop the OpenCode server
#[tauri::command]
pub async fn stop_opencode_server(state: State<'_, OpenCodeState>) -> Result<(), String> {
    let mut guard = state.process.lock().map_err(|e| e.to_string())?;

    if let Some(mut server) = guard.take() {
        server
            .child
            .kill()
            .map_err(|e| format!("Failed to kill opencode process: {}", e))?;
        server
            .child
            .wait()
            .map_err(|e| format!("Failed to wait for opencode process: {}", e))?;
    }

    Ok(())
}

/// Get the current OpenCode server status
#[tauri::command]
pub async fn get_opencode_status(state: State<'_, OpenCodeState>) -> Result<Option<ServerInfo>, String> {
    let guard = state.process.lock().map_err(|e| e.to_string())?;

    match &*guard {
        Some(server) => Ok(Some(ServerInfo {
            port: server.port,
            url: format!("http://127.0.0.1:{}", server.port),
            project_path: server.project_path.clone(),
            running: true,
        })),
        None => Ok(None),
    }
}

/// Check if opencode is installed
#[tauri::command]
pub async fn check_opencode_installed() -> bool {
    Command::new("opencode")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Get the opencode version
#[tauri::command]
pub async fn get_opencode_version() -> Result<String, String> {
    let output = Command::new("opencode")
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to get opencode version: {}", e))?;

    if output.status.success() {
        String::from_utf8(output.stdout)
            .map(|s| s.trim().to_string())
            .map_err(|e| e.to_string())
    } else {
        Err("opencode not found or failed to get version".to_string())
    }
}

/// Helper to cleanup server on app exit
pub fn cleanup_server(state: &OpenCodeState) {
    if let Ok(mut guard) = state.process.lock() {
        if let Some(mut server) = guard.take() {
            let _ = server.child.kill();
            let _ = server.child.wait();
        }
    }
}
