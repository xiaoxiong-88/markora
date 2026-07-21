//! Markora core library: wires the Tauri command surface to the backend
//! modules and registers the official plugins.

mod commands;
mod errors;
mod filesystem;
mod search;
mod watcher;

use search::SearchState;
use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .manage(SearchState::default())
        .manage(WatcherState::default())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Markora");
}
