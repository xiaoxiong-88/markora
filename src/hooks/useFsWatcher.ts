import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri, backend } from "@/services/backend";
import { useDocumentsStore } from "@/stores/documents";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { t } from "@/i18n";
import { dirname } from "@/lib/path";
import type { FsEventPayload } from "@/types";

/**
 * Global filesystem watcher bridge.
 *
 * - Workspace events refresh the affected tree directories (debounced by the
 *   store refresh calls).
 * - Open-document events implement the external-change policy: clean docs
 *   auto-reload with a toast; dirty docs enter the conflict state and the
 *   UI shows the resolution dialog. Own writes are suppressed via the
 *   `lastSelfWriteMs` timestamps recorded by the documents store.
 */
export function useFsWatcher() {
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const pendingRefresh = new Map<string, ReturnType<typeof setTimeout>>();

    const unlistenPromise = listen<FsEventPayload>("markora://fs-event", (event) => {
      if (disposed) return;
      const { kind, paths } = event.payload;
      if (!["create", "modify", "remove", "rename"].includes(kind)) return;

      const docs = useDocumentsStore.getState();
      const settings = useSettingsStore.getState().settings;

      for (const path of paths) {
        // 1) workspace tree refresh (debounced per directory)
        const ws = useWorkspaceStore.getState();
        if (ws.root && path.startsWith(ws.root)) {
          const dir = kind === "remove" ? dirname(path) : path;
          const target = ws.children[dir] ? dir : dirname(path);
          const existing = pendingRefresh.get(target);
          if (existing) clearTimeout(existing);
          pendingRefresh.set(
            target,
            setTimeout(() => {
              void useWorkspaceStore.getState().refreshDir(target);
              void useWorkspaceStore.getState().loadWorkspaceFiles();
              pendingRefresh.delete(target);
            }, 250),
          );
        }

        // 2) open document external-change handling
        const doc = Object.values(docs.documents).find((d) => d.filePath === path);
        if (!doc || !settings.detectExternalChanges) continue;

        // suppress events caused by our own saves (2s window)
        const selfWrite = docs.lastSelfWriteMs[path];
        if (selfWrite && Date.now() - selfWrite < 2000) continue;

        void (async () => {
          const store = useDocumentsStore.getState();
          if (kind === "remove") {
            if (!doc.isDirty) {
              // file deleted externally; keep buffer, mark conflict-free
              return;
            }
            return;
          }
          try {
            const file = await backend.readFile(path);
            const current = useDocumentsStore.getState().documents[doc.id];
            if (!current) return;
            if (!current.isDirty && current.markdown !== file.content) {
              await store.reloadFromDisk(doc.id);
              useUiStore.getState().toast(t().toast.reloaded);
            } else if (current.isDirty && current.savedMarkdown !== file.content) {
              store.setExternalChange(doc.id, {
                status: "conflict",
                diskContent: file.content,
                diskModifiedMs: file.modifiedMs,
              });
            }
          } catch {
            // file may be transiently unreadable during writes; ignore
          }
        })();
      }
    });

    return () => {
      disposed = true;
      for (const timer of pendingRefresh.values()) clearTimeout(timer);
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
