/** Cross-platform path helpers (POSIX-first, handles Windows separators). */

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) return "";
  if (idx === 0) return normalized.slice(0, 1);
  return normalized.slice(0, idx);
}

export function extname(path: string): string {
  const name = basename(path);
  const idx = name.lastIndexOf(".");
  return idx <= 0 ? "" : name.slice(idx);
}

export function joinPath(...parts: string[]): string {
  const joined = parts.filter(Boolean).join("/");
  const isAbs = joined.startsWith("/") || /^[A-Za-z]:\//.test(joined);
  const segments: string[] = [];
  for (const seg of joined.replace(/\\/g, "/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      segments.pop();
    } else {
      segments.push(seg);
    }
  }
  const prefix = /^[A-Za-z]:/.test(joined)
    ? ""
    : isAbs
      ? "/"
      : "";
  const drive = joined.match(/^[A-Za-z]:/)?.[0] ?? "";
  const body = segments.filter((s) => !/^[A-Za-z]:$/.test(s)).join("/");
  return `${drive}${prefix}${body}`;
}

/** Resolve `target` (possibly relative) against the directory `baseDir`. */
export function resolveRelative(baseDir: string, target: string): string {
  if (
    target.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(target) ||
    target.startsWith("file://")
  ) {
    return target.replace(/^file:\/\//, "");
  }
  return joinPath(baseDir, decodeURISafe(target));
}

export function decodeURISafe(s: string): string {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
}

export function fileStem(path: string): string {
  const name = basename(path);
  const idx = name.lastIndexOf(".");
  return idx <= 0 ? name : name.slice(0, idx);
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdown", ".mkd", ".txt"]);

export function isMarkdownFile(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extname(path).toLowerCase());
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"]);

export function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(path).toLowerCase());
}

/**
 * Make `path` relative to `baseDir` when it lives underneath it, otherwise
 * return the absolute path unchanged.
 */
export function relativePath(baseDir: string, path: string): string {
  const base = baseDir.replace(/\\/g, "/").replace(/\/$/, "");
  const target = path.replace(/\\/g, "/");
  if (target === base) return basename(target);
  if (target.startsWith(base + "/")) return target.slice(base.length + 1);
  return path;
}

/** Parent directory name, used to disambiguate tabs with equal file names. */
export function parentDirName(path: string): string {
  return basename(dirname(path));
}
