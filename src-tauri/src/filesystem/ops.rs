//! File and directory operations: create, rename, move, copy, trash and
//! "reveal in system file manager".

use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::errors::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpResultDto {
    pub path: String,
}

fn ensure_parent_exists(path: &Path) -> Result<(), AppError> {
    match path.parent() {
        Some(parent) if parent.is_dir() => Ok(()),
        Some(parent) => Err(AppError::NotFound(parent.display().to_string())),
        None => Err(AppError::InvalidPath(path.display().to_string())),
    }
}

fn ensure_absent(path: &Path) -> Result<(), AppError> {
    if path.exists() {
        Err(AppError::AlreadyExists(path.display().to_string()))
    } else {
        Ok(())
    }
}

pub fn create_file(path: String, content: Option<String>) -> Result<OpResultDto, AppError> {
    let path = Path::new(&path);
    ensure_parent_exists(path)?;
    ensure_absent(path)?;
    fs::write(path, content.unwrap_or_default()).map_err(|e| AppError::from_io(e, path))?;
    Ok(OpResultDto {
        path: path.display().to_string(),
    })
}

pub fn create_dir(path: String) -> Result<OpResultDto, AppError> {
    let path = Path::new(&path);
    ensure_parent_exists(path)?;
    ensure_absent(path)?;
    fs::create_dir(path).map_err(|e| AppError::from_io(e, path))?;
    Ok(OpResultDto {
        path: path.display().to_string(),
    })
}

/// Rename or move `from` to `to` (same volume). Used for both rename and
/// move; `to` must not exist yet.
pub fn rename_path(from: String, to: String) -> Result<OpResultDto, AppError> {
    let from = Path::new(&from);
    let to = Path::new(&to);
    if !from.exists() {
        return Err(AppError::NotFound(from.display().to_string()));
    }
    ensure_parent_exists(to)?;
    ensure_absent(to)?;
    fs::rename(from, to).map_err(|e| AppError::from_io(e, from))?;
    Ok(OpResultDto {
        path: to.display().to_string(),
    })
}

fn copy_recursive(from: &Path, to: &Path) -> Result<(), AppError> {
    let metadata = fs::metadata(from).map_err(|e| AppError::from_io(e, from))?;
    if metadata.is_dir() {
        fs::create_dir(to).map_err(|e| AppError::from_io(e, to))?;
        for entry in fs::read_dir(from).map_err(|e| AppError::from_io(e, from))? {
            let entry = entry.map_err(|e| AppError::from_io(e, from))?;
            copy_recursive(&entry.path(), &to.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(from, to).map_err(|e| AppError::from_io(e, from))?;
        Ok(())
    }
}

pub fn copy_path(from: String, to: String) -> Result<OpResultDto, AppError> {
    let from = Path::new(&from);
    let to = Path::new(&to);
    if !from.exists() {
        return Err(AppError::NotFound(from.display().to_string()));
    }
    ensure_parent_exists(to)?;
    ensure_absent(to)?;
    copy_recursive(from, to)?;
    Ok(OpResultDto {
        path: to.display().to_string(),
    })
}

/// Move paths to the system trash (recoverable), never hard-deleting.
pub fn delete_to_trash(paths: Vec<String>) -> Result<(), AppError> {
    for p in &paths {
        if !Path::new(p).exists() {
            return Err(AppError::NotFound(p.clone()));
        }
    }
    trash::delete_all(&paths).map_err(|e| AppError::Trash(e.to_string()))
}

/// Reveal a file in the platform's file manager (Finder / Explorer / etc.).
pub fn reveal_in_finder(path: String) -> Result<(), AppError> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(AppError::NotFound(path.display().to_string()));
    }
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open")
        .arg("-R")
        .arg(path)
        .status();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = {
        let dir = path.parent().unwrap_or(path);
        std::process::Command::new("xdg-open").arg(dir).status()
    };
    match result {
        Ok(status) if status.success() || cfg!(target_os = "windows") => Ok(()),
        Ok(status) => Err(AppError::Io {
            path: path.display().to_string(),
            message: format!("file manager exited with {status}"),
        }),
        Err(e) => Err(AppError::from_io(e, path)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_and_rename() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.md");
        create_file(a.display().to_string(), Some("hi".into())).unwrap();
        // creating twice must fail
        assert!(matches!(
            create_file(a.display().to_string(), None),
            Err(AppError::AlreadyExists(_))
        ));
        let b = dir.path().join("b.md");
        rename_path(a.display().to_string(), b.display().to_string()).unwrap();
        assert!(!a.exists() && b.exists());
        // renaming missing source fails
        assert!(matches!(
            rename_path(a.display().to_string(), b.display().to_string()),
            Err(AppError::NotFound(_))
        ));
    }

    #[test]
    fn copy_recursive_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("src");
        fs::create_dir(&src).unwrap();
        fs::write(src.join("one.md"), "1").unwrap();
        fs::create_dir(src.join("sub")).unwrap();
        fs::write(src.join("sub").join("two.md"), "2").unwrap();
        let dst = dir.path().join("dst");
        copy_path(src.display().to_string(), dst.display().to_string()).unwrap();
        assert_eq!(fs::read_to_string(dst.join("one.md")).unwrap(), "1");
        assert_eq!(
            fs::read_to_string(dst.join("sub").join("two.md")).unwrap(),
            "2"
        );
    }

    #[test]
    fn trash_missing_path_fails() {
        assert!(matches!(
            delete_to_trash(vec!["/definitely/not/here.md".into()]),
            Err(AppError::NotFound(_))
        ));
    }
}
