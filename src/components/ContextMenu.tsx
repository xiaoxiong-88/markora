import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorAbove?: boolean;
  onClick?: () => void;
}

/** Right-click context menu rendered in a portal at the pointer position. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    // keep menu inside the viewport
    const el = ref.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setPos({
        x: Math.min(x, window.innerWidth - rect.width - 8),
        y: Math.min(y, window.innerHeight - rect.height - 8),
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [x, y, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50" onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        role="menu"
        className="fixed min-w-48 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] py-1 shadow-[var(--shadow)]"
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => (
          <div key={i}>
            {item.separatorAbove && <div className="my-1 h-px bg-[var(--border)]" />}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40 ${
                item.danger ? "text-red-500" : ""
              }`}
              onClick={() => {
                onClose();
                item.onClick?.();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="text-xs text-[var(--fg-muted)]">{item.shortcut}</span>}
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const open = (e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  };
  const element = menu ? <ContextMenu {...menu} onClose={() => setMenu(null)} /> : null;
  return { open, element };
}

export type { ReactNode };
