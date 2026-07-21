import { getCurrentWindow } from "@tauri-apps/api/window";

/** Elements that should never start a window drag when pressed. */
const NO_DRAG_SELECTOR = "button, a, input, textarea, select, [contenteditable='true'], [data-no-drag]";

/**
 * Mouse-down handler for custom drag regions (frameless / overlay title bar).
 * Starts moving the window unless the press landed on an interactive element.
 */
export function onDragRegionMouseDown(e: React.MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest(NO_DRAG_SELECTOR)) return;
  e.preventDefault();
  void getCurrentWindow().startDragging();
}
