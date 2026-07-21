import { create } from "zustand";
import { newId } from "@/lib/utils";

export interface Toast {
  id: string;
  message: string;
  kind: "info" | "success" | "error";
}

interface UiState {
  sidebarVisible: boolean;
  outlineVisible: boolean;
  commandPaletteOpen: boolean;
  quickOpenOpen: boolean;
  settingsOpen: boolean;
  workspaceSearchOpen: boolean;
  goToHeadingOpen: boolean;
  fullscreen: boolean;
  toasts: Toast[];

  toggleSidebar: () => void;
  toggleOutline: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickOpenOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setWorkspaceSearchOpen: (open: boolean) => void;
  setGoToHeadingOpen: (open: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarVisible: true,
  outlineVisible: false,
  commandPaletteOpen: false,
  quickOpenOpen: false,
  settingsOpen: false,
  workspaceSearchOpen: false,
  goToHeadingOpen: false,
  fullscreen: false,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleOutline: () => set((s) => ({ outlineVisible: !s.outlineVisible })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickOpenOpen: (open) => set({ quickOpenOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setWorkspaceSearchOpen: (open) => set({ workspaceSearchOpen: open }),
  setGoToHeadingOpen: (open) => set({ goToHeadingOpen: open }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  toast: (message, kind = "info") => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => get().dismissToast(id), kind === "error" ? 6000 : 3000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
