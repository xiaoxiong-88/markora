/**
 * Resolve image sources found in Markdown against the current document.
 * Local paths are served through Tauri's asset protocol; remote/data URLs
 * pass through untouched. Only image-like files are resolved this way.
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "@/services/backend";
import { decodeURISafe, isImageFile, resolveRelative } from "./path";

export function resolveImageSrc(src: string, documentDir: string | null): string {
  if (!src) return src;
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  let path = src.replace(/^file:\/\//i, "");
  path = decodeURISafe(path);
  if (!/^[a-z]+:/i.test(path) && documentDir && !path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path)) {
    path = resolveRelative(documentDir, path);
  }
  if (!isImageFile(path)) return src;
  return isTauri() ? convertFileSrc(path) : src;
}

/** Extract the filesystem path for an image src, when it is local. */
export function localImagePath(src: string, documentDir: string | null): string | null {
  if (/^(https?:|data:|blob:)/i.test(src)) return null;
  let path = decodeURISafe(src.replace(/^file:\/\//i, ""));
  if (!path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path)) {
    if (!documentDir) return null;
    path = resolveRelative(documentDir, path);
  }
  return path;
}
