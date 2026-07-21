/**
 * Session persistence: open tabs, workspace root, per-document cursor/scroll
 * and a crash-recovery stash for unsaved content.
 *
 * The recovery stash only holds documents that are dirty; entries are removed
 * on successful save or explicit close, and stashes older than 7 days are
 * discarded on load.
 */
import { loadPersisted, savePersisted } from "./persistence";
import {
  createSession,
  useDocumentsStore,
} from "@/stores/documents";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { backend } from "./backend";
import type { DocumentSession, EditorMode } from "@/types";

const SESSION_KEY = "session";
const RECOVERY_KEY = "recovery";
const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PersistedTab {
  filePath: string | null;
  mode: EditorMode;
  cursor: DocumentSession["cursorState"];
  scroll: DocumentSession["scrollState"];
  pinned: boolean;
}

interface PersistedSession {
  workspaceRoot: string | null;
  activeIndex: number;
  tabs: PersistedTab[];
}

interface RecoveryEntry {
  filePath: string | null;
  displayName: string;
  markdown: string;
  stashedAt: number;
}

export function persistSession() {
  const { tabs, documents, activeId } = useDocumentsStore.getState();
  const root = useWorkspaceStore.getState().root;
  const session: PersistedSession = {
    workspaceRoot: root,
    activeIndex: Math.max(
      0,
      tabs.findIndex((t) => t.documentId === activeId),
    ),
    tabs: tabs.map((t) => {
      const doc = documents[t.documentId];
      return {
        filePath: doc?.filePath ?? null,
        mode: doc?.mode ?? "wysiwyg",
        cursor: doc?.cursorState ?? null,
        scroll: doc?.scrollState ?? { top: 0, ratio: 0 },
        pinned: t.pinned,
      };
    }),
  };
  void savePersisted(SESSION_KEY, session);
}

/** Stash dirty documents for crash recovery. Call on beforeunload + autosave. */
export function persistRecovery() {
  const { documents } = useDocumentsStore.getState();
  const entries: RecoveryEntry[] = Object.values(documents)
    .filter((d) => d.isDirty)
    .map((d) => ({
      filePath: d.filePath,
      displayName: d.displayName,
      markdown: d.markdown,
      stashedAt: Date.now(),
    }));
  void savePersisted(RECOVERY_KEY, entries);
}

export async function restoreSession(): Promise<void> {
  const settings = useSettingsStore.getState().settings;
  if (!settings.restoreSession) return;

  // 1) crash recovery wins over plain session restore
  const recovery = await loadPersisted<RecoveryEntry[]>(RECOVERY_KEY);
  const fresh = (recovery ?? []).filter((e) => Date.now() - e.stashedAt < RECOVERY_TTL_MS);
  if (fresh.length > 0) {
    const store = useDocumentsStore.getState();
    for (const entry of fresh) {
      store.adoptSession(
        createSession({
          filePath: entry.filePath,
          displayName: `${entry.displayName} (recovered)`,
          markdown: entry.markdown,
          savedMarkdown: "",
          isDirty: true,
        }),
        false,
      );
    }
    void savePersisted(RECOVERY_KEY, []);
  }

  // 2) restore tabs pointing at files
  const session = await loadPersisted<PersistedSession>(SESSION_KEY);
  if (!session) return;
  if (session.workspaceRoot) {
    try {
      await useWorkspaceStore.getState().openFolder(session.workspaceRoot);
    } catch {
      // workspace may have been moved/deleted; continue without it
    }
  }
  const store = useDocumentsStore.getState();
  for (const tab of session.tabs) {
    if (!tab.filePath) continue;
    if (store.findByPath(tab.filePath)) continue;
    try {
      const id = await store.openFile(tab.filePath);
      store.setMode(id, tab.mode);
      if (tab.cursor) store.setCursor(id, tab.cursor);
      if (tab.scroll) store.setScroll(id, tab.scroll);
    } catch {
      // file no longer readable; skip it
    }
  }
  const { tabs } = useDocumentsStore.getState();
  const target = tabs[session.activeIndex];
  if (target) store.setActive(target.documentId);
}

/** Watch a file path for external modification events (open documents). */
export async function watchOpenDocuments(): Promise<void> {
  const { documents } = useDocumentsStore.getState();
  if (!useSettingsStore.getState().settings.detectExternalChanges) return;
  for (const doc of Object.values(documents)) {
    if (doc.filePath) {
      await backend.watchPath(doc.filePath).catch(() => {});
    }
  }
}
