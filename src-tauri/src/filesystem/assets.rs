//! Image/asset handling: copy or write images into a document's asset
//! directory and return the relative path used in Markdown.

use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::errors::AppError;

/// Prevent asset directories from escaping the document directory.
fn resolve_asset_dir(document_dir: &Path, asset_dir: &str) -> Result<PathBuf, AppError> {
    if asset_dir.is_empty() || asset_dir == "." {
        return Ok(document_dir.to_path_buf());
    }
    let rel = Path::new(asset_dir);
    if rel.is_absolute() || rel.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(AppError::InvalidPath(format!(
            "asset directory must be a relative path inside the document directory: {asset_dir}"
        )));
    }
    Ok(document_dir.join(rel))
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    if trimmed.is_empty() {
        "image.png".into()
    } else {
        trimmed.chars().take(120).collect()
    }
}

/// "name.png" -> "name 2.png" -> ... until the destination is free.
fn unique_destination(to: &Path) -> PathBuf {
    if !to.exists() {
        return to.to_path_buf();
    }
    let parent = to.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = to
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = to
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    for i in 2..1000 {
        let candidate = parent.join(format!("{stem} {i}{ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    to.to_path_buf()
}

/// Percent-encode characters that are unsafe inside a Markdown link target.
fn url_encode_path(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for ch in path.chars() {
        match ch {
            ' ' => out.push_str("%20"),
            '(' => out.push_str("%28"),
            ')' => out.push_str("%29"),
            '#' => out.push_str("%23"),
            '<' => out.push_str("%3C"),
            '>' => out.push_str("%3E"),
            _ => out.push(ch),
        }
    }
    out
}

fn relative_markdown_path(document_dir: &Path, dest: &Path) -> String {
    let rel = dest
        .strip_prefix(document_dir)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| dest.to_string_lossy().replace('\\', "/"));
    url_encode_path(&rel)
}

/// Copy an existing image file into the asset directory; returns the
/// relative, URL-encoded path for Markdown insertion.
pub fn copy_image_to_assets(
    source_path: String,
    document_dir: String,
    asset_dir: String,
) -> Result<String, AppError> {
    let source = Path::new(&source_path);
    if !source.is_file() {
        return Err(AppError::NotFound(source_path));
    }
    let document_dir = Path::new(&document_dir);
    let dir = resolve_asset_dir(document_dir, &asset_dir)?;
    fs::create_dir_all(&dir).map_err(|e| AppError::from_io(e, &dir))?;

    let name = sanitize_file_name(
        &source
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "image.png".into()),
    );
    let dest = unique_destination(&dir.join(&name));
    fs::copy(source, &dest).map_err(|e| AppError::from_io(e, &dest))?;
    Ok(relative_markdown_path(document_dir, &dest))
}

/// Persist clipboard image bytes (e.g. a screenshot) into the asset
/// directory; returns the relative, URL-encoded path.
pub fn save_image_bytes(
    bytes: Vec<u8>,
    extension: String,
    document_dir: String,
    asset_dir: String,
) -> Result<String, AppError> {
    let document_dir = Path::new(&document_dir);
    let dir = resolve_asset_dir(document_dir, &asset_dir)?;
    fs::create_dir_all(&dir).map_err(|e| AppError::from_io(e, &dir))?;

    let ext = sanitize_file_name(if extension.is_empty() {
        "png"
    } else {
        extension.trim_start_matches('.')
    });
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let dest = unique_destination(&dir.join(format!("image-{millis}.{ext}")));
    fs::write(&dest, &bytes).map_err(|e| AppError::from_io(e, &dest))?;
    Ok(relative_markdown_path(document_dir, &dest))
}

pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

pub fn file_mtime(path: String) -> Option<u64> {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_dir_traversal_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let err = resolve_asset_dir(dir.path(), "../evil").unwrap_err();
        assert!(matches!(err, AppError::InvalidPath(_)));
        assert!(resolve_asset_dir(dir.path(), "assets").is_ok());
        assert!(resolve_asset_dir(dir.path(), "a/b/c").is_ok());
    }

    #[test]
    fn copy_image_sanitizes_and_dedupes() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("my pic(1).png");
        fs::write(&src, b"png").unwrap();
        let rel = copy_image_to_assets(
            src.display().to_string(),
            dir.path().display().to_string(),
            "assets".into(),
        )
        .unwrap();
        assert_eq!(rel, "assets/my%20pic%281%29.png");
        assert!(dir.path().join("assets/my pic(1).png").exists());
        let rel2 = copy_image_to_assets(
            src.display().to_string(),
            dir.path().display().to_string(),
            "assets".into(),
        )
        .unwrap();
        assert_ne!(rel, rel2);
    }

    #[test]
    fn save_bytes_creates_unique_names() {
        let dir = tempfile::tempdir().unwrap();
        let a = save_image_bytes(
            vec![1, 2, 3],
            "png".into(),
            dir.path().display().to_string(),
            "assets".into(),
        )
        .unwrap();
        let b = save_image_bytes(
            vec![1, 2, 3],
            "png".into(),
            dir.path().display().to_string(),
            "assets".into(),
        )
        .unwrap();
        assert!(a.starts_with("assets/image-"));
        assert!(a.ends_with(".png"));
        assert_ne!(a, b);
    }

    #[test]
    fn sanitize_removes_unsafe_chars() {
        assert_eq!(sanitize_file_name("a/b\\c:d.png"), "a-b-c-d.png");
        assert_eq!(sanitize_file_name("..."), "image.png");
    }
}
