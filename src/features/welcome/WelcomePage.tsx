import { FileText, FolderOpen, Plus, Keyboard } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace";
import { openFileDialog, openFolderDialog, newDocument, openFilePath } from "@/services/actions";
import { t } from "@/i18n";

/** Empty-state welcome screen (SPEC: 欢迎页). Shown when no document is open. */
export function WelcomePage() {
  const recentFiles = useWorkspaceStore((s) => s.recentFiles);
  const recentFolders = useWorkspaceStore((s) => s.recentFolders);
  const strings = t();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-y-auto p-8">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* 应用图标：跟随系统圆角，大小与 macOS 标准图标一致 */}
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22%] bg-gradient-to-br from-[var(--accent)] to-blue-700 shadow-md">
          <span className="select-none text-2xl font-bold text-white">M</span>
        </div>

        <h1 className="mb-1 text-2xl font-semibold text-[var(--fg-primary)]">{strings.welcome.title}</h1>
        <p className="mb-8 text-sm text-[var(--fg-muted)]">{strings.welcome.subtitle}</p>

        <div className="mb-8 grid w-full max-w-md grid-cols-3 gap-3">
          <WelcomeButton icon={<Plus size={18} />} label={strings.welcome.newDocument} onClick={() => newDocument()} primary />
          <WelcomeButton icon={<FileText size={18} />} label={strings.welcome.openFile} onClick={() => openFileDialog()} />
          <WelcomeButton icon={<FolderOpen size={18} />} label={strings.welcome.openFolder} onClick={() => openFolderDialog()} />
        </div>

        {recentFiles.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              {strings.welcome.recentFiles}
            </h2>
            <div className="rounded-md border border-[var(--border)]">
              {recentFiles.slice(0, 6).map((item, i) => (
                <button
                  key={`${item.path}-${i}`}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ borderBottom: i < Math.min(recentFiles.length, 6) - 1 ? "1px solid var(--border)" : "none" }}
                  onClick={() => void openFilePath(item.path)}
                >
                  <FileText size={14} className="shrink-0 text-[var(--fg-muted)]" />
                  <span className="truncate">{item.path}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {recentFolders.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
              {strings.welcome.recentFolders}
            </h2>
            <div className="rounded-md border border-[var(--border)]">
              {recentFolders.slice(0, 4).map((item, i) => (
                <button
                  key={`${item.path}-d-${i}`}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ borderBottom: i < Math.min(recentFolders.length, 4) - 1 ? "1px solid var(--border)" : "none" }}
                  onClick={() => void openFolderDialog()}
                >
                  <FolderOpen size={14} className="shrink-0 text-[var(--accent)]" />
                  <span className="truncate">{item.path}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <Keyboard size={14} />
          <span>
            {strings.welcome.shortcuts}: {strings.palette.placeholder} ⌘⇧P · {strings.command.find} ⌘F · {strings.command.quickOpen} ⌘P
          </span>
        </section>
      </div>
    </div>
  );
}

function WelcomeButton({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-[13px] transition-colors ${
        primary
          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
          : "border-[var(--border)] text-[var(--fg-secondary)] hover:bg-[var(--bg-secondary)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
