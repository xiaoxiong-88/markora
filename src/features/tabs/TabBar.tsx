import { useMemo, useRef } from "react";
import { X, Pin } from "lucide-react";
import { useDocumentsStore } from "@/stores/documents";
import { parentDirName } from "@/lib/path";
import { closeTabGuarded } from "@/services/actions";
import { useContextMenu } from "@/components/ContextMenu";
import { persistSession } from "@/services/session";
import { t } from "@/i18n";

/** Document tab strip: drag to reorder, middle-click to close, pin, dirty dot. */
export function TabBar() {
  const tabs = useDocumentsStore((s) => s.tabs);
  const documents = useDocumentsStore((s) => s.documents);
  const activeId = useDocumentsStore((s) => s.activeId);
  const strings = t();
  const { open, element } = useContextMenu();
  const dragIndex = useRef<number | null>(null);

  // disambiguate duplicate file names with their parent directory
  const subtitles = useMemo(() => {
    const nameCount = new Map<string, number>();
    for (const tab of tabs) {
      const name = documents[tab.documentId]?.displayName ?? "";
      nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
    }
    const map = new Map<string, string | null>();
    for (const tab of tabs) {
      const doc = documents[tab.documentId];
      if (!doc) continue;
      map.set(
        tab.documentId,
        (nameCount.get(doc.displayName) ?? 0) > 1 && doc.filePath
          ? parentDirName(doc.filePath)
          : null,
      );
    }
    return map;
  }, [tabs, documents]);

  return (
    <div
      className="flex h-9 items-end gap-0.5 overflow-x-auto px-2 pt-1"
      role="tablist"
      aria-label="Open documents"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {tabs.map((tab, index) => {
        const doc = documents[tab.documentId];
        if (!doc) return null;
        const isActive = tab.documentId === activeId;
        const subtitle = subtitles.get(tab.documentId);
        return (
          <div
            key={tab.documentId}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            draggable={!tab.pinned}
            onDragStart={() => (dragIndex.current = index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex.current != null) {
                useDocumentsStore.getState().moveTab(dragIndex.current, index);
                dragIndex.current = null;
                persistSession();
              }
            }}
            className={`group flex h-8 min-w-0 max-w-52 cursor-default items-center gap-1.5 rounded-t-md px-3 text-[13px] transition-colors ${
              isActive
                ? "bg-[var(--bg-primary)] text-[var(--fg-primary)]"
                : "bg-transparent text-[var(--fg-secondary)] hover:bg-[var(--bg-secondary)]"
            }`}
            onClick={() => useDocumentsStore.getState().setActive(tab.documentId)}
            onKeyDown={(e) => {
              if (e.key === "Enter") useDocumentsStore.getState().setActive(tab.documentId);
            }}
            onAuxClick={(e) => {
              if (e.button === 1) void closeTabGuarded(tab.documentId);
            }}
            onContextMenu={(e) =>
              open(e, [
                { label: strings.menu.closeTab, onClick: () => void closeTabGuarded(tab.documentId) },
                { label: strings.menu.closeOthers, onClick: () => useDocumentsStore.getState().closeOthers(tab.documentId) },
                { label: strings.menu.closeRight, onClick: () => useDocumentsStore.getState().closeRight(tab.documentId) },
                {
                  label: tab.pinned ? strings.menu.unpin : strings.menu.pin,
                  separatorAbove: true,
                  onClick: () => useDocumentsStore.getState().togglePin(tab.documentId),
                },
                {
                  label: strings.menu.copyPath,
                  disabled: !doc.filePath,
                  onClick: () => void navigator.clipboard.writeText(doc.filePath ?? ""),
                },
              ])
            }
          >
            {tab.pinned && <Pin size={11} className="shrink-0 text-[var(--fg-muted)]" />}
            <span className="truncate">
              {doc.displayName}
              {subtitle && <span className="ml-1 text-[11px] text-[var(--fg-muted)]">{subtitle}</span>}
            </span>
            {doc.isDirty ? (
              <button
                type="button"
                aria-label={`${strings.menu.closeTab} (${strings.status.unsaved})`}
                className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeTabGuarded(tab.documentId);
                }}
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent)] group-hover:hidden" />
                <X size={12} className="hidden group-hover:block" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={strings.menu.closeTab}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-[var(--bg-tertiary)] group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  void closeTabGuarded(tab.documentId);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}
      {element}
    </div>
  );
}
