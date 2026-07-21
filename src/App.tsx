import { useEffect, useMemo } from "react";
import { useEffect as useReactEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TabBar } from "@/features/tabs/TabBar";
import { FileTree } from "@/features/workspace/FileTree";
import { EditorHost } from "@/features/editor/EditorHost";
import { OutlinePanel } from "@/features/outline/OutlinePanel";
import { WorkspaceSearchPanel } from "@/features/search/WorkspaceSearchPanel";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { QuickOpen } from "@/features/command-palette/QuickOpen";
import { StatusBar } from "@/features/statusbar/StatusBar";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { WelcomePage } from "@/features/welcome/WelcomePage";
import { ConflictDialogHost } from "@/features/workspace/ConflictDialog";
import { useDocumentsStore } from "@/stores/documents";
import { useSettingsStore, applyAppearance, watchSystemTheme } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { useWorkspaceStore } from "@/stores/workspace";
import { useFsWatcher } from "@/hooks/useFsWatcher";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useAutosave } from "@/hooks/useAutosave";
import { buildCommands } from "@/features/command-palette/commands";
import { isMac } from "@/lib/platform";
import { onDragRegionMouseDown } from "@/lib/drag";
import { restoreSession, watchOpenDocuments, persistRecovery } from "@/services/session";

export default function App() {
  const activeDoc = useDocumentsStore((s) => (s.activeId ? s.documents[s.activeId] : null));
  const hasTabs = useDocumentsStore((s) => s.tabs.length > 0);
  const sidebarVisible = useUiStore((s) => s.sidebarVisible);
  const outlineVisible = useUiStore((s) => s.outlineVisible);
  const workspaceSearchOpen = useUiStore((s) => s.workspaceSearchOpen);
  const root = useWorkspaceStore((s) => s.root);
  const settings = useSettingsStore((s) => s.settings);
  const zoom = useSettingsStore((s) => s.zoom);

  const commands = useMemo(() => buildCommands(), []);

  // Global keyboard shortcuts.
  useGlobalShortcuts(commands);
  // Filesystem watcher (external change detection).
  useFsWatcher();
  // Autosave.
  useAutosave();

  // Apply appearance (theme + typography) and react to system theme + settings.
  useEffect(() => {
    applyAppearance(settings, zoom);
    const unwatch = watchSystemTheme(() => {
      applyAppearance(useSettingsStore.getState().settings, useSettingsStore.getState().zoom);
    });
    return unwatch;
  }, [settings, zoom]);

  // Session restore + open-document watching on mount.
  useReactEffect(() => {
    void (async () => {
      await useSettingsStore.getState().load();
      // Re-apply appearance once persisted settings are loaded.
      applyAppearance(useSettingsStore.getState().settings, useSettingsStore.getState().zoom);
      await useWorkspaceStore.getState().loadRecents();
      await restoreSession();
      await watchOpenDocuments();
    })();

    const onBeforeUnload = () => persistRecovery();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
     
  }, []);

  const showOutline = outlineVisible && hasTabs;

  return (
    <ErrorBoundary>
      <div className="flex h-full w-full flex-col bg-[var(--bg-primary)] text-[var(--fg-primary)]">
        {/* Title bar: drag region + traffic-light padding on macOS overlay. */}
        <div
          className="flex shrink-0 items-stretch border-b border-[var(--border)]"
          onMouseDown={onDragRegionMouseDown}
        >
          <div style={{ width: isMac ? 78 : 0 }} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <TabBar />
          </div>
        </div>

        {/* Main area */}
        <div className="flex min-h-0 flex-1">
          {/* Workspace sidebar (file tree) or workspace search */}
          {workspaceSearchOpen && root ? (
            <div
              className="flex shrink-0 flex-col border-r border-[var(--border)]"
              style={{ width: settings.sidebarWidth }}
            >
              <WorkspaceSearchPanel />
            </div>
          ) : (
            <div
              className={`flex shrink-0 flex-col border-r border-[var(--border)] transition-[width] duration-150 ${
                sidebarVisible ? "" : "!w-0 !overflow-hidden !border-0"
              }`}
              style={{ width: sidebarVisible ? settings.sidebarWidth : 0 }}
            >
              {sidebarVisible && (
                <div className="flex min-h-0 flex-1">
                  <div className="w-full overflow-hidden">
                    <FileTree />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Editor + outline */}
          <div className="flex min-w-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              {hasTabs && activeDoc ? (
                <div className="min-h-0 flex-1">
                  <EditorHost doc={activeDoc} />
                </div>
              ) : (
                <WelcomePage />
              )}
            </div>

            {/* Outline panel */}
            {showOutline && (
              <div
                className="flex shrink-0 flex-col border-l border-[var(--border)]"
                style={{ width: settings.outlineWidth }}
              >
                <OutlinePanel />
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <StatusBar />

        {/* Floating overlays */}
        <CommandPalette />
        <QuickOpen />
        <SettingsPanel />
        <ConflictDialogHost />
      </div>
    </ErrorBoundary>
  );
}
