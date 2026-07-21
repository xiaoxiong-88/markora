import { useMemo, useState } from "react";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { saveDocument } from "@/services/actions";
import { saveDocumentAs } from "@/services/actions";
import { Modal, DialogButtons, DialogButton } from "@/components/Modal";
import { t } from "@/i18n";

/** Renders the external-change conflict dialog for the active document. */
export function ConflictDialogHost() {
  const activeId = useDocumentsStore((s) => s.activeId);
  const doc = useDocumentsStore((s) => (s.activeId ? s.documents[s.activeId] : null));
  const [showDiff, setShowDiff] = useState(false);
  const strings = t();

  const conflict = doc?.externalChange.status === "conflict" ? doc.externalChange : null;
  const diff = useMemo(() => {
    if (!conflict || !doc) return null;
    return computeLineDiff(doc.markdown, conflict.diskContent);
  }, [conflict, doc]);

  if (!doc || !conflict || activeId !== doc.id) return null;

  const resolve = (action: "keep" | "disk") => {
    const store = useDocumentsStore.getState();
    if (action === "disk") {
      void store.reloadFromDisk(doc.id);
      useUiStore.getState().toast(strings.toast.reloaded);
    } else {
      store.setExternalChange(doc.id, { status: "none" });
      void saveDocument(doc.id);
    }
  };

  return (
    <Modal title={strings.dialog.conflictTitle} onClose={() => resolve("keep")} width={640}>
      <p className="text-sm text-[var(--fg-secondary)]">{strings.dialog.conflictBody(doc.displayName)}</p>
      {showDiff && diff && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] p-2 font-mono text-xs">
          {diff.map((line, i) => (
            <div
              key={i}
              className={
                line.kind === "local"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : line.kind === "disk"
                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : "text-[var(--fg-muted)]"
              }
            >
              {line.kind === "local" ? "+ " : line.kind === "disk" ? "- " : "  "}
              {line.text}
            </div>
          ))}
          <div className="mt-2 text-[11px] text-[var(--fg-muted)]">
            + local · - disk
          </div>
        </div>
      )}
      <DialogButtons>
        <DialogButton onClick={() => setShowDiff((v) => !v)}>{strings.dialog.viewDiff}</DialogButton>
        <DialogButton
          onClick={() => {
            void saveDocumentAs(doc.id).then((ok) => {
              if (ok) useDocumentsStore.getState().setExternalChange(doc.id, { status: "none" });
            });
          }}
        >
          {strings.dialog.saveCopy}
        </DialogButton>
        <DialogButton onClick={() => resolve("disk")}>{strings.dialog.loadDisk}</DialogButton>
        <DialogButton primary onClick={() => resolve("keep")}>
          {strings.dialog.keepLocal}
        </DialogButton>
      </DialogButtons>
    </Modal>
  );
}

interface DiffLine {
  kind: "same" | "local" | "disk";
  text: string;
}

/** Simple LCS-based line diff for the conflict comparison view. */
export function computeLineDiff(local: string, disk: string, context = 2): DiffLine[] {
  const a = local.split("\n");
  const b = disk.split("\n");
  const m = a.length;
  const n = b.length;
  // LCS table (documents in conflict dialogs are small enough)
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "local", text: a[i++] });
    } else {
      out.push({ kind: "disk", text: b[j++] });
    }
  }
  while (i < m) out.push({ kind: "local", text: a[i++] });
  while (j < n) out.push({ kind: "disk", text: b[j++] });

  // compress unchanged runs to context lines
  const compressed: DiffLine[] = [];
  let runStart = -1;
  for (let k = 0; k <= out.length; k++) {
    const line = out[k];
    if (line && line.kind === "same") {
      if (runStart === -1) runStart = k;
    } else {
      if (runStart !== -1) {
        const runEnd = k;
        const keepHead = compressed.length === 0 ? 0 : context;
        const keepTail = runEnd === out.length ? 0 : context;
        const head = out.slice(runStart, Math.min(runStart + keepHead, runEnd));
        const tail = out.slice(Math.max(runStart + keepHead, runEnd - keepTail), runEnd);
        compressed.push(...head);
        if (runEnd - runStart > keepHead + keepTail) {
          compressed.push({ kind: "same", text: "…" });
        }
        compressed.push(...tail);
        runStart = -1;
      }
      if (line) compressed.push(line);
    }
  }
  return compressed;
}
