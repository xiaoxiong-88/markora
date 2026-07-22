/**
 * Typed wrappers around Tauri commands. Every backend failure is normalized
 * to a structured `BackendError` shaped `{ kind, detail }`
 * (see src-tauri/src/errors/mod.rs).
 */
import { invoke } from "@tauri-apps/api/core";
import type {
  BackendError,
  DirEntry,
  LineEnding,
  SearchSummary,
} from "@/types";

export interface FileContent {
  path: string;
  content: string;
  size: number;
  modifiedMs: number | null;
  lineEnding: LineEnding;
  encoding: string;
}

export interface WriteOptions {
  lineEnding?: "preserve" | "lf" | "crlf";
  ensureFinalNewline?: boolean;
}

export interface WriteResult {
  path: string;
  size: number;
  modifiedMs: number | null;
  lineEnding: LineEnding;
}

export interface ListOptions {
  showHidden?: boolean;
  extraIgnores?: string[];
}

export interface WorkspaceSearchOptions {
  caseSensitive?: boolean;
  isRegex?: boolean;
  maxFileSize?: number;
  maxResults?: number;
  extraIgnores?: string[];
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function normalizeError(err: unknown): BackendError {
  if (err && typeof err === "object" && "kind" in err) {
    return err as BackendError;
  }
  return { kind: "io", detail: err instanceof Error ? err.message : String(err) };
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw normalizeError(err);
  }
}

export const backend = {
  readFile: (path: string) => call<FileContent>("read_file", { path }),
  writeFileAtomic: (path: string, content: string, options?: WriteOptions) =>
    call<WriteResult>("atomic_write", { path, content, options }),
  createFile: (path: string, content?: string) =>
    call<{ path: string }>("create_file", { path, content }),
  createDir: (path: string) => call<{ path: string }>("create_dir", { path }),
  renamePath: (from: string, to: string) =>
    call<{ path: string }>("rename_path", { from, to }),
  copyPath: (from: string, to: string) =>
    call<{ path: string }>("copy_path", { from, to }),
  deleteToTrash: (paths: string[]) => call<void>("delete_to_trash", { paths }),
  revealInFinder: (path: string) => call<void>("reveal_in_finder", { path }),
  listDirectory: (path: string, options?: ListOptions) =>
    call<DirEntry[]>("list_directory", { path, options }),
  listWorkspaceFiles: (root: string, maxResults?: number, extraIgnores?: string[]) =>
    call<string[]>("list_workspace_files", { root, maxResults, extraIgnores }),
  copyImageToAssets: (sourcePath: string, documentDir: string, assetDir: string) =>
    call<string>("copy_image_to_assets", { sourcePath, documentDir, assetDir }),
  saveImageBytes: (bytes: number[], extension: string, documentDir: string, assetDir: string) =>
    call<string>("save_image_bytes", { bytes, extension, documentDir, assetDir }),
  pathExists: (path: string) => call<boolean>("path_exists", { path }),
  fileMtime: (path: string) => call<number | null>("file_mtime", { path }),
  workspaceSearch: (root: string, query: string, options?: WorkspaceSearchOptions) =>
    call<SearchSummary>("workspace_search", { root, query, options }),
  cancelSearch: () => call<void>("cancel_search"),
  watchPath: (path: string) => call<void>("watch_path", { path }),
  unwatchPath: (path: string) => call<void>("unwatch_path", { path }),
  takePendingOpens: () => call<string[]>("take_pending_opens"),
};
