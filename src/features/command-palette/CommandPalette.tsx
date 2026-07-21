import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "@/stores/ui";
import { fuzzyFilter } from "@/lib/fuzzy";
import { t } from "@/i18n";
import { buildCommands, type Command } from "./commands";

/** Command palette (Cmd/Ctrl+Shift+P): fuzzy search over the registry. */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const commands = useMemo(() => buildCommands(), []);
  const strings = t();

  const results = useMemo(
    () => fuzzyFilter(query, commands, (c) => commandTitle(c), 20),
    [query, commands],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  if (!open) return null;

  const runCommand = (command: Command) => {
    setOpen(false);
    void command.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings.palette.placeholder}
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-[var(--shadow)]"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[index]) {
              runCommand(results[index].item);
            }
          }}
          placeholder={strings.palette.placeholder}
          aria-label={strings.palette.placeholder}
          role="combobox"
          aria-expanded="true"
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--fg-muted)]"
        />
        <div className="max-h-[46vh] overflow-y-auto py-1" role="listbox">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
              {strings.palette.noCommands}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.item.id}
              type="button"
              role="option"
              aria-selected={i === index}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                i === index ? "bg-[var(--bg-tertiary)]" : ""
              }`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => runCommand(r.item)}
            >
              <span>{commandTitle(r.item)}</span>
              {r.item.shortcut && <span className="kbd">{formatShortcut(r.item.shortcut)}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Normalize a command title (static string or lazy function) to a string. */
export function commandTitle(command: { title: string | (() => string) }): string {
  return typeof command.title === "function" ? command.title() : command.title;
}

export function formatShortcut(shortcut: string): string {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return shortcut
    .replace("Mod", isMac ? "⌘" : "Ctrl")
    .replace("Shift", isMac ? "⇧" : "Shift")
    .replace("Alt", isMac ? "⌥" : "Alt")
    .replace(/\+/g, isMac ? "" : "+");
}
