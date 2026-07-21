import type { EditorMode } from "./document";

export type ThemeName = "light" | "dark" | "sepia" | "high-contrast";
export type ThemeSetting = ThemeName | "system";
export type LanguageSetting = "system" | "zh-CN" | "en-US";
export type LineEndingSetting = "preserve" | "lf" | "crlf";

export interface AppSettings {
  general: {
    restoreSession: boolean;
    autosave: boolean;
    autosaveDelayMs: number;
    defaultMode: EditorMode;
    language: LanguageSetting;
    maxRecent: number;
  };
  editor: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    tabSize: number;
    wordWrap: boolean;
    lineNumbers: boolean;
    spellcheck: boolean;
  };
  files: {
    lineEnding: LineEndingSetting;
    ensureFinalNewline: boolean;
    showHiddenFiles: boolean;
    extraIgnores: string[];
    externalChangeDetection: boolean;
  };
  appearance: {
    theme: ThemeSetting;
    contentMaxWidth: number;
    sidebarWidth: number;
    outlineWidth: number;
    reduceMotion: boolean;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    restoreSession: true,
    autosave: false,
    autosaveDelayMs: 1500,
    defaultMode: "source",
    language: "system",
    maxRecent: 15,
  },
  editor: {
    fontFamily: "system",
    fontSize: 15,
    lineHeight: 1.7,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: true,
    spellcheck: false,
  },
  files: {
    lineEnding: "preserve",
    ensureFinalNewline: true,
    showHiddenFiles: false,
    extraIgnores: [],
    externalChangeDetection: true,
  },
  appearance: {
    theme: "system",
    contentMaxWidth: 760,
    sidebarWidth: 260,
    outlineWidth: 220,
    reduceMotion: false,
  },
};

/** Layout state persisted separately from user settings. */
export interface LayoutState {
  sidebarVisible: boolean;
  outlineVisible: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  zoom: number;
}

export const DEFAULT_LAYOUT: LayoutState = {
  sidebarVisible: true,
  outlineVisible: false,
  focusMode: false,
  typewriterMode: false,
  zoom: 1,
};

/** One open tab as persisted for session restore. */
export interface PersistedTab {
  filePath: string | null;
  mode: EditorMode;
  pinned: boolean;
}

export interface PersistedSession {
  tabs: PersistedTab[];
  activeFilePath: string | null;
  workspaceRoot: string | null;
}

export interface RecentEntry {
  path: string;
  openedAt: number;
}
