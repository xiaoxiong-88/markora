import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { parseOutline, activeHeadingAt } from "@/lib/outline";
import { useDocumentsStore } from "@/stores/documents";
import { getEditor } from "@/features/editor/editorRegistry";
import { fuzzyFilter } from "@/lib/fuzzy";
import { t } from "@/i18n";
import type { Heading } from "@/types";

/** Document outline panel: live heading tree with jump + filter + collapse. */
export function OutlinePanel() {
  const activeId = useDocumentsStore((s) => s.activeId);
  const markdown = useDocumentsStore((s) => (s.activeId ? s.documents[s.activeId]?.markdown ?? "" : ""));
  const cursorLine = useDocumentsStore((s) =>
    s.activeId ? s.documents[s.activeId]?.cursorState?.line ?? null : null,
  );
  const strings = t();
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const headings = useMemo(() => {
    if (!markdown) return [];
    // debounce-lite: parsing is cheap for typical documents
    return parseOutline(markdown);
  }, [markdown]);

  const visible = useMemo(() => {
    let list = headings;
    if (filter.trim()) {
      list = fuzzyFilter(filter, headings, (h) => h.text, 100).map((r) => r.item);
    }
    // hide children of collapsed headings
    const result: Heading[] = [];
    let collapsedLevel: number | null = null;
    for (const h of list) {
      if (collapsedLevel != null && h.level > collapsedLevel) continue;
      collapsedLevel = null;
      if (collapsed[h.slug]) collapsedLevel = h.level;
      result.push(h);
    }
    return result;
  }, [headings, filter, collapsed]);

  const activeHeading = cursorLine != null ? activeHeadingAt(headings, cursorLine - 1) : null;

  const jump = (h: Heading) => {
    if (!activeId) return;
    const editor = getEditor(activeId);
    editor?.scrollToLine?.(h.line + 1);
    useDocumentsStore.getState().setCursor(activeId, { offset: 0, line: h.line + 1, column: 1 });
  };

  return (
    <div className="flex h-full flex-col" aria-label={strings.outline.title}>
      <div className="flex items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
        <Search size={12} className="text-[var(--fg-muted)]" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={strings.outline.searchPlaceholder}
          aria-label={strings.outline.searchPlaceholder}
          className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--fg-muted)]"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-1 py-1" role="tree">
        {visible.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-[var(--fg-muted)]">{strings.outline.empty}</div>
        )}
        {visible.map((h) => {
          const hasChildren = visible.some((o) => o !== h && o.line > h.line && false); // cheap check below
          void hasChildren;
          const isActive = activeHeading?.slug === h.slug;
          const isCollapsed = !!collapsed[h.slug];
          return (
            <div
              key={`${h.slug}-${h.line}`}
              role="treeitem"
              aria-selected={isActive}
              className={`flex cursor-default items-center gap-0.5 rounded px-1 py-[3px] text-[12.5px] transition-colors ${
                isActive ? "bg-[var(--bg-tertiary)] text-[var(--fg-primary)]" : "text-[var(--fg-secondary)] hover:bg-[var(--bg-secondary)]"
              }`}
              style={{ paddingLeft: (h.level - 1) * 14 + 4 }}
              onClick={() => jump(h)}
            >
              <span
                className="flex h-4 w-4 items-center justify-center text-[var(--fg-muted)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((c) => ({ ...c, [h.slug]: !c[h.slug] }));
                }}
              >
                {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} className="opacity-30" />}
              </span>
              <span className="truncate">{h.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
