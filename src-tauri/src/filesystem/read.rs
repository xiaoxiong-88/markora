//! Reading text files with UTF-8 validation, size caps and line-ending
//! detection.

use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::errors::AppError;

use super::MAX_READ_BYTES;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    Lf,
    Crlf,
    Mixed,
    /// No line breaks at all.
    None,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContentDto {
    pub path: String,
    pub content: String,
    pub size: u64,
    pub modified_ms: Option<u64>,
    pub line_ending: LineEnding,
    pub encoding: &'static str,
}

/// Detect the dominant line-ending style of `text`.
pub fn detect_line_ending(text: &str) -> LineEnding {
    let mut crlf = 0usize;
    let mut lf_only = 0usize;
    let bytes = text.as_bytes();
    for (i, b) in bytes.iter().enumerate() {
        if *b == b'\n' {
            if i > 0 && bytes[i - 1] == b'\r' {
                crlf += 1;
            } else {
                lf_only += 1;
            }
        }
    }
    match (crlf, lf_only) {
        (0, 0) => LineEnding::None,
        (_, 0) => LineEnding::Crlf,
        (0, _) => LineEnding::Lf,
        _ => LineEnding::Mixed,
    }
}

pub fn read_text_file(path: &Path) -> Result<FileContentDto, AppError> {
    let metadata = fs::metadata(path).map_err(|e| AppError::from_io(e, path))?;
    if !metadata.is_file() {
        return Err(AppError::InvalidPath(format!(
            "{} is not a regular file",
            path.display()
        )));
    }
    let size = metadata.len();
    if size > MAX_READ_BYTES {
        return Err(AppError::TooLarge {
            size,
            max: MAX_READ_BYTES,
        });
    }
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);

    let bytes = fs::read(path).map_err(|e| AppError::from_io(e, path))?;
    // Strip a UTF-8 BOM if present; anything else must validate as UTF-8.
    let bytes = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        &bytes[3..]
    } else {
        &bytes[..]
    };
    let content = std::str::from_utf8(bytes)
        .map_err(|_| AppError::NotUtf8(path.display().to_string()))?
        .to_string();
    let line_ending = detect_line_ending(&content);

    Ok(FileContentDto {
        path: path.display().to_string(),
        content,
        size,
        modified_ms,
        line_ending,
        encoding: "utf-8",
    })
}

pub fn read_file(path: String) -> Result<FileContentDto, AppError> {
    read_text_file(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_line_endings() {
        assert_eq!(detect_line_ending("a\nb\n"), LineEnding::Lf);
        assert_eq!(detect_line_ending("a\r\nb\r\n"), LineEnding::Crlf);
        assert_eq!(detect_line_ending("a\nb\r\n"), LineEnding::Mixed);
        assert_eq!(detect_line_ending("no breaks"), LineEnding::None);
    }

    #[test]
    fn reads_utf8_and_strips_bom() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.md");
        fs::write(&p, b"\xEF\xBB\xBFhello\n").unwrap();
        let dto = read_text_file(&p).unwrap();
        assert_eq!(dto.content, "hello\n");
        assert_eq!(dto.line_ending, LineEnding::Lf);
        assert_eq!(dto.encoding, "utf-8");
    }

    #[test]
    fn rejects_non_utf8() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("bad.md");
        fs::write(&p, [0xFF, 0xFE, 0x00, 0x01]).unwrap();
        let err = read_text_file(&p).unwrap_err();
        assert!(matches!(err, AppError::NotUtf8(_)));
    }

    #[test]
    fn rejects_missing_file() {
        let err = read_text_file(Path::new("/definitely/not/here.md")).unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }
}
