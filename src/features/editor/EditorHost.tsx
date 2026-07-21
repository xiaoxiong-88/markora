import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSession } from "@/types";
import { dirname } from "@/lib/path";
import { useDocumentsStore } from "@/stores/documents";
import { useSettingsStore } from "@/stores/settings";
import { getEditor } from "./editorRegistry";
import { SourceEditor } from "./SourceEditor";
import { WysiwygEditor } from "./WysiwygEditor";
import { PreviewPane } from "./PreviewPane";
import { insertImageFiles, insertLocalImage } from "./imageInsert";
import { ImageLightbox } from "./ImageLightbox";

/**
 * Hosts the active editor for a document according to its mode.
 * Single-active-editor: exactly one writing editor is mounted at a time;
 * external content changes are pushed into the mounted editor via its
 * registered handle instead of remounting it.
 */
export function EditorHost({ doc }: { doc: DocumentSession }) {
  const updateMarkdown = useDocumentsStore((s) => s.updateMarkdown);
  const setCursor = useDocumentsStore((s) => s.setCursor);
  const focusMode = useSettingsStore((s) => s.settings.focusMode);
  const typewriter = useSettingsStore((s) => s.settings.typewriterMode);
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);
  const documentDir = doc.filePath ? dirname(doc.filePath) : null;

  const onChange = useCallback(
    (markdown: string) => updateMarkdown(doc.id, markdown),
    [doc.id, updateMarkdown],
  );

  const onCursorLine = useCallback(
    (line: number) => setCursor(doc.id, { offset: 0, line, column: 1 }),
    [doc.id, setCursor],
  );

  // Push external content changes (conflict resolution, disk reload) into
  // the mounted editor. Changes originating from the editor itself compare
  // equal and become no-ops — this is the loop guard.
  useEffect(() => {
    const handle = getEditor(doc.id);
    if (!handle) return;
    const current = handle.getMarkdown();
    if (current != null && current !== doc.markdown) {
      handle.setMarkdown(doc.markdown);
    }
  }, [doc.id, doc.markdown]);

  // Typewriter mode: keep the cursor near the vertical center.
  useEffect(() => {
    if (!typewriter) return;
    const handle = getEditor(doc.id);
    const line = handle?.getCursorLine?.();
    if (line && handle?.scrollToLine) {
      handle.scrollToLine(line);
    }
  }, [typewriter, doc.id, doc.cursorState?.line]);

  const onPasteFiles = useCallback(
    (files: File[]) => void insertImageFiles(doc, files),
    [doc],
  );
  const onDropFiles = useCallback(
    (files: File[]) => void insertImageFiles(doc, files),
    [doc],
  );

  return (
    <div
      className={`relative h-full min-h-0 ${focusMode ? "focus-mode" : ""}`}
      data-mode={doc.mode}
    >
      {doc.mode === "wysiwyg" && (
        <WysiwygEditor
          documentId={doc.id}
          initialMarkdown={doc.markdown}
          onChange={onChange}
          onCursorLine={onCursorLine}
          onPasteFiles={onPasteFiles}
          onDropFiles={onDropFiles}
        />
      )}
      {doc.mode === "source" && (
        <SourceEditor
          documentId={doc.id}
          initialMarkdown={doc.markdown}
          onChange={onChange}
          onCursorLine={onCursorLine}
          onPasteFiles={onPasteFiles}
          onDropFiles={onDropFiles}
        />
      )}
      {doc.mode === "split" && (
        <SplitView
          doc={doc}
          documentDir={documentDir}
          onChange={onChange}
          onCursorLine={onCursorLine}
          onPasteFiles={onPasteFiles}
          onDropFiles={onDropFiles}
          onImageZoom={(src, alt) => setZoomImage({ src, alt })}
        />
      )}
      {doc.mode === "reader" && (
        <PreviewPane
          markdown={doc.markdown}
          documentDir={documentDir}
          debounceMs={0}
          onImageZoom={(src, alt) => setZoomImage({ src, alt })}
        />
      )}
      {zoomImage && (
        <ImageLightbox
          src={zoomImage.src}
          alt={zoomImage.alt}
          onClose={() => setZoomImage(null)}
          onEditSrc={
            doc.filePath
              ? (newSrc) => {
                  void insertLocalImage(doc, newSrc);
                  setZoomImage(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Left: CodeMirror source. Right: debounced preview with anchor-based
 *  bidirectional scroll sync (data-sourceline anchors, not percentages). */
function SplitView({
  doc,
  documentDir,
  onChange,
  onCursorLine,
  onPasteFiles,
  onDropFiles,
  onImageZoom,
}: {
  doc: DocumentSession;
  documentDir: string | null;
  onChange: (markdown: string) => void;
  onCursorLine: (line: number) => void;
  onPasteFiles: (files: File[]) => void;
  onDropFiles: (files: File[]) => void;
  onImageZoom: (src: string, alt: string) => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const syncing = useRef<"source" | "preview" | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guard = (side: "source" | "preview") => {
    syncing.current = side;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => (syncing.current = null), 120);
  };

  /** Source scrolled → align preview to the nearest anchored block. */
  const onSourceScrollLine = useCallback(
    (line: number) => {
      if (syncing.current === "preview") return;
      const container = previewRef.current;
      if (!container) return;
      const anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-sourceline]"));
      let best: HTMLElement | null = null;
      let bestLine = -Infinity;
      for (const el of anchors) {
        const l = Number(el.dataset.sourceline);
        if (!Number.isNaN(l) && l <= line && l > bestLine) {
          best = el;
          bestLine = l;
        }
      }
      if (best) {
        guard("source");
        container.scrollTo({
          top: Math.max(0, best.offsetTop - container.offsetTop - 24),
        });
      }
    },
    [],
  );

  const onPreviewScroll = useCallback(() => {
    if (syncing.current === "source") return;
    const container = previewRef.current;
    if (!container) return;
    const anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-sourceline]"));
    const top = container.scrollTop + container.offsetTop + 30;
    let line: number | null = null;
    for (const el of anchors) {
      const l = Number(el.dataset.sourceline);
      if (Number.isNaN(l)) continue;
      if (el.offsetTop <= top) line = l;
      else break;
    }
    if (line != null) {
      guard("preview");
      getEditor(doc.id)?.scrollToLine?.(line);
    }
  }, [doc.id]);

  return (
    <div className="grid h-full min-h-0 grid-cols-2">
      <div className="min-w-0 border-r border-[var(--border)]">
        <SourceEditor
          documentId={doc.id}
          initialMarkdown={doc.markdown}
          onChange={onChange}
          onCursorLine={onCursorLine}
          onScrollLine={onSourceScrollLine}
          onPasteFiles={onPasteFiles}
          onDropFiles={onDropFiles}
        />
      </div>
      <div className="min-w-0" onScrollCapture={onPreviewScroll}>
        <PreviewPane
          markdown={doc.markdown}
          documentDir={documentDir}
          scrollRef={previewRef}
          onNavigateSourceLine={(line) => getEditor(doc.id)?.scrollToLine?.(line)}
          onImageZoom={onImageZoom}
        />
      </div>
    </div>
  );
}
