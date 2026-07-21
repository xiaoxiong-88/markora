import { useMemo } from "react";
import { useDocumentsStore } from "@/stores/documents";
import { useSettingsStore } from "@/stores/settings";
import { computeStats } from "@/lib/wordcount";
import { onDragRegionMouseDown } from "@/lib/drag";
import { t } from "@/i18n";

/** Bottom status bar: caret position, stats, encoding, save state (SPEC). */
export function StatusBar() {
  const activeId = useDocumentsStore((s) => s.activeId);
  const doc = useDocumentsStore((s) => (s.activeId ? s.documents[s.activeId] : null));
  const saveStates = useDocumentsStore((s) => s.saveStates);
  const settings = useSettingsStore((s) => s.settings);
  const zoom = useSettingsStore((s) => s.zoom);
  const strings = t();

  const stats = useMemo(() => (doc ? computeStats(doc.markdown) : null), [doc]);

  const saveState = activeId ? saveStates[activeId] : undefined;
  const saveLabel =
    saveState === "saving"
      ? strings.status.saving
      : saveState === "failed"
        ? strings.status.saveFailed
        : doc?.isDirty
          ? strings.status.unsaved
          : strings.status.saved;

  const modeLabel = strings.mode[doc?.mode ?? "wysiwyg"];

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-3 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-primary)] px-3 text-[12px] text-[var(--fg-muted)]"
      role="status"
      onMouseDown={onDragRegionMouseDown}
    >
      <span className={`shrink-0 ${saveState === "failed" ? "text-red-500" : ""}`}>{saveLabel}</span>

      {doc && stats && (
        <>
          <Separator />
          <span>
            {strings.status.line} {doc.cursorState?.line ?? 1}, {strings.status.column} {doc.cursorState?.column ?? 1}
          </span>
          <Separator />
          <span>{modeLabel}</span>
          <Separator />
          <span>
            {stats.words} {strings.status.words.toLowerCase()}
          </span>
          <Separator />
          <span>
            {stats.characters} {strings.status.chars.toLowerCase()}
          </span>
          <Separator />
          <span>
            {stats.readingMinutes} {strings.status.minutes}
          </span>
        </>
      )}

      <span className="ml-auto shrink-0">{Math.round(zoom * 100)}%</span>

      <Separator />
      <span className="shrink-0">
        {settings.lineEnding === "crlf" ? "CRLF" : "LF"}
      </span>
      <Separator />
      <span className="shrink-0">UTF-8</span>
    </div>
  );
}

function Separator() {
  return <span className="h-3 w-px shrink-0 bg-[var(--border)] last:hidden" aria-hidden="true" />;
}
