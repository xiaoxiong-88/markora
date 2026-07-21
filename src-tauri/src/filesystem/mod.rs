//! Filesystem primitives shared by commands: ignore rules, extension filters,
//! line-ending helpers and metadata conversion.

use std::path::Path;

pub mod assets;
pub mod list;
pub mod ops;
pub mod read;
pub mod write;

/// Hard cap for reading a single text file into memory (32 MiB).
pub const MAX_READ_BYTES: u64 = 32 * 1024 * 1024;

/// Extensions treated as openable Markdown/text documents.
pub const MARKDOWN_EXTENSIONS: [&str; 5] = ["md", "markdown", "mdown", "mkd", "txt"];

/// Directory/file names ignored by default in tree listings, workspace scans
/// and searches. Users can extend this list via settings.
pub const DEFAULT_IGNORES: [&str; 10] = [
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    "__pycache__",
    ".idea",
    ".vscode",
    ".DS_Store",
];

pub fn is_markdown_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MARKDOWN_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// `extra` comes from user settings (e.g. `[".next", "coverage"]`).
pub fn should_ignore(name: &str, extra: &[String]) -> bool {
    DEFAULT_IGNORES.contains(&name) || extra.iter().any(|i| i == name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn markdown_extension_detection() {
        assert!(is_markdown_extension(Path::new("a.md")));
        assert!(is_markdown_extension(Path::new("a.MD")));
        assert!(is_markdown_extension(Path::new("notes.txt")));
        assert!(!is_markdown_extension(Path::new("image.png")));
        assert!(!is_markdown_extension(Path::new("noext")));
    }

    #[test]
    fn ignore_rules() {
        assert!(should_ignore("node_modules", &[]));
        assert!(should_ignore(".git", &[]));
        assert!(!should_ignore("src", &[]));
        let extra = vec![".next".to_string()];
        assert!(should_ignore(".next", &extra));
    }
}
