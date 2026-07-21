import type { LineEnding } from "./document";

/** DTOs mirroring the Rust backend (`src-tauri`). Field names are camelCase
 * because every Rust DTO uses `#[serde(rename_all = "camelCase")]`. */

export interface FileContentDto {
  path: string;
  content: string;
  size: number;
  modifiedMs: number | null;
  lineEnding: LineEnding;
  encoding: string;
}

export interface WriteResultDto {
  path: string;
  size: number;
  modifiedMs: number | null;
  lineEnding: LineEnding;
}

export interface DirEntryDto {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
  isSymlink: boolean;
  size: number | null;
  modifiedMs: number | null;
  extension: string | null;
}

export interface SearchMatchDto {
  path: string;
  line: number;
  matchStart: number;
  matchEnd: number;
  lineText: string;
  contextBefore: string | null;
  contextAfter: string | null;
}

export interface SearchResultDto {
  matches: SearchMatchDto[];
  truncated: boolean;
  cancelled: boolean;
  searchedFiles: number;
}

export interface FsEventDto {
  kind: "create" | "modify" | "remove" | "rename" | "other";
  paths: string[];
}

/** Serialized shape of the Rust `AppError` (`{ kind, detail }`). */
export interface AppErrorPayload {
  kind:
    | "notFound"
    | "permissionDenied"
    | "notUtf8"
    | "tooLarge"
    | "invalidPath"
    | "alreadyExists"
    | "io"
    | "trash"
    | "watch"
    | "searchCancelled"
    | string;
  detail?: unknown;
}
