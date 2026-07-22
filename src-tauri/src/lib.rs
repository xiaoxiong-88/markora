//! Markora core library: wires the Tauri command surface to the backend
//! modules and registers the official plugins.

mod commands;
mod errors;
mod filesystem;
mod search;
mod watcher;

use search::SearchState;
use std::sync::Mutex;
use tauri::{Emitter, Manager, RunEvent};
use watcher::WatcherState;

/// File paths delivered by the OS "Open With" mechanism (macOS `Opened` run
/// event) that arrived before the frontend attached its listener — notably
/// cold launches. Drained by the frontend via `take_pending_opens`.
#[derive(Default)]
pub(crate) struct PendingOpens(pub(crate) Mutex<Vec<String>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .manage(SearchState::default())
        .manage(WatcherState::default())
        .manage(PendingOpens::default())
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::atomic_write,
            commands::create_file,
            commands::create_dir,
            commands::rename_path,
            commands::copy_path,
            commands::delete_to_trash,
            commands::reveal_in_finder,
            commands::list_directory,
            commands::list_workspace_files,
            commands::copy_image_to_assets,
            commands::save_image_bytes,
            commands::path_exists,
            commands::file_mtime,
            commands::workspace_search,
            commands::cancel_search,
            commands::watch_path,
            commands::unwatch_path,
            commands::take_pending_opens,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Markora");

    app.run(|handle, event| {
        // macOS "Open With" / dropping a file onto the dock icon.
        if let RunEvent::Opened { urls } = event {
            let paths: Vec<String> = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            if paths.is_empty() {
                return;
            }
            handle
                .state::<PendingOpens>()
                .0
                .lock()
                .unwrap()
                .extend(paths.iter().cloned());
            let _ = handle.emit("markora://open-files", paths);
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
    });
}
