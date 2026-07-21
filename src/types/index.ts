/** Core domain types shared across stores, services and components. */

export type DocumentId = string;

export type EditorMode = "wysiwyg" | "source" | "split" | "reader";

export interface CursorState {
  /** Character offset into the markdown source (source/split modes). */
  offset: number;
  line: number;
  column: number;
}

export interface ScrollState {
  top: number;
  ratio: number;
}

export type LineEnding = "lf" | "crlf" | "mixed" | "none";

export interface FileMetadata {
  encoding: string;
  lineEnding: LineEnding;
  modifiedMs: number | null;
  sizeBytes: number;
}

export type ExternalChangeState =
  | { status: "none" }
  | { status: "conflict"; diskContent: string; diskModifiedMs: number | null };

export interface DocumentSession {
  id: DocumentId;
  filePath: string | null;
  displayName: string;
  markdown: string;
  savedMarkdown: string;
  isDirty: boolean;
  mode: EditorMode;
  cursorState: CursorState | null;
  scrollState: ScrollState;
  fileMetadata: FileMetadata | null;
  externalChange: ExternalChangeState;
  /** Bumped on every content change; guards against echo updates. */
  contentVersion: number;
  /** Version the mounted editor was built from. */
  editorVersion: number;
}

export type SaveState = "saved" | "saving" | "unsaved" | "failed";

export interface TabInfo {
  documentId: DocumentId;
  pinned: boolean;
}

export interface RecentItem {
  path: string;
  openedAt: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
  isSymlink: boolean;
  size: number | null;
  modifiedMs: number | null;
  extension: string | null;
}

export interface SearchMatch {
  path: string;
  line: number;
  matchStart: number;
  matchEnd: number;
  lineText: string;
  contextBefore: string | null;
  contextAfter: string | null;
}

export interface SearchSummary {
  matches: SearchMatch[];
  truncated: boolean;
  cancelled: boolean;
  searchedFiles: number;
}

/** Structured error returned by every Rust command: `{ kind, detail }`. */
export interface BackendError {
  kind: string;
  detail?: unknown;
}

export interface Heading {
  level: number;
  text: string;
  /** 0-based line in the markdown source. */
  line: number;
  /** Stable anchor slug (deduplicated). */
  slug: string;
}

export interface FsEventPayload {
  kind: string;
  paths: string[];
}
