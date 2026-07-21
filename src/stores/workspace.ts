import { create } from "zustand";
import type { DirEntry, RecentItem } from "@/types";
import { backend } from "@/services/backend";
import { loadPersisted, savePersisted } from "@/services/persistence";
import { useSettingsStore } from "./settings";

interface WorkspaceState {
  root: string | null;
  /** dir path -> children (lazy, one level at a time). */
  children: Record<string, DirEntry[]>;
  /** dir path -> expanded. */
  expanded: Record<string, boolean>;
  loadingDirs: Record<string, boolean>;
  /** Flat markdown file list for quick open. */
  workspaceFiles: string[];
  recentFiles: RecentItem[];
  recentFolders: RecentItem[];

  openFolder: (path: string) => Promise<void>;
  closeFolder: () => void;
  toggleDir: (path: string) => Promise<void>;
  expandTo: (path: string) => Promise<void>;
  refreshDir: (path: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  removeDirState: (path: string) => void;
  loadWorkspaceFiles: () => Promise<void>;
  loadRecents: () => Promise<void>;
  addRecentFile: (path: string) => void;
  addRecentFolder: (path: string) => void;
  removeRecentFile: (path: string) => void;
}

const RECENT_FILES_KEY = "recentFiles";
const RECENT_FOLDERS_KEY = "recentFolders";

function ignored(): string[] {
  return useSettingsStore.getState().settings.ignoredDirs;
}

function showHidden(): boolean {
  return useSettingsStore.getState().settings.showHiddenFiles;
}

function pushRecent(list: RecentItem[], path: string): RecentItem[] {
  const limit = useSettingsStore.getState().settings.recentLimit;
  return [{ path, openedAt: Date.now() }, ...list.filter((r) => r.path !== path)].slice(0, limit);
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  children: {},
  expanded: {},
  loadingDirs: {},
  workspaceFiles: [],
  recentFiles: [],
  recentFolders: [],

  openFolder: async (path) => {
    set({ root: path, children: {}, expanded: { [path]: true }, workspaceFiles: [] });
    await get().refreshDir(path);
    void backend.watchPath(path).catch(() => {});
    void get().loadWorkspaceFiles();
    get().addRecentFolder(path);
  },

  closeFolder: () => {
    const root = get().root;
    if (root) void backend.unwatchPath(root).catch(() => {});
    set({ root: null, children: {}, expanded: {}, workspaceFiles: [] });
  },

  toggleDir: async (path) => {
    const { expanded, children } = get();
    if (expanded[path]) {
      set({ expanded: { ...expanded, [path]: false } });
      return;
    }
    set({ expanded: { ...expanded, [path]: true } });
    if (!children[path]) {
      await get().refreshDir(path);
    }
  },

  /** Expand the ancestor chain of a file path so it becomes visible. */
  expandTo: async (path) => {
    const root = get().root;
    if (!root || !path.startsWith(root)) return;
    const sep = path.includes("\\") && !path.includes("/") ? "\\" : "/";
    const parts = path.split(sep);
    let current = parts[0] === "" ? sep : parts[0];
    const startIdx = parts[0] === "" ? 1 : 1;
    for (let i = startIdx; i < parts.length - 1; i++) {
      current = current === sep ? sep + parts[i] : current + sep + parts[i];
      if (current.length < root.length) continue;
      set((s) => ({ expanded: { ...s.expanded, [current]: true } }));
      if (!get().children[current]) {
        await get().refreshDir(current);
      }
    }
  },

  refreshDir: async (path) => {
    set((s) => ({ loadingDirs: { ...s.loadingDirs, [path]: true } }));
    try {
      const entries = await backend.listDirectory(path, {
        showHidden: showHidden(),
        extraIgnores: ignored(),
      });
      set((s) => ({
        children: { ...s.children, [path]: entries },
        loadingDirs: { ...s.loadingDirs, [path]: false },
      }));
    } catch {
      set((s) => ({ loadingDirs: { ...s.loadingDirs, [path]: false } }));
    }
  },

  refreshTree: async () => {
    const { root, children } = get();
    if (!root) return;
    await get().refreshDir(root);
    // refresh every previously loaded directory that still exists
    for (const dir of Object.keys(children)) {
      if (dir === root) continue;
      if (await backend.pathExists(dir)) {
        await get().refreshDir(dir);
      } else {
        get().removeDirState(dir);
      }
    }
    void get().loadWorkspaceFiles();
  },

  removeDirState: (path) =>
    set((s) => {
      const children = { ...s.children };
      const expanded = { ...s.expanded };
      for (const key of Object.keys(children)) {
        if (key === path || key.startsWith(path + "/") || key.startsWith(path + "\\")) {
          delete children[key];
          delete expanded[key];
        }
      }
      return { children, expanded };
    }),

  loadWorkspaceFiles: async () => {
    const root = get().root;
    if (!root) return;
    try {
      const files = await backend.listWorkspaceFiles(root, 3000, ignored());
      set({ workspaceFiles: files });
    } catch {
      set({ workspaceFiles: [] });
    }
  },

  loadRecents: async () => {
    const [files, folders] = await Promise.all([
      loadPersisted<RecentItem[]>(RECENT_FILES_KEY),
      loadPersisted<RecentItem[]>(RECENT_FOLDERS_KEY),
    ]);
    set({ recentFiles: files ?? [], recentFolders: folders ?? [] });
  },

  addRecentFile: (path) => {
    const recentFiles = pushRecent(get().recentFiles, path);
    set({ recentFiles });
    void savePersisted(RECENT_FILES_KEY, recentFiles);
  },

  addRecentFolder: (path) => {
    const recentFolders = pushRecent(get().recentFolders, path);
    set({ recentFolders });
    void savePersisted(RECENT_FOLDERS_KEY, recentFolders);
  },

  removeRecentFile: (path) => {
    const recentFiles = get().recentFiles.filter((r) => r.path !== path);
    set({ recentFiles });
    void savePersisted(RECENT_FILES_KEY, recentFiles);
  },
}));
