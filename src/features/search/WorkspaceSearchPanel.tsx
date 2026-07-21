import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { backend } from "@/services/backend";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { openFilePath } from "@/services/actions";
import { useDocumentsStore } from "@/stores/documents";
import { getEditor } from "@/features/editor/editorRegistry";
import { relativePath } from "@/lib/path";
import { t } from "@/i18n";
import type { SearchMatch } from "@/types";

/** Workspace-wide search panel (Rust backend, cancellable). */
export function WorkspaceSearchPanel() {
  const root = useWorkspaceStore((s) => s.root);
  const ignoredDirs = useSettingsStore((s) => s.settings.ignoredDirs);
  const setOpen = useUiStore((s) => s.setWorkspaceSearchOpen);
  const strings = t();
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [meta, setMeta] = useState<{ truncated: boolean; searchedFiles: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const requestSeq = useRef(0);

  const runSearch = useCallback(
    async (q: string) => {
      if (!root || !q.trim()) {
        setMatches([]);
        setMeta(null);
        return;
      }
      const seq = ++requestSeq.current;
      setSearching(true);
      try {
        const result = await backend.workspaceSearch(root, q, {
          caseSensitive,
          isRegex,
          extraIgnores: ignoredDirs,
          maxResults: 500,
        });
        if (requestSeq.current === seq) {
          setMatches(result.matches);
          setMeta({ truncated: result.truncated, searchedFiles: result.searchedFiles });
        }
      } catch {
        if (requestSeq.current === seq) {
          setMatches([]);
        }
      } finally {
        if (requestSeq.current === seq) setSearching(false);
      }
    },
    [root, caseSensitive, isRegex, ignoredDirs],
  );

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => () => void backend.cancelSearch().catch(() => {}), []);

  const jumpTo = (match: SearchMatch) => {
    void openFilePath(match.path).then((id) => {
      if (!id) return;
      // wait for the editor to mount, then jump to the line
      setTimeout(() => {
        getEditor(id)?.scrollToLine?.(match.line);
        useDocumentsStore.getState().setCursor(id, { offset: 0, line: match.line, column: 1 });
      }, 150);
    });
  };

  if (!root) return null;

  return (
    <div className="flex h-full flex-col" aria-label="Workspace search">
      <div className="flex items-center gap-1 border-b border-[var(--border)] p-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.search.workspacePlaceholder}
            aria-label={strings.search.workspacePlaceholder}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] py-1.5 pl-7 pr-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button type="button" className="icon-btn" aria-label={strings.search.cancel} onClick={() => setOpen(false)}>
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--fg-secondary)]">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
          Aa
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />
          .*
        </label>
        <span className="ml-auto text-[var(--fg-muted)]">
          {searching
            ? strings.search.searching
            : meta
              ? `${strings.search.results(matches.length)} · ${meta.searchedFiles} files${meta.truncated ? ` (${strings.search.truncated})` : ""}`
              : ""}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-1" role="list">
        {!searching && query && matches.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-[var(--fg-muted)]">{strings.search.noResults}</div>
        )}
        {matches.map((m, i) => (
          <button
            key={`${m.path}:${m.line}:${i}`}
            type="button"
            role="listitem"
            className="block w-full rounded px-2 py-1.5 text-left hover:bg-[var(--bg-secondary)]"
            onClick={() => jumpTo(m)}
          >
            <div className="truncate text-xs text-[var(--accent)]">
              {relativePath(root, m.path)}:{m.line}
            </div>
            <div className="truncate font-mono text-[12px] text-[var(--fg-secondary)]">
              {m.lineText.slice(0, m.matchStart)}
              <mark className="bg-[var(--selection)]">{m.lineText.slice(m.matchStart, m.matchEnd)}</mark>
              {m.lineText.slice(m.matchEnd)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
