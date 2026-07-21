export type DocumentId = string;

export type EditorMode = "wysiwyg" | "source" | "split" | "reader";

export type LineEnding = "lf" | "crlf" | "mixed" | "none";

export interface CursorState {
  /** 1-based line and column, as shown in the status bar. */
  line: number;
  column: number;
  /** Character offsets into the markdown string. */
  anchor: number;
  head: number;
}

export interface ScrollState {
  top: number;
  left: number;
}

export interface FileMetadata {
  size: number;
  modifiedMs: number | null;
  encoding: string;
  lineEnding: LineEnding;
}

export type ExternalChangeState =
  | { status: "none" }
  | { status: "modified"; detectedAt: number }
  | { status: "deleted"; detectedAt: number };

/**
 * The single source of truth for one open document. Editor instances never
 * live here — only serializable state. `isDirty` is always derived from
 * `markdown !== savedMarkdown` by the store; it is kept as a field for cheap
 * subscriptions.
 */
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
  externalChangeState: ExternalChangeState;
  pinned: boolean;
  /** Timestamp of the last local edit, drives debounced autosave. */
  lastEditAt: number;
}

export function deriveIsDirty(markdown: string, savedMarkdown: string): boolean {
  return markdown !== savedMarkdown;
}
