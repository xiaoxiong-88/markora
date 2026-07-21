//! Workspace-wide text search over Markdown/text files.
//!
//! Runs on a blocking thread (the command is synchronous), never on the UI
//! thread. A new search cancels the previous one; `cancel_search` sets an
//! atomic flag that the scan checks between files and between lines.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::errors::AppError;
use crate::filesystem::{is_markdown_extension, should_ignore};

/// Files larger than this are skipped by default (4 MiB).
const DEFAULT_MAX_FILE_SIZE: u64 = 4 * 1024 * 1024;
const DEFAULT_MAX_RESULTS: usize = 500;
/// A NUL byte in the first chunk marks a file as binary.
const BINARY_SNIFF_BYTES: usize = 8192;

#[derive(Default)]
pub struct SearchState {
    cancel_flag: Mutex<Option<Arc<AtomicBool>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub case_sensitive: Option<bool>,
    pub is_regex: Option<bool>,
    pub max_file_size: Option<u64>,
    pub max_results: Option<usize>,
    pub extra_ignores: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatchDto {
    pub path: String,
    pub line: u32,
    /// Character offsets of the match inside `line_text`.
    pub match_start: u32,
    pub match_end: u32,
    pub line_text: String,
    pub context_before: Option<String>,
    pub context_after: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    pub matches: Vec<SearchMatchDto>,
    pub truncated: bool,
    pub cancelled: bool,
    pub searched_files: u32,
}

fn build_matcher(
    query: &str,
    case_sensitive: bool,
    is_regex: bool,
) -> Result<regex::Regex, AppError> {
    let pattern = if is_regex {
        query.to_string()
    } else {
        regex::escape(query)
    };
    regex::RegexBuilder::new(&pattern)
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|e| AppError::InvalidPath(format!("invalid search pattern: {e}")))
}

fn is_binary(bytes: &[u8]) -> bool {
    bytes[..bytes.len().min(BINARY_SNIFF_BYTES)].contains(&0)
}

/// Convert a byte offset within `s` to a character offset.
fn byte_to_char_idx(s: &str, byte_idx: usize) -> u32 {
    s[..byte_idx].chars().count() as u32
}

fn search_file(
    path: &Path,
    matcher: &regex::Regex,
    max_file_size: u64,
    max_results: usize,
    out: &mut Vec<SearchMatchDto>,
    cancel: &AtomicBool,
) -> Result<bool, AppError> {
    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(false),
    };
    if metadata.len() > max_file_size {
        return Ok(false);
    }
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(_) => return Ok(false),
    };
    if is_binary(&bytes) {
        return Ok(false);
    }
    let Ok(text) = std::str::from_utf8(&bytes) else {
        return Ok(false);
    };

    let lines: Vec<&str> = text.lines().collect();
    let mut truncated = false;
    for (idx, line) in lines.iter().enumerate() {
        if cancel.load(Ordering::Relaxed) {
            return Err(AppError::SearchCancelled);
        }
        for m in matcher.find_iter(line) {
            out.push(SearchMatchDto {
                path: path.display().to_string(),
                line: (idx + 1) as u32,
                match_start: byte_to_char_idx(line, m.start()),
                match_end: byte_to_char_idx(line, m.end()),
                line_text: line.chars().take(500).collect(),
                context_before: idx
                    .checked_sub(1)
                    .and_then(|i| lines.get(i))
                    .map(|s| s.to_string()),
                context_after: lines.get(idx + 1).map(|s| s.to_string()),
            });
            if out.len() >= max_results {
                truncated = true;
                return Ok(truncated);
            }
        }
    }
    Ok(truncated)
}

pub fn workspace_search(
    state: tauri::State<'_, SearchState>,
    root: String,
    query: String,
    options: Option<SearchOptions>,
) -> Result<SearchResultDto, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::NotFound(root));
    }
    let options = options.unwrap_or(SearchOptions {
        case_sensitive: None,
        is_regex: None,
        max_file_size: None,
        max_results: None,
        extra_ignores: None,
    });
    if query.is_empty() {
        return Ok(SearchResultDto {
            matches: vec![],
            truncated: false,
            cancelled: false,
            searched_files: 0,
        });
    }

    // Starting a new search cancels any in-flight one.
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = state.cancel_flag.lock().unwrap();
        if let Some(prev) = guard.replace(cancel.clone()) {
            prev.store(true, Ordering::Relaxed);
        }
    }

    let matcher = build_matcher(
        &query,
        options.case_sensitive.unwrap_or(false),
        options.is_regex.unwrap_or(false),
    )?;
    let max_file_size = options.max_file_size.unwrap_or(DEFAULT_MAX_FILE_SIZE);
    let max_results = options.max_results.unwrap_or(DEFAULT_MAX_RESULTS);
    let extra = options.extra_ignores.unwrap_or_default();

    let mut matches = Vec::new();
    let mut truncated = false;
    let mut searched_files = 0u32;

    let mut walker = WalkDir::new(root_path).into_iter();
    while let Some(entry) = walker.next() {
        if cancel.load(Ordering::Relaxed) {
            let mut guard = state.cancel_flag.lock().unwrap();
            *guard = None;
            return Ok(SearchResultDto {
                matches,
                truncated,
                cancelled: true,
                searched_files,
            });
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.file_name().to_string_lossy();
        if entry.depth() > 0 && entry.file_type().is_dir() {
            if should_ignore(&name, &extra) || name.starts_with('.') {
                walker.skip_current_dir();
            }
            continue;
        }
        if !entry.file_type().is_file() || !is_markdown_extension(entry.path()) {
            continue;
        }
        searched_files += 1;
        if search_file(
            entry.path(),
            &matcher,
            max_file_size,
            max_results,
            &mut matches,
            &cancel,
        )? {
            truncated = true;
            break;
        }
    }

    {
        let mut guard = state.cancel_flag.lock().unwrap();
        *guard = None;
    }
    Ok(SearchResultDto {
        matches,
        truncated,
        cancelled: false,
        searched_files,
    })
}

pub fn cancel_search(state: tauri::State<'_, SearchState>) {
    let guard = state.cancel_flag.lock().unwrap();
    if let Some(flag) = guard.as_ref() {
        flag.store(true, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    // Serialize access to the shared SearchState across tests.
    static TEST_LOCK: StdMutex<()> = StdMutex::new(());

    fn fixture() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.md"), "hello world\nsecond HELLO line\n").unwrap();
        fs::write(dir.path().join("b.txt"), "nothing here\n").unwrap();
        fs::write(dir.path().join("bin.md"), b"hello\0world".as_slice()).unwrap();
        fs::create_dir(dir.path().join("node_modules")).unwrap();
        fs::write(dir.path().join("node_modules").join("c.md"), "hello\n").unwrap();
        dir
    }

    fn run_search(
        state: &SearchState,
        root: &Path,
        query: &str,
        options: Option<SearchOptions>,
    ) -> Result<SearchResultDto, AppError> {
        // Call the inner logic directly (State wrapper is trivial).
        let root_path = root;
        let options = options.unwrap_or(SearchOptions {
            case_sensitive: None,
            is_regex: None,
            max_file_size: None,
            max_results: None,
            extra_ignores: None,
        });
        let cancel = Arc::new(AtomicBool::new(false));
        {
            let mut guard = state.cancel_flag.lock().unwrap();
            if let Some(prev) = guard.replace(cancel.clone()) {
                prev.store(true, Ordering::Relaxed);
            }
        }
        let matcher = build_matcher(
            query,
            options.case_sensitive.unwrap_or(false),
            options.is_regex.unwrap_or(false),
        )?;
        let mut matches = Vec::new();
        let mut searched_files = 0u32;
        let mut walker = WalkDir::new(root_path).into_iter();
        while let Some(entry) = walker.next() {
            let entry = entry.unwrap();
            let name = entry.file_name().to_string_lossy();
            if entry.depth() > 0 && entry.file_type().is_dir() {
                if should_ignore(&name, &[]) || name.starts_with('.') {
                    walker.skip_current_dir();
                }
                continue;
            }
            if !entry.file_type().is_file() || !is_markdown_extension(entry.path()) {
                continue;
            }
            searched_files += 1;
            search_file(
                entry.path(),
                &matcher,
                4 * 1024 * 1024,
                500,
                &mut matches,
                &cancel,
            )?;
        }
        Ok(SearchResultDto {
            matches,
            truncated: false,
            cancelled: false,
            searched_files,
        })
    }

    #[test]
    fn finds_case_insensitive_matches_and_skips_binary_and_ignored() {
        let _g = TEST_LOCK.lock().unwrap();
        let dir = fixture();
        let state = SearchState::default();
        let res = run_search(&state, dir.path(), "hello", None).unwrap();
        // a.md has 2 matches; bin.md is binary; node_modules is ignored.
        assert_eq!(res.matches.len(), 2);
        assert!(res.matches.iter().all(|m| m.path.ends_with("a.md")));
        assert_eq!(res.matches[0].line, 1);
        assert_eq!(res.matches[1].line, 2);
    }

    #[test]
    fn case_sensitive_respected() {
        let _g = TEST_LOCK.lock().unwrap();
        let dir = fixture();
        let state = SearchState::default();
        let res = run_search(
            &state,
            dir.path(),
            "HELLO",
            Some(SearchOptions {
                case_sensitive: Some(true),
                is_regex: None,
                max_file_size: None,
                max_results: None,
                extra_ignores: None,
            }),
        )
        .unwrap();
        assert_eq!(res.matches.len(), 1);
        assert_eq!(res.matches[0].line, 2);
    }

    #[test]
    fn regex_search_works() {
        let _g = TEST_LOCK.lock().unwrap();
        let dir = fixture();
        let state = SearchState::default();
        let res = run_search(
            &state,
            dir.path(),
            r"wor.d",
            Some(SearchOptions {
                case_sensitive: None,
                is_regex: Some(true),
                max_file_size: None,
                max_results: None,
                extra_ignores: None,
            }),
        )
        .unwrap();
        assert_eq!(res.matches.len(), 1);
    }

    #[test]
    fn char_offsets_are_unicode_safe() {
        assert_eq!(byte_to_char_idx("你好abc", 6), 2);
    }
}
