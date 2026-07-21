//! Atomic file writes: content goes to a temporary file in the same
//! directory, is flushed to disk and then renamed over the target, so a
//! crash mid-write can never leave a truncated document.

use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::errors::AppError;

use super::read::{detect_line_ending, LineEnding};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteOptions {
    /// "preserve" (keep the existing file's style, default) | "lf" | "crlf".
    pub line_ending: Option<String>,
    /// Ensure the file ends with exactly one trailing newline.
    pub ensure_final_newline: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResultDto {
    pub path: String,
    pub size: u64,
    pub modified_ms: Option<u64>,
    pub line_ending: LineEnding,
}

/// Normalize all line breaks to `\n`, then convert to the requested style.
pub fn normalize_line_endings(content: &str, target: &str) -> String {
    let mut unified = content.replace("\r\n", "\n");
    unified = unified.replace('\r', "\n");
    match target {
        "crlf" => unified.replace('\n', "\r\n"),
        _ => unified,
    }
}

fn resolve_target_ending(requested: Option<&str>, path: &Path) -> String {
    match requested {
        Some("lf") => "lf".to_string(),
        Some("crlf") => "crlf".to_string(),
        // "preserve" (or unknown / None): keep what the file already uses.
        _ => {
            if let Ok(existing) = std::fs::read_to_string(path) {
                match detect_line_ending(&existing) {
                    LineEnding::Crlf => "crlf".to_string(),
                    _ => "lf".to_string(),
                }
            } else {
                #[cfg(windows)]
                {
                    "crlf".to_string()
                }
                #[cfg(not(windows))]
                {
                    "lf".to_string()
                }
            }
        }
    }
}

pub fn atomic_write_text(
    path: &Path,
    content: &str,
    options: &WriteOptions,
) -> Result<WriteResultDto, AppError> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::InvalidPath(path.display().to_string()))?;
    if !parent.is_dir() {
        return Err(AppError::NotFound(parent.display().to_string()));
    }

    let target = resolve_target_ending(options.line_ending.as_deref(), path);
    let mut body = normalize_line_endings(content, &target);
    if options.ensure_final_newline.unwrap_or(false) {
        let newline = if target == "crlf" { "\r\n" } else { "\n" };
        let trimmed_len = body.trim_end_matches(['\r', '\n']).len();
        body.truncate(trimmed_len);
        if trimmed_len > 0 {
            body.push_str(newline);
        }
    }

    let mut tmp =
        tempfile::NamedTempFile::new_in(parent).map_err(|e| AppError::from_io(e, parent))?;
    tmp.write_all(body.as_bytes())
        .map_err(|e| AppError::from_io(e, path))?;
    tmp.as_file()
        .sync_all()
        .map_err(|e| AppError::from_io(e, path))?;
    // `persist` performs the rename; on Windows the target must not exist.
    #[cfg(windows)]
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| AppError::from_io(e, path))?;
    }
    tmp.persist(path)
        .map_err(|e| AppError::from_io(e.error, path))?;

    let metadata = std::fs::metadata(path).map_err(|e| AppError::from_io(e, path))?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    Ok(WriteResultDto {
        path: path.display().to_string(),
        size: metadata.len(),
        modified_ms,
        line_ending: detect_line_ending(&body),
    })
}

pub fn atomic_write(
    path: String,
    content: String,
    options: Option<WriteOptions>,
) -> Result<WriteResultDto, AppError> {
    let options = options.unwrap_or(WriteOptions {
        line_ending: None,
        ensure_final_newline: None,
    });
    atomic_write_text(Path::new(&path), &content, &options)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn opts(ending: Option<&str>) -> WriteOptions {
        WriteOptions {
            line_ending: ending.map(|s| s.to_string()),
            ensure_final_newline: None,
        }
    }

    #[test]
    fn normalizes_line_endings() {
        assert_eq!(normalize_line_endings("a\r\nb\rc\nd", "lf"), "a\nb\nc\nd");
        assert_eq!(normalize_line_endings("a\nb", "crlf"), "a\r\nb");
    }

    #[test]
    fn atomic_write_roundtrip_and_preserve() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("doc.md");
        std::fs::write(&p, "first\r\nsecond\r\n").unwrap();

        // preserve: CRLF survives a save.
        let res = atomic_write_text(&p, "changed\nlines\n", &opts(Some("preserve"))).unwrap();
        assert_eq!(res.line_ending, LineEnding::Crlf);
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "changed\r\nlines\r\n");

        // explicit lf converts.
        let res = atomic_write_text(&p, "now lf\n", &opts(Some("lf"))).unwrap();
        assert_eq!(res.line_ending, LineEnding::Lf);
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "now lf\n");

        // no temp files are left behind.
        let leftovers: Vec<_> = std::fs::read_dir(dir.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name() != "doc.md")
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn final_newline_option() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("n.md");
        let o = WriteOptions {
            line_ending: Some("lf".into()),
            ensure_final_newline: Some(true),
        };
        atomic_write_text(&p, "abc\n\n\n", &o).unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "abc\n");
    }

    #[test]
    fn write_into_missing_directory_fails() {
        let err = atomic_write_text(Path::new("/no/such/dir/x.md"), "a", &opts(None)).unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}
