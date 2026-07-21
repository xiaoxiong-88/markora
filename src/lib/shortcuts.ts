/** Central keyboard shortcut registry. Every binding lives here — nothing
 * is hardcoded inside components. `mod` = Cmd on macOS, Ctrl elsewhere. */

export interface ShortcutDef {
  id: string;
  combo: string;
  /** i18n key for the label. */
  labelKey: string;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: "file.new", combo: "mod+n", labelKey: "shortcut.newFile" },
  { id: "file.open", combo: "mod+o", labelKey: "shortcut.openFile" },
  { id: "file.openFolder", combo: "mod+shift+o", labelKey: "shortcut.openFolder" },
  { id: "file.save", combo: "mod+s", labelKey: "shortcut.save" },
  { id: "file.saveAs", combo: "mod+shift+s", labelKey: "shortcut.saveAs" },
  { id: "tab.close", combo: "mod+w", labelKey: "shortcut.closeTab" },
  { id: "tab.reopen", combo: "mod+shift+t", labelKey: "shortcut.reopenTab" },
  { id: "app.quickOpen", combo: "mod+p", labelKey: "shortcut.quickOpen" },
  { id: "app.commandPalette", combo: "mod+shift+p", labelKey: "shortcut.commandPalette" },
  { id: "edit.find", combo: "mod+f", labelKey: "shortcut.find" },
  { id: "edit.replace", combo: "mod+h", labelKey: "shortcut.replace" },
  { id: "search.workspace", combo: "mod+shift+f", labelKey: "shortcut.workspaceSearch" },
  { id: "view.toggleSidebar", combo: "mod+shift+b", labelKey: "shortcut.toggleSidebar" },
  { id: "view.focus", combo: "f8", labelKey: "shortcut.focusMode" },
  { id: "view.typewriter", combo: "f9", labelKey: "shortcut.typewriterMode" },
  { id: "view.zoomIn", combo: "mod+=", labelKey: "shortcut.zoomIn" },
  { id: "view.zoomOut", combo: "mod+-", labelKey: "shortcut.zoomOut" },
  { id: "view.zoomReset", combo: "mod+0", labelKey: "shortcut.zoomReset" },
];

/** Canonical "mod+shift+x" combo for a keyboard event, or null if not a
 * shortcut keypress worth handling. */
export function comboFromEvent(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): string | null {
  const key = e.key.toLowerCase();
  if (["meta", "control", "shift", "alt"].includes(key)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(key === " " ? "space" : key);
  return parts.join("+");
}

export function findShortcut(combo: string): ShortcutDef | undefined {
  return SHORTCUTS.find((s) => s.combo === combo);
}

/** Duplicate combos would make behavior ambiguous; used by tests and could
 * surface in a future shortcut editor. */
export function detectConflicts(shortcuts: readonly ShortcutDef[] = SHORTCUTS): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];
  for (const s of shortcuts) {
    const prev = seen.get(s.combo);
    if (prev) conflicts.push(`${s.combo}: ${prev} vs ${s.id}`);
    seen.set(s.combo, s.id);
  }
  return conflicts;
}

/** Human-readable combo, e.g. "⇧⌘O" on macOS, "Ctrl+Shift+O" elsewhere. */
export function formatCombo(combo: string, mac: boolean): string {
  const parts = combo.split("+");
  if (mac) {
    const map: Record<string, string> = { mod: "⌘", shift: "⇧", alt: "⌥" };
    return parts.map((p) => map[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("");
  }
  const map: Record<string, string> = { mod: "Ctrl", shift: "Shift", alt: "Alt" };
  return parts.map((p) => map[p] ?? (p.length === 1 ? p.toUpperCase() : p)).join("+");
}
