//! Directory listing (lazy, one level at a time) and workspace file scans
//! for quick-open.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::errors::AppError;

use super::{is_markdown_extension, should_ignore};

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryDto {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub size: Option<u64>,
    pub modified_ms: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListOptions {
    pub show_hidden: Option<bool>,
    /// Extra ignore names on top of the built-in defaults.
    pub extra_ignores: Option<Vec<String>>,
}

fn entry_dto(entry: &fs::DirEntry) -> Option<DirEntryDto> {
    let metadata = entry.metadata().ok()?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    let path = entry.path();
    Some(DirEntryDto {
        name: entry.file_name().to_string_lossy().into_owned(),
        path: path.display().to_string(),
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        is_symlink: metadata.is_symlink(),
        size: if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        },
        modified_ms,
        extension: path.extension().map(|e| e.to_string_lossy().into_owned()),
    })
}

/// Sort: directories first, then case-insensitive name order.
fn sort_entries(entries: &mut [DirEntryDto]) {
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
}

pub fn list_dir(path: &Path, options: &ListOptions) -> Result<Vec<DirEntryDto>, AppError> {
    if !path.is_dir() {
        return Err(AppError::NotFound(path.display().to_string()));
    }
    let show_hidden = options.show_hidden.unwrap_or(false);
    let extra = options.extra_ignores.clone().unwrap_or_default();
    let mut out = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| AppError::from_io(e, path))? {
        let entry = entry.map_err(|e| AppError::from_io(e, path))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if should_ignore(&name, &extra) {
            continue;
        }
        if !show_hidden && name.starts_with('.') {
            continue;
        }
        if let Some(dto) = entry_dto(&entry) {
            out.push(dto);
        }
    }
    sort_entries(&mut out);
    Ok(out)
}

pub fn list_directory(
    path: String,
    options: Option<ListOptions>,
) -> Result<Vec<DirEntryDto>, AppError> {
    list_dir(Path::new(&path), &options.unwrap_or_default())
}

/// Collect Markdown/text files under `root` (relative paths) for quick-open.
/// Skips ignored directories; capped at `max_results` to stay responsive.
pub fn list_workspace_files(
    root: String,
    max_results: Option<usize>,
    extra_ignores: Option<Vec<String>>,
) -> Result<Vec<String>, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::NotFound(root));
    }
    let max = max_results.unwrap_or(2000);
    let extra = extra_ignores.unwrap_or_default();
    let mut out = Vec::new();
    let mut walker = WalkDir::new(root_path).into_iter();
    while let Some(entry) = walker.next() {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue, // skip unreadable entries instead of failing the scan
        };
        let name = entry.file_name().to_string_lossy();
        if entry.depth() > 0 && entry.file_type().is_dir() && should_ignore(&name, &extra) {
            walker.skip_current_dir();
            continue;
        }
        if entry.depth() > 0 && name.starts_with('.') {
            if entry.file_type().is_dir() {
                walker.skip_current_dir();
            }
            continue;
        }
        if entry.file_type().is_file() && is_markdown_extension(entry.path()) {
            if let Ok(rel) = entry.path().strip_prefix(root_path) {
                out.push(rel.display().to_string());
                if out.len() >= max {
                    break;
                }
            }
        }
    }
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("b.md"), "b").unwrap();
        fs::write(dir.path().join("a.md"), "a").unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("sub").join("c.txt"), "c").unwrap();
        fs::write(dir.path().join("notes.png"), "x").unwrap();
        fs::write(dir.path().join(".hidden.md"), "h").unwrap();
        fs::create_dir(dir.path().join("node_modules")).unwrap();
        fs::write(dir.path().join("node_modules").join("d.md"), "d").unwrap();
        dir
    }

    #[test]
    fn lists_one_level_sorted_dirs_first() {
        let dir = fixture();
        let entries = list_dir(dir.path(), &ListOptions::default()).unwrap();
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        // dirs first, then files by name; hidden & ignored excluded
        assert_eq!(names, vec!["sub", "a.md", "b.md", "notes.png"]);
    }

    #[test]
    fn show_hidden_includes_dotfiles_but_not_ignores() {
        let dir = fixture();
        let entries = list_dir(
            dir.path(),
            &ListOptions {
                show_hidden: Some(true),
                extra_ignores: None,
            },
        )
        .unwrap();
        assert!(entries.iter().any(|e| e.name == ".hidden.md"));
        assert!(!entries.iter().any(|e| e.name == "node_modules"));
    }

    #[test]
    fn workspace_files_only_markdown_and_respects_ignores() {
        let dir = fixture();
        let files = list_workspace_files(dir.path().display().to_string(), None, None).unwrap();
        assert_eq!(files, vec!["a.md", "b.md", "sub/c.txt"]);
    }

    #[test]
    fn workspace_files_respects_cap() {
        let dir = fixture();
        let files = list_workspace_files(dir.path().display().to_string(), Some(1), None).unwrap();
        assert_eq!(files.len(), 1);
    }
}
