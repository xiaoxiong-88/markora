import { useEffect, useMemo, useState } from "react";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { fuzzyFilter } from "@/lib/fuzzy";
import { openFilePath } from "@/services/actions";
import { t } from "@/i18n";

/** Quick Open (Cmd/Ctrl+P): fuzzy file picker over the workspace index. */
export function QuickOpen() {
  const open = useUiStore((s) => s.quickOpenOpen);
  const setOpen = useUiStore((s) => s.setQuickOpenOpen);
  const root = useWorkspaceStore((s) => s.root);
  const files = useWorkspaceStore((s) => s.workspaceFiles);
  const recentFiles = useWorkspaceStore((s) => s.recentFiles);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const strings = t();

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      void useWorkspaceStore.getState().loadWorkspaceFiles();
    }
  }, [open]);

  const results = useMemo(() => {
    if (!root) {
      // no workspace: fuzzy over recent files
      return fuzzyFilter(query, recentFiles, (r) => r.path, 20).map((r) => ({
        display: r.item.path,
        fullPath: r.item.path,
      }));
    }
    return fuzzyFilter(query, files, (f) => f, 30).map((r) => ({
      display: r.item,
      fullPath: joinRoot(root, r.item),
    }));
  }, [query, files, root, recentFiles]);

  if (!open) return null;

  const pick = (fullPath: string) => {
    setOpen(false);
    void openFilePath(fullPath);
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
        aria-label={strings.search.quickOpenPlaceholder}
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
              pick(results[index].fullPath);
            }
          }}
          placeholder={strings.search.quickOpenPlaceholder}
          aria-label={strings.search.quickOpenPlaceholder}
          className="w-full border-b border-[var(--border)] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--fg-muted)]"
        />
        <div className="max-h-[46vh] overflow-y-auto py-1" role="listbox">
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
              {strings.search.noResults}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.fullPath}
              type="button"
              role="option"
              aria-selected={i === index}
              className={`block w-full truncate px-4 py-2 text-left font-mono text-[13px] ${
                i === index ? "bg-[var(--bg-tertiary)]" : ""
              }`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => pick(r.fullPath)}
            >
              {r.display}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function joinRoot(root: string, rel: string): string {
  const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/";
  return root.endsWith(sep) ? root + rel : root + sep + rel;
}
