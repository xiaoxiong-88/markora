//! Tauri command surface. Thin wrappers over the module implementations so
//! `generate_handler!` can reference the macro-generated items in one place.

use tauri::State;

use crate::errors::AppError;
use crate::filesystem::list::{self, DirEntryDto, ListOptions};
use crate::filesystem::ops::{self, OpResultDto};
use crate::filesystem::read::{self, FileContentDto};
use crate::filesystem::write::{self, WriteOptions, WriteResultDto};
use crate::search::{self, SearchOptions, SearchResultDto, SearchState};
use crate::watcher::{self, WatcherState};

#[tauri::command]
pub fn read_file(path: String) -> Result<FileContentDto, AppError> {
    read::read_file(path)
}

#[tauri::command]
pub fn atomic_write(
    path: String,
    content: String,
    options: Option<WriteOptions>,
) -> Result<WriteResultDto, AppError> {
    write::atomic_write(path, content, options)
}

#[tauri::command]
pub fn create_file(path: String, content: Option<String>) -> Result<OpResultDto, AppError> {
    ops::create_file(path, content)
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<OpResultDto, AppError> {
    ops::create_dir(path)
}

#[tauri::command]
pub fn rename_path(from: String, to: String) -> Result<OpResultDto, AppError> {
    ops::rename_path(from, to)
}

#[tauri::command]
pub fn copy_path(from: String, to: String) -> Result<OpResultDto, AppError> {
    ops::copy_path(from, to)
}

#[tauri::command]
pub fn delete_to_trash(paths: Vec<String>) -> Result<(), AppError> {
    ops::delete_to_trash(paths)
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), AppError> {
    ops::reveal_in_finder(path)
}

#[tauri::command]
pub fn list_directory(
    path: String,
    options: Option<ListOptions>,
) -> Result<Vec<DirEntryDto>, AppError> {
    list::list_directory(path, options)
}

#[tauri::command]
pub fn list_workspace_files(
    root: String,
    max_results: Option<usize>,
    extra_ignores: Option<Vec<String>>,
) -> Result<Vec<String>, AppError> {
    list::list_workspace_files(root, max_results, extra_ignores)
}

#[tauri::command]
pub fn workspace_search(
    state: State<'_, SearchState>,
    root: String,
    query: String,
    options: Option<SearchOptions>,
) -> Result<SearchResultDto, AppError> {
    search::workspace_search(state, root, query, options)
}

#[tauri::command]
pub fn cancel_search(state: State<'_, SearchState>) {
    search::cancel_search(state)
}

#[tauri::command]
pub fn watch_path(
    app: tauri::AppHandle,
    state: State<'_, WatcherState>,
    path: String,
) -> Result<(), AppError> {
    watcher::watch_path(app, state, path)
}

#[tauri::command]
pub fn unwatch_path(state: State<'_, WatcherState>, path: String) -> Result<(), AppError> {
    watcher::unwatch_path(state, path)
}

#[tauri::command]
pub fn copy_image_to_assets(
    source_path: String,
    document_dir: String,
    asset_dir: String,
) -> Result<String, AppError> {
    crate::filesystem::assets::copy_image_to_assets(source_path, document_dir, asset_dir)
}

#[tauri::command]
pub fn save_image_bytes(
    bytes: Vec<u8>,
    extension: String,
    document_dir: String,
    asset_dir: String,
) -> Result<String, AppError> {
    crate::filesystem::assets::save_image_bytes(bytes, extension, document_dir, asset_dir)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    crate::filesystem::assets::path_exists(path)
}

#[tauri::command]
pub fn file_mtime(path: String) -> Option<u64> {
    crate::filesystem::assets::file_mtime(path)
}
