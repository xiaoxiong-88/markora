/**
 * Image insertion: copies local images into the document's asset directory
 * (or saves clipboard bytes) and inserts the relative Markdown reference.
 * Nothing is inserted when the copy fails — never a dead link.
 */
import { backend } from "@/services/backend";
import { dirname } from "@/lib/path";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { getEditor } from "@/features/editor/editorRegistry";
import { t } from "@/i18n";
import type { DocumentSession } from "@/types";

function assetDir(): string {
  return useSettingsStore.getState().settings.assetDir;
}

function toastError(message: string) {
  useUiStore.getState().toast(message, "error");
}

/** Insert a markdown image reference into the active editor. */
export function insertImageMarkdown(doc: DocumentSession, alt: string, src: string) {
  const editor = getEditor(doc.id);
  const text = `![${alt}](${src})`;
  if (editor?.insertMarkdown) {
    editor.insertMarkdown(text);
  }
}

/** Copy a local image file into assets and insert the reference. */
export async function insertLocalImage(doc: DocumentSession, sourcePath: string): Promise<boolean> {
  const documentDir = doc.filePath ? dirname(doc.filePath) : null;
  const name = sourcePath.split(/[\\/]/).pop() ?? "image";
  if (!documentDir) {
    // Unsaved document: no base directory for a relative path; insert the
    // absolute path so the image still renders and can be fixed later.
    insertImageMarkdown(doc, name, sourcePath);
    return true;
  }
  try {
    const rel = await backend.copyImageToAssets(sourcePath, documentDir, assetDir());
    insertImageMarkdown(doc, name.replace(/\.[^.]+$/, ""), rel);
    useUiStore.getState().toast(t().toast.imageSaved, "success");
    return true;
  } catch {
    toastError(t().toast.imageFailed);
    return false;
  }
}

/** Save pasted clipboard image bytes and insert the reference. */
export async function insertClipboardImage(doc: DocumentSession, file: File): Promise<boolean> {
  const documentDir = doc.filePath ? dirname(doc.filePath) : null;
  if (!documentDir) {
    toastError(t().toast.imageFailed);
    return false;
  }
  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const ext = file.type.split("/")[1] || "png";
    const rel = await backend.saveImageBytes(Array.from(buffer), ext, documentDir, assetDir());
    insertImageMarkdown(doc, "pasted-image", rel);
    useUiStore.getState().toast(t().toast.imageSaved, "success");
    return true;
  } catch {
    toastError(t().toast.imageFailed);
    return false;
  }
}

/** Handle a batch of dropped/pasted files; images only. */
export async function insertImageFiles(doc: DocumentSession, files: File[]): Promise<void> {
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    await insertClipboardImage(doc, file);
  }
}
