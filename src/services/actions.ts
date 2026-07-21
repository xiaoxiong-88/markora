/**
 * High-level user actions: dialogs + store orchestration shared by the
 * command palette, shortcuts, menus and buttons.
 */
import { open as openDialog, save as saveDialog, ask, message } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { backend } from "./backend";
import { useDocumentsStore } from "@/stores/documents";
import { useWorkspaceStore } from "@/stores/workspace";
import { useUiStore } from "@/stores/ui";
import { flushDocument } from "@/features/editor/modeSwitch";
import { dirname, basename, joinPath, isImageFile } from "@/lib/path";
import { persistSession } from "./session";
import { t } from "@/i18n";
import type { DocumentId } from "@/types";

const MD_FILTERS = [
  { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "txt"] },
];

function docs() {
  return useDocumentsStore.getState();
}

function toastError(err: unknown) {
  const detail =
    err && typeof err === "object" && "kind" in err
      ? `${(err as { kind: string }).kind}: ${JSON.stringify((err as { detail?: unknown }).detail ?? "")}`
      : String(err);
  useUiStore.getState().toast(detail, "error");
}

export function newDocument() {
  return docs().newDocument();
}

export async function openFileDialog() {
  const selected = await openDialog({ multiple: true, filters: MD_FILTERS });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  for (const path of paths) {
    await openFilePath(path);
  }
}

export async function openFilePath(path: string) {
  try {
    const id = await docs().openFile(path);
    useWorkspaceStore.getState().addRecentFile(path);
    void useWorkspaceStore.getState().expandTo(path);
    persistSession();
    return id;
  } catch (err) {
    toastError(err);
    return null;
  }
}

export async function openFolderDialog() {
  const selected = await openDialog({ directory: true });
  if (typeof selected === "string") {
    await useWorkspaceStore.getState().openFolder(selected);
    persistSession();
  }
}

export async function saveDocument(id: DocumentId): Promise<boolean> {
  const doc = docs().documents[id];
  if (!doc) return false;
  flushDocument(id);
  if (!useDocumentsStore.getState().documents[id]?.filePath) {
    return saveDocumentAs(id);
  }
  const ok = await docs().save(id);
  if (!ok) toastError(new Error("save failed"));
  persistSession();
  return ok;
}

export async function saveDocumentAs(id: DocumentId): Promise<boolean> {
  const doc = docs().documents[id];
  if (!doc) return false;
  flushDocument(id);
  const suggested = doc.filePath ?? `${doc.displayName.replace(/\.[^.]*$/, "")}.md`;
  const path = await saveDialog({
    defaultPath: suggested,
    filters: MD_FILTERS,
  });
  if (!path) return false;
  const ok = await docs().saveAs(id, path);
  if (ok) {
    useWorkspaceStore.getState().addRecentFile(path);
  } else {
    toastError(new Error("save failed"));
  }
  persistSession();
  return ok;
}

export async function saveAllDocuments() {
  for (const doc of Object.values(docs().documents)) {
    if (doc.isDirty) {
      flushDocument(doc.id);
    }
  }
  await docs().saveAll();
  persistSession();
}

/** Close a tab, prompting to save when dirty. Returns true if closed. */
export async function closeTabGuarded(id: DocumentId): Promise<boolean> {
  const doc = docs().documents[id];
  if (!doc) return true;
  if (doc.isDirty) {
    flushDocument(id);
    const current = docs().documents[id];
    if (current?.isDirty) {
      const strings = t();
      const saveIt = await ask(strings.dialog.unsavedBody(current.displayName), {
        title: strings.dialog.unsavedTitle,
        kind: "warning",
        okLabel: strings.dialog.save,
        cancelLabel: strings.dialog.dontSave,
      });
      if (saveIt) {
        const ok = await saveDocument(id);
        if (!ok) return false;
      }
    }
  }
  docs().closeTab(id);
  persistSession();
  return true;
}

/** Guard used before quitting the app. */
export async function guardUnsavedBeforeQuit(): Promise<boolean> {
  const dirty = Object.values(docs().documents).filter((d) => d.isDirty);
  for (const doc of dirty) {
    const closed = await closeTabGuarded(doc.id);
    if (!closed) return false;
  }
  return true;
}

// ---- file tree operations ------------------------------------------------

export async function createFileIn(dirPath: string, name: string) {
  const path = joinPath(dirPath, name.endsWith(".md") || name.includes(".") ? name : `${name}.md`);
  try {
    await backend.createFile(path);
    await useWorkspaceStore.getState().refreshDir(dirPath);
    await openFilePath(path);
  } catch (err) {
    toastError(err);
  }
}

export async function createFolderIn(dirPath: string, name: string) {
  try {
    await backend.createDir(joinPath(dirPath, name));
    await useWorkspaceStore.getState().refreshDir(dirPath);
  } catch (err) {
    toastError(err);
  }
}

export async function renameEntry(oldPath: string, newName: string) {
  const newPath = joinPath(dirname(oldPath), newName);
  if (newPath === oldPath) return;
  try {
    await backend.renamePath(oldPath, newPath);
    docs().handleRenamed(oldPath, newPath);
    const ws = useWorkspaceStore.getState();
    ws.removeDirState(oldPath);
    await ws.refreshDir(dirname(oldPath));
    void ws.loadWorkspaceFiles();
    persistSession();
  } catch (err) {
    toastError(err);
  }
}

export async function moveEntryTo(oldPath: string, targetDir: string) {
  const newPath = joinPath(targetDir, basename(oldPath));
  if (newPath === oldPath) return;
  try {
    await backend.renamePath(oldPath, newPath);
    docs().handleRenamed(oldPath, newPath);
    const ws = useWorkspaceStore.getState();
    ws.removeDirState(oldPath);
    await ws.refreshDir(dirname(oldPath));
    await ws.refreshDir(targetDir);
    persistSession();
  } catch (err) {
    toastError(err);
  }
}

export async function duplicateEntry(path: string) {
  const dir = dirname(path);
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  const copyName = dot > 0 ? `${base.slice(0, dot)} copy${base.slice(dot)}` : `${base} copy`;
  try {
    await backend.copyPath(path, joinPath(dir, copyName));
    await useWorkspaceStore.getState().refreshDir(dir);
  } catch (err) {
    toastError(err);
  }
}

export async function deleteEntryGuarded(path: string): Promise<boolean> {
  const strings = t();
  const confirmed = await ask(strings.dialog.deleteBody(basename(path)), {
    title: strings.dialog.deleteTitle,
    kind: "warning",
    okLabel: strings.dialog.deleteConfirm,
    cancelLabel: strings.dialog.cancel,
  });
  if (!confirmed) return false;
  try {
    await backend.deleteToTrash([path]);
    const ws = useWorkspaceStore.getState();
    ws.removeDirState(path);
    await ws.refreshDir(dirname(path));
    const open = docs().findByPath(path);
    if (open) docs().closeTab(open.id);
    void ws.loadWorkspaceFiles();
    persistSession();
    return true;
  } catch (err) {
    toastError(err);
    return false;
  }
}

export async function revealEntry(path: string) {
  try {
    await backend.revealInFinder(path);
  } catch (err) {
    toastError(err);
  }
}

export async function openWithDefaultApp(path: string) {
  try {
    await openPath(path);
  } catch (err) {
    toastError(err);
  }
}

export async function pickAndInsertImage(docId: DocumentId) {
  const doc = docs().documents[docId];
  if (!doc) return;
  const selected = await openDialog({
    multiple: false,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"] }],
  });
  if (typeof selected === "string" && isImageFile(selected)) {
    const { insertLocalImage } = await import("@/features/editor/imageInsert");
    await insertLocalImage(doc, selected);
  }
}

export async function showErrorDialog(title: string, body: string) {
  await message(body, { title, kind: "error" });
}
