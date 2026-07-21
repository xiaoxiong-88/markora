import { useEffect } from "react";
import { useDocumentsStore } from "@/stores/documents";
import { useSettingsStore } from "@/stores/settings";
import { saveDocument } from "@/services/actions";
import { debounce } from "@/lib/utils";

/**
 * Debounced autosave. When a document's markdown changes and autosave is on,
 * schedules a save after the configured delay. The delay is read from settings
 * each fire so changes apply without remounting.
 */
export function useAutosave() {
  useEffect(() => {
    const saveDirty = debounce(() => {
      const { settings } = useSettingsStore.getState();
      if (!settings.autoSave) return;
      const { documents } = useDocumentsStore.getState();
      for (const doc of Object.values(documents)) {
        if (doc.isDirty && doc.filePath) void saveDocument(doc.id);
      }
    }, 1500);

    const unsubscribe = useDocumentsStore.subscribe((state, prev) => {
      const changed = Object.keys(state.documents).some(
        (id) => state.documents[id]?.markdown !== prev.documents[id]?.markdown,
      );
      if (changed) void saveDirty();
    });

    return () => {
      saveDirty.cancel();
      unsubscribe();
    };
     
  }, []);
}
