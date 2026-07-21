import { create } from "zustand";
import { newId } from "@/lib/utils";
import { basename } from "@/lib/path";
import type {
  CursorState,
  DocumentId,
  DocumentSession,
  EditorMode,
  ExternalChangeState,
  SaveState,
  ScrollState,
  TabInfo,
} from "@/types";
import { backend, type FileContent } from "@/services/backend";
import { useSettingsStore } from "./settings";

export function createSession(partial: Partial<DocumentSession> = {}): DocumentSession {
  return {
    id: partial.id ?? newId(),
    filePath: partial.filePath ?? null,
    displayName: partial.displayName ?? "Untitled",
    markdown: partial.markdown ?? "",
    savedMarkdown: partial.savedMarkdown ?? partial.markdown ?? "",
    isDirty: partial.isDirty ?? (partial.markdown ?? "") !== (partial.savedMarkdown ?? partial.markdown ?? ""),
    mode: partial.mode ?? useSettingsStore.getState().settings.defaultMode,
    cursorState: partial.cursorState ?? null,
    scrollState: partial.scrollState ?? { top: 0, ratio: 0 },
    fileMetadata: partial.fileMetadata ?? null,
    externalChange: partial.externalChange ?? { status: "none" },
    contentVersion: partial.contentVersion ?? 0,
    editorVersion: partial.editorVersion ?? 0,
  };
}

function sessionFromFile(path: string, file: FileContent): DocumentSession {
  return createSession({
    filePath: path,
    displayName: basename(path),
    markdown: file.content,
    savedMarkdown: file.content,
    isDirty: false,
    fileMetadata: {
      encoding: file.encoding,
      lineEnding: file.lineEnding,
      modifiedMs: file.modifiedMs,
      sizeBytes: file.size,
    },
  });
}

interface DocumentsState {
  documents: Record<DocumentId, DocumentSession>;
  tabs: TabInfo[];
  activeId: DocumentId | null;
  closedHistory: DocumentId[];
  saveStates: Record<DocumentId, SaveState>;
  /** Suppress watcher handling right after our own saves. */
  lastSelfWriteMs: Record<string, number>;

  // session lifecycle
  newDocument: () => DocumentId;
  adoptSession: (session: DocumentSession, activate?: boolean) => void;
  openFile: (path: string) => Promise<DocumentId>;
  closeTab: (id: DocumentId) => void;
  closeOthers: (id: DocumentId) => void;
  closeRight: (id: DocumentId) => void;
  closeAll: () => void;
  reopenClosed: () => void;
  setActive: (id: DocumentId | null) => void;
  togglePin: (id: DocumentId) => void;
  moveTab: (from: number, to: number) => void;

  // content
  updateMarkdown: (id: DocumentId, markdown: string) => void;
  setMode: (id: DocumentId, mode: EditorMode) => void;
  setCursor: (id: DocumentId, cursor: CursorState) => void;
  setScroll: (id: DocumentId, scroll: ScrollState) => void;
  setEditorVersion: (id: DocumentId, version: number) => void;

  // persistence
  save: (id: DocumentId) => Promise<boolean>;
  saveAs: (id: DocumentId, path: string) => Promise<boolean>;
  saveAll: () => Promise<void>;
  markSaveState: (id: DocumentId, state: SaveState) => void;
  handleRenamed: (oldPath: string, newPath: string) => void;

  // external changes
  setExternalChange: (id: DocumentId, change: ExternalChangeState) => void;
  reloadFromDisk: (id: DocumentId) => Promise<void>;
  noteSelfWrite: (path: string) => void;

  // queries
  getActive: () => DocumentSession | null;
  findByPath: (path: string) => DocumentSession | null;
  hasUnsaved: () => boolean;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: {},
  tabs: [],
  activeId: null,
  closedHistory: [],
  saveStates: {},
  lastSelfWriteMs: {},

  newDocument: () => {
    const session = createSession({ isDirty: false });
    get().adoptSession(session, true);
    return session.id;
  },

  adoptSession: (session, activate = true) => {
    set((s) => ({
      documents: { ...s.documents, [session.id]: session },
      tabs: [...s.tabs, { documentId: session.id, pinned: false }],
      activeId: activate ? session.id : s.activeId,
      saveStates: { ...s.saveStates, [session.id]: "saved" },
    }));
  },

  openFile: async (path) => {
    const existing = get().findByPath(path);
    if (existing) {
      set({ activeId: existing.id });
      return existing.id;
    }
    const file = await backend.readFile(path);
    const session = sessionFromFile(path, file);
    get().adoptSession(session, true);
    if (useSettingsStore.getState().settings.detectExternalChanges) {
      void backend.watchPath(path).catch(() => {});
    }
    return session.id;
  },

  closeTab: (id) => {
    const tab = get().tabs.find((t) => t.documentId === id);
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.documentId === id);
      const tabs = s.tabs.filter((t) => t.documentId !== id);
      const closedHistory = tab?.pinned ? s.closedHistory : [...s.closedHistory, id];
      let activeId = s.activeId;
      if (activeId === id) {
        activeId = tabs[Math.min(idx, tabs.length - 1)]?.documentId ?? null;
      }
      return { tabs, closedHistory, activeId };
    });
  },

  closeOthers: (id) => {
    set((s) => {
      const closing = s.tabs.filter((t) => t.documentId !== id && !t.pinned);
      return {
        tabs: s.tabs.filter((t) => t.documentId === id || t.pinned),
        closedHistory: [...s.closedHistory, ...closing.map((t) => t.documentId)],
        activeId: s.activeId && s.activeId !== id && !s.tabs.find((t) => t.documentId === s.activeId && t.pinned) ? id : s.activeId,
      };
    });
  },

  closeRight: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.documentId === id);
      if (idx === -1) return s;
      const closing = s.tabs.slice(idx + 1).filter((t) => !t.pinned);
      const tabs = s.tabs.filter((t, i) => i <= idx || t.pinned);
      let activeId = s.activeId;
      if (activeId && closing.some((t) => t.documentId === activeId)) {
        activeId = id;
      }
      return { tabs, closedHistory: [...s.closedHistory, ...closing.map((t) => t.documentId)], activeId };
    });
  },

  closeAll: () => {
    set((s) => ({
      tabs: [],
      activeId: null,
      closedHistory: [...s.closedHistory, ...s.tabs.filter((t) => !t.pinned).map((t) => t.documentId)],
    }));
  },

  reopenClosed: () => {
    const { closedHistory, documents, tabs } = get();
    const id = [...closedHistory].reverse().find((cid) => documents[cid]);
    if (!id) return;
    set({
      closedHistory: closedHistory.filter((c) => c !== id),
      tabs: [...tabs, { documentId: id, pinned: false }],
      activeId: id,
    });
  },

  setActive: (id) => set({ activeId: id }),

  togglePin: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.documentId === id ? { ...t, pinned: !t.pinned } : t)),
    })),

  moveTab: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.tabs.length || to >= s.tabs.length) return s;
      const tabs = [...s.tabs];
      const [moved] = tabs.splice(from, 1);
      tabs.splice(to, 0, moved);
      return { tabs };
    }),

  updateMarkdown: (id, markdown) =>
    set((s) => {
      const doc = s.documents[id];
      if (!doc) return s;
      return {
        documents: {
          ...s.documents,
          [id]: {
            ...doc,
            markdown,
            isDirty: markdown !== doc.savedMarkdown,
            contentVersion: doc.contentVersion + 1,
          },
        },
        saveStates: { ...s.saveStates, [id]: markdown !== doc.savedMarkdown ? "unsaved" : "saved" },
      };
    }),

  setMode: (id, mode) =>
    set((s) => {
      const doc = s.documents[id];
      if (!doc) return s;
      return { documents: { ...s.documents, [id]: { ...doc, mode } } };
    }),

  setCursor: (id, cursor) =>
    set((s) => {
      const doc = s.documents[id];
      if (!doc) return s;
      return { documents: { ...s.documents, [id]: { ...doc, cursorState: cursor } } };
    }),

  setScroll: (id, scroll) =>
    set((s) => {
      const doc = s.documents[id];
      if (!doc) return s;
      return { documents: { ...s.documents, [id]: { ...doc, scrollState: scroll } } };
    }),

  setEditorVersion: (id, version) =>
    set((s) => {
      const doc = s.documents[id];
      if (!doc) return s;
      return { documents: { ...s.documents, [id]: { ...doc, editorVersion: version } } };
    }),

  save: async (id) => {
    const doc = get().documents[id];
    if (!doc || !doc.filePath) return false;
    get().markSaveState(id, "saving");
    const settings = useSettingsStore.getState().settings;
    try {
      const result = await backend.writeFileAtomic(doc.filePath, doc.markdown, {
        lineEnding: settings.lineEnding,
        ensureFinalNewline: settings.trailingNewline,
      });
      get().noteSelfWrite(doc.filePath);
      set((s) => {
        const current = s.documents[id];
        if (!current) return s;
        return {
          documents: {
            ...s.documents,
            [id]: {
              ...current,
              savedMarkdown: current.markdown,
              isDirty: false,
              fileMetadata: {
                encoding: current.fileMetadata?.encoding ?? "utf-8",
                lineEnding: result.lineEnding,
                modifiedMs: result.modifiedMs,
                sizeBytes: result.size,
              },
            },
          },
          saveStates: { ...s.saveStates, [id]: "saved" },
        };
      });
      return true;
    } catch {
      get().markSaveState(id, "failed");
      return false;
    }
  },

  saveAs: async (id, path) => {
    const doc = get().documents[id];
    if (!doc) return false;
    set((s) => ({
      documents: {
        ...s.documents,
        [id]: { ...s.documents[id], filePath: path, displayName: basename(path) },
      },
    }));
    const ok = await get().save(id);
    if (ok && useSettingsStore.getState().settings.detectExternalChanges) {
      void backend.watchPath(path).catch(() => {});
    }
    return ok;
  },

  saveAll: async () => {
    const { documents } = get();
    for (const doc of Object.values(documents)) {
      if (doc.isDirty && doc.filePath) {
        await get().save(doc.id);
      }
    }
  },

  markSaveState: (id, state) =>
    set((s) => ({ saveStates: { ...s.saveStates, [id]: state } })),

  handleRenamed: (oldPath, newPath) =>
    set((s) => {
      const entries = Object.entries(s.documents).map(([docId, doc]) =>
        doc.filePath === oldPath
          ? [docId, { ...doc, filePath: newPath, displayName: basename(newPath) }]
          : [docId, doc],
      );
      return { documents: Object.fromEntries(entries) as Record<DocumentId, DocumentSession> };
    }),

  setExternalChange: (id, change) =>
    set((s) => {
      const doc = s.documents[id];
      if (!doc) return s;
      return { documents: { ...s.documents, [id]: { ...doc, externalChange: change } } };
    }),

  reloadFromDisk: async (id) => {
    const doc = get().documents[id];
    if (!doc?.filePath) return;
    const file = await backend.readFile(doc.filePath);
    set((s) => {
      const current = s.documents[id];
      if (!current) return s;
      return {
        documents: {
          ...s.documents,
          [id]: {
            ...current,
            markdown: file.content,
            savedMarkdown: file.content,
            isDirty: false,
            contentVersion: current.contentVersion + 1,
            externalChange: { status: "none" },
            fileMetadata: {
              encoding: file.encoding,
              lineEnding: file.lineEnding,
              modifiedMs: file.modifiedMs,
              sizeBytes: file.size,
            },
          },
        },
        saveStates: { ...s.saveStates, [id]: "saved" },
      };
    });
  },

  noteSelfWrite: (path) =>
    set((s) => ({ lastSelfWriteMs: { ...s.lastSelfWriteMs, [path]: Date.now() } })),

  getActive: () => {
    const { activeId, documents } = get();
    return activeId ? documents[activeId] ?? null : null;
  },

  findByPath: (path) => Object.values(get().documents).find((d) => d.filePath === path) ?? null,

  hasUnsaved: () => Object.values(get().documents).some((d) => d.isDirty),
}));
