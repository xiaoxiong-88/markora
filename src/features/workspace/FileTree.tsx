import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FilePlus2,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace";
import { useDocumentsStore } from "@/stores/documents";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { t } from "@/i18n";
import { isMarkdownFile, isImageFile, basename } from "@/lib/path";
import type { DirEntry } from "@/types";
import { useContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { usePromptDialog } from "@/components/Modal";
import {
  createFileIn,
  createFolderIn,
  deleteEntryGuarded,
  duplicateEntry,
  moveEntryTo,
  openFilePath,
  openWithDefaultApp,
  renameEntry,
  revealEntry,
} from "@/services/actions";

/** Workspace file tree with lazy, per-directory loading. */
export function FileTree() {
  const root = useWorkspaceStore((s) => s.root);
  const strings = t();
  const { prompt, element: promptElement } = usePromptDialog();

  if (!root) {
    return (
      <div className="px-3 py-6 text-center text-xs text-[var(--fg-muted)]">
        {strings.welcome.openFolder}
      </div>
    );
  }

  const newFile = async (dir: string) => {
    const name = await prompt(strings.menu.newFile, "untitled.md");
    if (name) await createFileIn(dir, name);
  };
  const newFolder = async (dir: string) => {
    const name = await prompt(strings.menu.newFolder, "folder");
    if (name) await createFolderIn(dir, name);
  };

  return (
    <div className="flex h-full flex-col" role="tree" aria-label="Workspace files">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="truncate px-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]" title={root}>
          {basename(root)}
        </span>
        <div className="flex shrink-0">
          <button type="button" className="icon-btn !h-6 !w-6" aria-label={strings.menu.newFile} onClick={() => void newFile(root)}>
            <FilePlus2 size={14} />
          </button>
          <button type="button" className="icon-btn !h-6 !w-6" aria-label={strings.menu.newFolder} onClick={() => void newFolder(root)}>
            <FolderPlus size={14} />
          </button>
          <button
            type="button"
            className="icon-btn !h-6 !w-6"
            aria-label={strings.menu.refresh}
            onClick={() => void useWorkspaceStore.getState().refreshTree()}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        <DirChildren path={root} depth={0} onNewFile={newFile} onNewFolder={newFolder} />
      </div>
      {promptElement}
    </div>
  );
}

function DirChildren({
  path,
  depth,
  onNewFile,
  onNewFolder,
}: {
  path: string;
  depth: number;
  onNewFile: (dir: string) => Promise<void>;
  onNewFolder: (dir: string) => Promise<void>;
}) {
  const children = useWorkspaceStore((s) => s.children[path]);
  const loading = useWorkspaceStore((s) => s.loadingDirs[path]);
  if (!children) {
    return loading ? (
      <div className="px-3 py-1 text-xs text-[var(--fg-muted)]" style={{ paddingLeft: depth * 14 + 24 }}>
        …
      </div>
    ) : null;
  }
  return (
    <>
      {children.map((entry) => (
        <TreeNode key={entry.path} entry={entry} depth={depth} onNewFile={onNewFile} onNewFolder={onNewFolder} />
      ))}
    </>
  );
}

function TreeNode({
  entry,
  depth,
  onNewFile,
  onNewFolder,
}: {
  entry: DirEntry;
  depth: number;
  onNewFile: (dir: string) => Promise<void>;
  onNewFolder: (dir: string) => Promise<void>;
}) {
  const expanded = useWorkspaceStore((s) => !!s.expanded[entry.path]);
  const activePath = useDocumentsStore((s) => {
    const active = s.activeId ? s.documents[s.activeId] : null;
    return active?.filePath ?? null;
  });
  const showHidden = useSettingsStore((s) => s.settings.showHiddenFiles);
  const strings = t();
  const { open, element } = useContextMenu();
  const { prompt, element: promptElement } = usePromptDialog();
  const [dragOver, setDragOver] = useState(false);

  if (!showHidden && entry.name.startsWith(".")) return null;

  const isActive = activePath === entry.path;

  const contextItems = (target: DirEntry): ContextMenuItem[] => {
    const dir = target.isDir ? target.path : target.path.replace(/[\\/][^\\/]*$/, "");
    return [
      { label: strings.menu.newFile, onClick: () => void onNewFile(dir) },
      { label: strings.menu.newFolder, onClick: () => void onNewFolder(dir) },
      {
        label: strings.menu.rename,
        separatorAbove: true,
        onClick: () => {
          void prompt(strings.menu.rename, target.name).then((name) => {
            if (name && name !== target.name) void renameEntry(target.path, name);
          });
        },
      },
      { label: strings.menu.duplicate, onClick: () => void duplicateEntry(target.path) },
      {
        label: strings.menu.moveTo,
        onClick: () => {
          void prompt(strings.menu.moveTo, dir).then((dest) => {
            if (dest) void moveEntryTo(target.path, dest);
          });
        },
      },
      {
        label: strings.menu.copyPath,
        separatorAbove: true,
        onClick: () => {
          void navigator.clipboard.writeText(target.path);
          useUiStore.getState().toast(strings.toast.copied, "success");
        },
      },
      { label: strings.menu.reveal, onClick: () => void revealEntry(target.path) },
      { label: strings.menu.openDefault, onClick: () => void openWithDefaultApp(target.path) },
      {
        label: strings.menu.delete,
        danger: true,
        separatorAbove: true,
        onClick: () => void deleteEntryGuarded(target.path),
      },
    ];
  };

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={entry.isDir ? expanded : undefined}
        aria-selected={isActive}
        tabIndex={0}
        className={`group flex cursor-default items-center gap-1 rounded px-1.5 py-[3px] text-[13px] transition-colors ${
          isActive
            ? "bg-[var(--bg-tertiary)] text-[var(--fg-primary)]"
            : "text-[var(--fg-secondary)] hover:bg-[var(--bg-secondary)]"
        } ${dragOver ? "outline outline-1 outline-[var(--accent)]" : ""}`}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => {
          if (entry.isDir) {
            void useWorkspaceStore.getState().toggleDir(entry.path);
          } else {
            void openFilePath(entry.path);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (entry.isDir) void useWorkspaceStore.getState().toggleDir(entry.path);
            else void openFilePath(entry.path);
          }
        }}
        onContextMenu={(e) => open(e, contextItems(entry))}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("markora/path", entry.path)}
        onDragOver={(e) => {
          if (entry.isDir) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          if (!entry.isDir) return;
          e.preventDefault();
          const source = e.dataTransfer.getData("markora/path");
          if (source && source !== entry.path && !entry.path.startsWith(source)) {
            void moveEntryTo(source, entry.path);
          }
        }}
      >
        {entry.isDir ? (
          <>
            <span className="text-[var(--fg-muted)]">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {expanded ? <FolderOpen size={14} className="text-[var(--accent)]" /> : <Folder size={14} className="text-[var(--fg-muted)]" />}
          </>
        ) : (
          <>
            <span className="w-[13px]" />
            <FileText size={14} className={isMarkdownFile(entry.name) ? "text-[var(--accent)]" : isImageFile(entry.name) ? "text-emerald-500" : "text-[var(--fg-muted)]"} />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </div>
      {entry.isDir && expanded && (
        <DirChildren path={entry.path} depth={depth + 1} onNewFile={onNewFile} onNewFolder={onNewFolder} />
      )}
      {element}
      {promptElement}
    </div>
  );
}
