/**
 * Mode switching with the single-active-editor rule: flush the currently
 * mounted editor into the document store BEFORE the mode changes, then
 * switch. Version tracking in the store prevents echo updates.
 */
import { useDocumentsStore } from "@/stores/documents";
import { flushEditor } from "./editorRegistry";
import type { DocumentId, EditorMode } from "@/types";

export function switchMode(id: DocumentId, mode: EditorMode): void {
  const store = useDocumentsStore.getState();
  const doc = store.documents[id];
  if (!doc || doc.mode === mode) return;
  const markdown = flushEditor(id);
  if (markdown != null && markdown !== doc.markdown) {
    store.updateMarkdown(id, markdown);
  }
  useDocumentsStore.getState().setMode(id, mode);
}

/** Flush whatever editor is mounted for the document (used before save). */
export function flushDocument(id: DocumentId): void {
  const store = useDocumentsStore.getState();
  const doc = store.documents[id];
  if (!doc) return;
  const markdown = flushEditor(id);
  if (markdown != null && markdown !== doc.markdown) {
    store.updateMarkdown(id, markdown);
  }
}
