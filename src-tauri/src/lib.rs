mod commands;

use commands::{OpenCodeState, cleanup_server};
use tauri::{Manager, State};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(OpenCodeState::default())
        .invoke_handler(tauri::generate_handler![
            commands::start_opencode_server,
            commands::stop_opencode_server,
            commands::get_opencode_status,
            commands::check_opencode_installed,
            commands::get_opencode_version,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Clean up OpenCode server when the window is closed
                let state: State<OpenCodeState> = window.state();
                cleanup_server(state.inner());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
