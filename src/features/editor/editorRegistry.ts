/**
 * Registry of mounted editor instances, keyed by document id.
 *
 * The single-active-editor rule: only the editor for the active document in
 * the active mode is mounted, and only it writes to the document store.
 * Mode switches flush the current editor into the store first.
 */

export interface EditorHandle {
  /** Latest markdown from the editor, or null if it cannot provide one. */
  getMarkdown: () => string | null;
  /** Replace content after an external change (conflict resolution, reload). */
  setMarkdown: (markdown: string) => void;
  /** Move cursor/scroll to a 1-based source line, if supported. */
  scrollToLine?: (line: number) => void;
  /** Current 1-based line at the top of the viewport / at cursor. */
  getCursorLine?: () => number | null;
  /** Insert markdown text at the current selection. */
  insertMarkdown?: (text: string) => void;
  /** Wrap the current selection with open/close markers (bold, italic…). */
  wrapSelection?: (open: string, close: string) => void;
  focus?: () => void;
}

const registry = new Map<string, EditorHandle>();

export function registerEditor(documentId: string, handle: EditorHandle): () => void {
  registry.set(documentId, handle);
  return () => {
    if (registry.get(documentId) === handle) {
      registry.delete(documentId);
    }
  };
}

export function getEditor(documentId: string): EditorHandle | null {
  return registry.get(documentId) ?? null;
}

/** Flush the mounted editor's content; returns the markdown if available. */
export function flushEditor(documentId: string): string | null {
  return registry.get(documentId)?.getMarkdown() ?? null;
}
