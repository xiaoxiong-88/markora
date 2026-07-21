import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Minimal modal dialog with focus trapping and Escape handling. */
export function Modal({
  title,
  children,
  onClose,
  width = 420,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const focusables = Array.from(
          el.querySelectorAll<HTMLElement>("button, input, select, [tabindex]:not([tabindex='-1'])"),
        ).filter((n) => !n.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] shadow-[var(--shadow)]"
        style={{ width, maxWidth: "92vw" }}
      >
        <div className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-medium">
          {title}
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function DialogButtons({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex justify-end gap-2">{children}</div>;
}

export function DialogButton({
  children,
  onClick,
  primary,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        primary
          ? "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
          : danger
            ? "bg-red-600 text-white hover:opacity-90"
            : "bg-[var(--bg-tertiary)] hover:opacity-80"
      }`}
    >
      {children}
    </button>
  );
}

/** Promise-based text input dialog. */
export function usePromptDialog() {
  const [state, setState] = useState<{
    title: string;
    initial: string;
    resolve: (value: string | null) => void;
  } | null>(null);
  const [value, setValue] = useState("");

  const prompt = useCallback((title: string, initial = "") => {
    setValue(initial);
    return new Promise<string | null>((resolve) => {
      setState({ title, initial, resolve });
    });
  }, []);

  const close = useCallback(
    (result: string | null) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const element = state ? (
    <Modal title={state.title} onClose={() => close(null)}>
      <input
        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") close(value.trim() || null);
        }}
      />
      <DialogButtons>
        <DialogButton onClick={() => close(null)}>✕</DialogButton>
        <DialogButton primary onClick={() => close(value.trim() || null)}>
          OK
        </DialogButton>
      </DialogButtons>
    </Modal>
  ) : null;

  return { prompt, element };
}
