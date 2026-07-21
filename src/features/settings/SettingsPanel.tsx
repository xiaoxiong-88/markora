import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import type { EditorMode } from "@/types";
import { t } from "@/i18n";

type Tab = "general" | "editor" | "markdown" | "appearance" | "files";

const MODES: EditorMode[] = ["wysiwyg", "source", "split", "reader"];

/** Settings center (SPEC: 设置中心). TabsEditor/Markdown/Appearance/Files; all changes apply live. */
export function SettingsPanel() {
  const open = useUiStore((s) => s.settingsOpen);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const resetDefaults = useSettingsStore((s) => s.resetDefaults);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const strings = t();
  const [tab, setTab] = useState<Tab>("general");
  // 弹窗拖动偏移量
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    // 只允许左键拖动，且不在按钮上触发
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea")) return;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    e.preventDefault();
  }, [offset]);

  const onDragMove = useCallback((e: MouseEvent) => {
    const start = dragStart.current;
    if (!start) return;
    setOffset({ x: start.ox + (e.clientX - start.mx), y: start.oy + (e.clientY - start.my) });
  }, []);

  const onDragEnd = useCallback(() => {
    dragStart.current = null;
  }, []);

  // 拖动时监听全局 mousemove / mouseup
  useEffect(() => {
    if (!dragStart.current) return;
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  // 关闭时必须返回 null，否则面板永远遮挡界面无法操作
  if (!open) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: strings.settings.general },
    { id: "editor", label: strings.settings.editor },
    { id: "markdown", label: strings.settings.markdown },
    { id: "appearance", label: strings.settings.appearance },
    { id: "files", label: strings.settings.files },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={strings.settings.title}
        className="flex h-[640px] w-[760px] max-h-[90vh] max-w-[92vw] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-[var(--shadow)]"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        {/* Sidebar */}
        <div className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-[var(--border)] bg-[var(--bg-secondary)] p-2">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={`rounded-md px-3 py-1.5 text-left text-[13px] transition-colors ${
                tab === tb.id ? "bg-[var(--bg-tertiary)] text-[var(--fg-primary)]" : "text-[var(--fg-secondary)] hover:bg-[var(--bg-tertiary)]"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 标题栏作为拖动把手：按住空白处可拖动整个弹窗 */}
          <div
            className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3 cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onDragStart}
          >
            <h2 className="text-sm font-semibold text-[var(--fg-primary)]">{strings.settings.title}</h2>
            <button type="button" className="icon-btn" aria-label={strings.settings.close} onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === "general" && (
              <div className="flex flex-col gap-4">
                <Toggle label={strings.settings.restoreSession} checked={settings.restoreSession} onChange={(v) => update({ restoreSession: v })} />
                <Toggle label={strings.settings.autoSave} checked={settings.autoSave} onChange={(v) => update({ autoSave: v })} />
                {settings.autoSave && (
                  <Field label={strings.settings.autoSaveDelay}>
                    <input type="number" min={200} max={10000} step={100} value={settings.autoSaveDelayMs} onChange={(e) => update({ autoSaveDelayMs: Number(e.target.value) })} className="input" />
                  </Field>
                )}
                <Toggle label={strings.settings.followSystem} checked={settings.followSystemTheme} onChange={(v) => update({ followSystemTheme: v })} />
                <Field label={strings.settings.defaultMode}>
                  <select value={settings.defaultMode} onChange={(e) => update({ defaultMode: e.target.value as EditorMode })} className="input">
                    {MODES.map((m) => (
                      <option key={m} value={m}>{strings.mode[m]}</option>
                    ))}
                  </select>
                </Field>
                <Field label={strings.settings.recentLimit}>
                  <input type="number" min={0} max={50} value={settings.recentLimit} onChange={(e) => update({ recentLimit: Number(e.target.value) })} className="input" />
                </Field>
              </div>
            )}

            {tab === "editor" && (
              <div className="flex flex-col gap-4">
                <Field label={strings.settings.fontFamily}>
                  <input type="text" value={settings.fontFamily} placeholder="system" onChange={(e) => update({ fontFamily: e.target.value })} className="input" />
                </Field>
                <Field label={strings.settings.fontSize}>
                  <input type="number" min={10} max={32} value={settings.fontSize} onChange={(e) => update({ fontSize: Number(e.target.value) })} className="input" />
                </Field>
                <Field label={strings.settings.lineHeight}>
                  <input type="number" min={1} max={3} step={0.05} value={settings.lineHeight} onChange={(e) => update({ lineHeight: Number(e.target.value) })} className="input" />
                </Field>
                <Field label={strings.settings.tabSize}>
                  <input type="number" min={1} max={8} value={settings.tabSize} onChange={(e) => update({ tabSize: Number(e.target.value) })} className="input" />
                </Field>
                <Toggle label={strings.settings.wordWrap} checked={settings.wordWrap} onChange={(v) => update({ wordWrap: v })} />
                <Toggle label={strings.settings.lineNumbers} checked={settings.lineNumbers} onChange={(v) => update({ lineNumbers: v })} />
                <Toggle label={strings.settings.spellcheck} checked={settings.spellcheck} onChange={(v) => update({ spellcheck: v })} />
                <Toggle label={strings.settings.autoPair} checked={settings.autoPair} onChange={(v) => update({ autoPair: v })} />
                <Toggle label={strings.settings.focusMode} checked={settings.focusMode} onChange={(v) => update({ focusMode: v })} />
                <Toggle label={strings.settings.typewriterMode} checked={settings.typewriterMode} onChange={(v) => update({ typewriterMode: v })} />
              </div>
            )}

            {tab === "markdown" && (
              <div className="flex flex-col gap-4">
                <Toggle label={strings.settings.gfm} checked={settings.gfm} onChange={(v) => update({ gfm: v })} />
                <Toggle label={strings.settings.math} checked={settings.math} onChange={(v) => update({ math: v })} />
                <Toggle label={strings.settings.mermaid} checked={settings.mermaid} onChange={(v) => update({ mermaid: v })} />
                <Toggle label={strings.settings.autoLink} checked={settings.autoLink} onChange={(v) => update({ autoLink: v })} />
                <Toggle label={strings.settings.headingAnchors} checked={settings.headingAnchors} onChange={(v) => update({ headingAnchors: v })} />
                <Toggle label={strings.settings.frontMatter} checked={settings.frontMatter} onChange={(v) => update({ frontMatter: v })} />
                <Field label={strings.settings.assetDir}>
                  <input type="text" value={settings.assetDir} onChange={(e) => update({ assetDir: e.target.value })} className="input" />
                </Field>
              </div>
            )}

            {tab === "appearance" && (
              <div className="flex flex-col gap-4">
                <Field label={strings.settings.theme}>
                  <select value={settings.followSystemTheme ? "system" : settings.theme} onChange={(e) => {
                    const v = e.target.value;
                    if (v === "system") update({ followSystemTheme: true });
                    else update({ followSystemTheme: false, theme: v as typeof settings.theme });
                  }} className="input">
                    <option value="system">{strings.settings.followSystem}</option>
                    <option value="light">{strings.settings.themeLight}</option>
                    <option value="dark">{strings.settings.themeDark}</option>
                    <option value="sepia">{strings.settings.themeSepia}</option>
                    <option value="high-contrast">{strings.settings.themeHighContrast}</option>
                  </select>
                </Field>
                <Field label={strings.settings.contentWidth}>
                  <input type="number" min={400} max={1400} value={settings.contentMaxWidth} onChange={(e) => update({ contentMaxWidth: Number(e.target.value) })} className="input" />
                </Field>
                <Field label={strings.settings.sidebarWidth}>
                  <input type="number" min={160} max={400} value={settings.sidebarWidth} onChange={(e) => update({ sidebarWidth: Number(e.target.value) })} className="input" />
                </Field>
                <Field label={strings.settings.outlineWidth}>
                  <input type="number" min={160} max={400} value={settings.outlineWidth} onChange={(e) => update({ outlineWidth: Number(e.target.value) })} className="input" />
                </Field>
                <Toggle label={strings.settings.animations} checked={settings.animations} onChange={(v) => update({ animations: v })} />
                <Toggle label={strings.settings.reduceMotion} checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
              </div>
            )}

            {tab === "files" && (
              <div className="flex flex-col gap-4">
                <Field label={strings.settings.lineEnding}>
                  <select value={settings.lineEnding} onChange={(e) => update({ lineEnding: e.target.value as "preserve" | "lf" | "crlf" })} className="input">
                    <option value="preserve">{strings.settings.preserve}</option>
                    <option value="lf">LF</option>
                    <option value="crlf">CRLF</option>
                  </select>
                </Field>
                <Toggle label={strings.settings.trailingNewline} checked={settings.trailingNewline} onChange={(v) => update({ trailingNewline: v })} />
                <Toggle label={strings.settings.detectExternal} checked={settings.detectExternalChanges} onChange={(v) => update({ detectExternalChanges: v })} />
                <Toggle label={strings.settings.showHidden} checked={settings.showHiddenFiles} onChange={(v) => update({ showHiddenFiles: v })} />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            <button type="button" className="rounded-md bg-[var(--bg-tertiary)] px-3 py-1.5 text-sm" onClick={() => resetDefaults()}>
              {strings.settings.resetDefaults}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-[13px] text-[var(--fg-secondary)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"}`}
      >
        {/* 圆钮：高度撑满轨道内距，top/left 各 2px，水平滑动 16px */}
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-[13px] text-[var(--fg-secondary)]">{label}</span>
      {children}
    </label>
  );
}
