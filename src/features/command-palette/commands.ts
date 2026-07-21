/**
 * Central command registry. Commands are plain objects with an id, localized
 * title, optional shortcut id and a run function; the palette, menus and
 * keyboard system all consume this single source of truth.
 */
import { t } from "@/i18n";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { useSettingsStore, type ThemeName } from "@/stores/settings";
import {
  newDocument,
  openFileDialog,
  openFolderDialog,
  saveAllDocuments,
  saveDocument,
  saveDocumentAs,
  closeTabGuarded,
} from "@/services/actions";
import { switchMode } from "@/features/editor/modeSwitch";
import { getEditor } from "@/features/editor/editorRegistry";
import { exportActiveToHtml, printActive } from "@/features/export/exportHtml";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@/services/backend";

export interface Command {
  id: string;
  /** A localized title: either a static string or a function so the palette
   *  can refresh labels on locale change. Call sites normalize both. */
  title: string | (() => string);
  /** keybinding descriptor, e.g. "Mod+Shift+P" (Mod = Cmd on macOS). */
  shortcut?: string;
  // Return values are intentionally discarded (commands are fire-and-forget),
  // so `unknown` keeps every action assignable.
  run: () => unknown;
}

function activeId(): string | null {
  return useDocumentsStore.getState().activeId;
}

function withActive(fn: (id: string) => unknown) {
  return () => {
    const id = activeId();
    if (id) return fn(id);
  };
}

/** Wrap selection of the active editor with the given markers. */
export function applyWrap(open: string, close: string) {
  const id = activeId();
  if (!id) return;
  getEditor(id)?.wrapSelection?.(open, close);
}

/** Prefix the current line(s) (heading, quote, list markers). */
export function applyLinePrefix(prefix: string) {
  const id = activeId();
  if (!id) return;
  const editor = getEditor(id);
  if (editor?.insertMarkdown) {
    // Line-prefix operations are handled per-editor; the wrap fallback
    // inserts the prefix at the cursor, which is correct for empty lines.
    editor.insertMarkdown(prefix);
  }
}

export function insertSnippetAtCursor(snippet: string) {
  const id = activeId();
  if (!id) return;
  getEditor(id)?.insertMarkdown?.(snippet);
}

const THEMES: ThemeName[] = ["light", "dark", "sepia", "high-contrast"];

export function buildCommands(): Command[] {
  const s = () => t().command;
  const ui = () => useUiStore.getState();
  const settings = () => useSettingsStore.getState();

  return [
    { id: "new-file", title: s().newFile, shortcut: "Mod+N", run: () => void newDocument() },
    { id: "open-file", title: s().openFile, shortcut: "Mod+O", run: () => openFileDialog() },
    { id: "open-folder", title: s().openFolder, shortcut: "Mod+Shift+O", run: () => openFolderDialog() },
    { id: "save", title: s().save, shortcut: "Mod+S", run: withActive((id) => saveDocument(id)) },
    { id: "save-as", title: s().saveAs, shortcut: "Mod+Shift+S", run: withActive((id) => saveDocumentAs(id)) },
    { id: "save-all", title: s().saveAll, run: () => saveAllDocuments() },
    { id: "close-tab", title: () => t().menu.closeTab, shortcut: "Mod+W", run: withActive((id) => closeTabGuarded(id)) },
    {
      id: "reopen-tab",
      title: () => t().menu.reopenClosed,
      shortcut: "Mod+Shift+T",
      run: () => useDocumentsStore.getState().reopenClosed(),
    },
    { id: "quick-open", title: s().quickOpen, shortcut: "Mod+P", run: () => ui().setQuickOpenOpen(true) },
    { id: "command-palette", title: () => t().palette.placeholder, shortcut: "Mod+Shift+P", run: () => ui().setCommandPaletteOpen(true) },
    { id: "find", title: s().find, shortcut: "Mod+F", run: () => document.dispatchEvent(new CustomEvent("markora:find")) },
    { id: "workspace-search", title: s().workspaceSearch, shortcut: "Mod+Shift+F", run: () => ui().setWorkspaceSearchOpen(true) },
    { id: "go-to-heading", title: s().goToHeading, run: () => ui().setGoToHeadingOpen(true) },
    { id: "export-html", title: s().exportHtml, run: () => exportActiveToHtml() },
    { id: "print", title: s().print, run: () => printActive() },
    {
      id: "toggle-theme",
      title: s().toggleTheme,
      run: () => {
        const st = settings();
        const idx = THEMES.indexOf(st.settings.theme);
        st.update({ theme: THEMES[(idx + 1) % THEMES.length], followSystemTheme: false });
      },
    },
    { id: "toggle-sidebar", title: s().toggleSidebar, shortcut: "Mod+Shift+B", run: () => ui().toggleSidebar() },
    { id: "toggle-outline", title: s().toggleOutline, run: () => ui().toggleOutline() },
    {
      id: "toggle-focus",
      title: s().toggleFocus,
      shortcut: "F8",
      run: () => settings().update({ focusMode: !settings().settings.focusMode }),
    },
    {
      id: "toggle-typewriter",
      title: s().toggleTypewriter,
      shortcut: "F9",
      run: () => settings().update({ typewriterMode: !settings().settings.typewriterMode }),
    },
    {
      id: "fullscreen",
      title: s().fullscreen,
      shortcut: "F11",
      run: () => {
        if (isTauri()) {
          const win = getCurrentWindow();
          void win.isFullscreen().then((f) => void win.setFullscreen(!f));
        } else if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          void document.documentElement.requestFullscreen();
        }
      },
    },
    { id: "mode-wysiwyg", title: s().modeWysiwyg, run: withActive((id) => switchMode(id, "wysiwyg")) },
    { id: "mode-source", title: s().modeSource, shortcut: "Mod+/", run: withActive((id) => {
      const doc = useDocumentsStore.getState().documents[id];
      switchMode(id, doc?.mode === "source" ? "wysiwyg" : "source");
    }) },
    { id: "mode-split", title: s().modeSplit, run: withActive((id) => switchMode(id, "split")) },
    { id: "mode-reader", title: s().modeReader, run: withActive((id) => switchMode(id, "reader")) },
    { id: "open-settings", title: s().openSettings, run: () => ui().setSettingsOpen(true) },
    { id: "zoom-in", title: s().zoomIn, shortcut: "Mod+=", run: () => settings().setZoom(settings().zoom + 0.1) },
    { id: "zoom-out", title: s().zoomOut, shortcut: "Mod+-", run: () => settings().setZoom(settings().zoom - 0.1) },
    { id: "zoom-reset", title: s().zoomReset, shortcut: "Mod+0", run: () => settings().setZoom(1) },
    // formatting commands (also bound as direct shortcuts)
    { id: "fmt-bold", title: () => "Bold", shortcut: "Mod+B", run: () => applyWrap("**", "**") },
    { id: "fmt-italic", title: () => "Italic", shortcut: "Mod+I", run: () => applyWrap("*", "*") },
    { id: "fmt-strike", title: () => "Strikethrough", run: () => applyWrap("~~", "~~") },
    { id: "fmt-code", title: () => "Inline Code", run: () => applyWrap("`", "`") },
    { id: "fmt-link", title: () => "Insert Link", shortcut: "Mod+K", run: () => applyWrap("[", "](https://)") },
    { id: "fmt-image", title: () => "Insert Image", run: () => insertSnippetAtCursor("![alt text]()") },
    { id: "fmt-codeblock", title: () => "Code Block", run: () => insertSnippetAtCursor("```\n\n```") },
    { id: "fmt-hr", title: () => "Horizontal Rule", run: () => insertSnippetAtCursor("\n---\n") },
    { id: "fmt-table", title: () => "Insert Table", run: () => insertSnippetAtCursor("\n| Column 1 | Column 2 |\n| --- | --- |\n|  |  |\n") },
    { id: "fmt-math", title: () => "Math Block", run: () => insertSnippetAtCursor("\n$$\n\n$$\n") },
    { id: "fmt-mermaid", title: () => "Mermaid Diagram", run: () => insertSnippetAtCursor("\n```mermaid\nflowchart TD\n  A --> B\n```\n") },
  ];
}

/** Normalize a keyboard event into a binding descriptor like "Mod+Shift+P". */
export function eventToBinding(e: KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Meta", "Alt", "Shift"].includes(key)) return null;
  const parts: string[] = [];
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  if (isMac ? e.metaKey : e.ctrlKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let k = key.length === 1 ? key.toUpperCase() : key;
  if (k === " ") k = "Space";
  parts.push(k);
  return parts.join("+");
}

export function bindingMatches(binding: string, shortcut: string): boolean {
  const norm = (v: string) =>
    v
      .split("+")
      .map((p) => (p.length === 1 ? p.toUpperCase() : p))
      .join("+");
  return norm(binding) === norm(shortcut);
}
