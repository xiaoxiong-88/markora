//! Filesystem watching built on the `notify` crate.
//!
//! One watcher instance is kept per app run; `watch_path` replaces the
//! previous watch (the app watches the workspace root plus parent dirs of
//! open files via multiple watch roots on the same watcher). Events are
//! forwarded to the frontend as `markora://fs-event` with a simplified kind.

use std::path::Path;
use std::sync::Mutex;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::errors::AppError;

pub const FS_EVENT: &str = "markora://fs-event";

#[derive(Default)]
pub struct WatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    /// Roots currently watched, so re-registration does not duplicate.
    roots: Mutex<Vec<String>>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FsEventDto {
    /// "create" | "modify" | "remove" | "rename" | "other"
    pub kind: String,
    pub paths: Vec<String>,
}

fn simplify_kind(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Modify(notify::event::ModifyKind::Name(_)) => "rename",
        EventKind::Modify(_) => "modify",
        EventKind::Remove(_) => "remove",
        _ => "other",
    }
}

pub fn watch_path(
    app: AppHandle,
    state: tauri::State<'_, WatcherState>,
    path: String,
) -> Result<(), AppError> {
    let watch_root = Path::new(&path);
    if !watch_root.exists() {
        return Err(AppError::NotFound(path));
    }

    // Lazily create the single watcher, forwarding events to the frontend.
    {
        let mut guard = state.watcher.lock().unwrap();
        if guard.is_none() {
            let app_handle = app.clone();
            let watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let dto = FsEventDto {
                        kind: simplify_kind(&event.kind).to_string(),
                        paths: event
                            .paths
                            .iter()
                            .map(|p| p.display().to_string())
                            .collect(),
                    };
                    let _ = app_handle.emit(FS_EVENT, dto);
                }
            })
            .map_err(|e| AppError::Watch(e.to_string()))?;
            *guard = Some(watcher);
        }
    }

    let mut roots = state.roots.lock().unwrap();
    if roots.iter().any(|r| r == &path) {
        return Ok(());
    }
    let mut guard = state.watcher.lock().unwrap();
    let watcher = guard.as_mut().expect("watcher initialized above");
    watcher
        .watch(watch_root, RecursiveMode::Recursive)
        .map_err(|e| AppError::Watch(e.to_string()))?;
    roots.push(path);
    Ok(())
}

pub fn unwatch_path(state: tauri::State<'_, WatcherState>, path: String) -> Result<(), AppError> {
    let mut roots = state.roots.lock().unwrap();
    if let Some(pos) = roots.iter().position(|r| r == &path) {
        roots.remove(pos);
        let mut guard = state.watcher.lock().unwrap();
        if let Some(watcher) = guard.as_mut() {
            watcher
                .unwatch(Path::new(&path))
                .map_err(|e| AppError::Watch(e.to_string()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kind_simplification() {
        assert_eq!(
            simplify_kind(&EventKind::Create(notify::event::CreateKind::File)),
            "create"
        );
        assert_eq!(
            simplify_kind(&EventKind::Modify(notify::event::ModifyKind::Name(
                notify::event::RenameMode::Both
            ))),
            "rename"
        );
        assert_eq!(
            simplify_kind(&EventKind::Remove(notify::event::RemoveKind::File)),
            "remove"
        );
        assert_eq!(
            simplify_kind(&EventKind::Modify(notify::event::ModifyKind::Data(
                notify::event::DataChange::Content
            ))),
            "modify"
        );
    }
}
