import { create } from "zustand";
import { detectSystemLocale, setLocale, type Locale } from "@/i18n";
import { loadPersisted, savePersisted } from "@/services/persistence";
import type { EditorMode } from "@/types";

export type ThemeName = "light" | "dark" | "sepia" | "high-contrast";

export interface Settings {
  // general
  restoreSession: boolean;
  autoSave: boolean;
  autoSaveDelayMs: number;
  defaultMode: EditorMode;
  theme: ThemeName;
  followSystemTheme: boolean;
  language: Locale | "system";
  recentLimit: number;
  // editor
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  spellcheck: boolean;
  autoPair: boolean;
  focusMode: boolean;
  focusDim: number;
  typewriterMode: boolean;
  // markdown
  gfm: boolean;
  math: boolean;
  mermaid: boolean;
  autoLink: boolean;
  headingAnchors: boolean;
  frontMatter: boolean;
  assetDir: string;
  // appearance
  contentMaxWidth: number;
  sidebarWidth: number;
  outlineWidth: number;
  animations: boolean;
  reduceMotion: boolean;
  // files
  lineEnding: "preserve" | "lf" | "crlf";
  trailingNewline: boolean;
  ignoredDirs: string[];
  detectExternalChanges: boolean;
  showHiddenFiles: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  restoreSession: true,
  autoSave: true,
  autoSaveDelayMs: 1500,
  defaultMode: "wysiwyg",
  theme: "light",
  followSystemTheme: true,
  language: "system",
  recentLimit: 10,
  fontFamily: "",
  fontSize: 16,
  lineHeight: 1.7,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  spellcheck: false,
  autoPair: true,
  focusMode: false,
  focusDim: 0.35,
  typewriterMode: false,
  gfm: true,
  math: true,
  mermaid: true,
  autoLink: true,
  headingAnchors: true,
  frontMatter: true,
  assetDir: "assets",
  contentMaxWidth: 760,
  sidebarWidth: 240,
  outlineWidth: 220,
  animations: true,
  reduceMotion: false,
  lineEnding: "preserve",
  trailingNewline: false,
  ignoredDirs: [],
  detectExternalChanges: true,
  showHiddenFiles: false,
};

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  zoom: number;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  resetDefaults: () => void;
  setZoom: (zoom: number) => void;
}

const SETTINGS_KEY = "settings";

function effectiveLocale(s: Settings): Locale {
  return s.language === "system" ? detectSystemLocale() : s.language;
}

function applySideEffects(s: Settings) {
  setLocale(effectiveLocale(s));
}

interface MediaQueryLike {
  matches: boolean;
  addEventListener?: (type: string, cb: () => void) => void;
}

function systemDark(mq?: MediaQueryLike): boolean {
  const query =
    mq ??
    (typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : undefined);
  return query?.matches ?? false;
}

/** Resolve the concrete theme given follow-system state (exported for tests). */
export function resolveTheme(s: Settings, dark: boolean): ThemeName {
  return s.followSystemTheme ? (dark ? "dark" : "light") : s.theme;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  zoom: 1,
  load: async () => {
    const persisted = await loadPersisted<Partial<Settings>>(SETTINGS_KEY);
    const settings = { ...DEFAULT_SETTINGS, ...(persisted ?? {}) };
    applySideEffects(settings);
    set({ settings, loaded: true });
  },
  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    applySideEffects(settings);
    set({ settings });
    void savePersisted(SETTINGS_KEY, settings);
  },
  resetDefaults: () => {
    applySideEffects(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
    void savePersisted(SETTINGS_KEY, DEFAULT_SETTINGS);
  },
  setZoom: (zoom) => set({ zoom: Math.min(2, Math.max(0.5, zoom)) }),
}));

/** Apply theme + typography settings to the document root. */
export function applyAppearance(s: Settings, zoom: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = resolveTheme(s, systemDark());
  root.setAttribute("data-theme", theme);
  root.style.setProperty("--editor-font-size", `${Math.round(s.fontSize * zoom)}px`);
  root.style.setProperty("--editor-line-height", String(s.lineHeight));
  root.style.setProperty("--content-max-width", `${s.contentMaxWidth}px`);
  root.style.setProperty("--sidebar-width", `${s.sidebarWidth}px`);
  root.style.setProperty("--outline-width", `${s.outlineWidth}px`);
  root.style.setProperty("--focus-dim", String(s.focusDim));
  if (s.fontFamily.trim()) {
    root.style.setProperty("--font-editor", `${s.fontFamily}, var(--font-ui)`);
  } else {
    root.style.removeProperty("--font-editor");
  }
}

/** Subscribe to OS dark-mode changes; call once at app start. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
