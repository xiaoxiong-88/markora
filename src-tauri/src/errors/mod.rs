//! Structured application errors.
//!
//! Every command returns `Result<T, AppError>`. `AppError` serializes to a
//! JSON object shaped as `{ "kind": <string>, "detail": <payload> }` so the
//! frontend can map `kind` to a localized, human-readable message and show
//! `detail` as expandable technical context.

use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "detail", rename_all = "camelCase")]
pub enum AppError {
    #[error("path does not exist: {0}")]
    NotFound(String),

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("file is not valid UTF-8: {0}")]
    NotUtf8(String),

    #[error("file too large: {size} bytes (limit {max} bytes)")]
    TooLarge { size: u64, max: u64 },

    #[error("invalid path: {0}")]
    InvalidPath(String),

    #[error("path already exists: {0}")]
    AlreadyExists(String),

    #[error("I/O error on {path}: {message}")]
    Io { path: String, message: String },

    #[error("could not move to trash: {0}")]
    Trash(String),

    #[error("file watcher error: {0}")]
    Watch(String),

    #[error("search was cancelled")]
    SearchCancelled,
}

impl AppError {
    /// Map an `std::io::Error` to the most specific variant, keeping the path
    /// for context.
    pub fn from_io(err: std::io::Error, path: &std::path::Path) -> Self {
        let p = path.display().to_string();
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(p),
            std::io::ErrorKind::PermissionDenied => AppError::PermissionDenied(p),
            std::io::ErrorKind::AlreadyExists => AppError::AlreadyExists(p),
            _ => AppError::Io {
                path: p,
                message: err.to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_and_detail() {
        let err = AppError::NotUtf8("/tmp/a.bin".into());
        let v = serde_json::to_value(&err).unwrap();
        assert_eq!(v["kind"], "notUtf8");
        assert_eq!(v["detail"], "/tmp/a.bin");
    }

    #[test]
    fn serializes_struct_variant() {
        let err = AppError::TooLarge { size: 10, max: 5 };
        let v = serde_json::to_value(&err).unwrap();
        assert_eq!(v["kind"], "tooLarge");
        assert_eq!(v["detail"]["size"], 10);
        assert_eq!(v["detail"]["max"], 5);
    }

    #[test]
    fn io_error_mapping() {
        let io = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "nope");
        let err = AppError::from_io(io, std::path::Path::new("/x"));
        assert!(matches!(err, AppError::PermissionDenied(_)));
    }
}
