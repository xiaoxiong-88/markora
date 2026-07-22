import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/services/backend";
import { openFilePath } from "@/services/actions";

/** Extensions registered in tauri.conf.json fileAssociations. */
const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkd"];

function isMarkdownPath(path: string) {
  const lower = path.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Opens Markdown files dropped anywhere on the window. Returns whether files
 * are currently hovering over the window so the UI can show a drop hint.
 */
export function useFileDrop() {
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;

    const unlistenPromise = getCurrentWindow().onDragDropEvent((event) => {
      if (disposed) return;
      const { type } = event.payload;
      if (type === "enter" || type === "over") {
        setIsDragOver(true);
      } else if (type === "leave") {
        setIsDragOver(false);
      } else if (type === "drop") {
        setIsDragOver(false);
        for (const path of event.payload.paths.filter(isMarkdownPath)) {
          void openFilePath(path);
        }
      }
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return isDragOver;
}
