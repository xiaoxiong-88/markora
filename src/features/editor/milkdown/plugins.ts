/**
 * ProseMirror helpers for the Milkdown editor: a slash-command plugin and a
 * selection toolbar plugin. Both are plain ProseMirror plugins created via
 * `$prose`, so they carry no extra Milkdown plugin dependencies.
 */
import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey, type EditorState } from "@milkdown/prose/state";

export interface SlashState {
  active: boolean;
  query: string;
  /** Cursor position used to delete the "/query" text on apply. */
  from: number;
  to: number;
  /** Viewport coordinates for menu placement. */
  left: number;
  top: number;
}

export interface ToolbarState {
  active: boolean;
  left: number;
  top: number;
}

const slashKey = new PluginKey("markora-slash");
const toolbarKey = new PluginKey("markora-toolbar");

/** Detect `/query` at the start of the current textblock. */
export function detectSlash(state: EditorState): { query: string; from: number; to: number } | null {
  const { $from, empty } = state.selection;
  if (!empty) return null;
  const parent = $from.parent;
  if (!parent.isTextblock) return null;
  const text = parent.textContent;
  const match = /^\/([\w-]*)$/.exec(text);
  if (!match) return null;
  return { query: match[1], from: $from.start(), to: $from.pos };
}

export function createSlashPlugin(onChange: (state: SlashState) => void) {
  return $prose(
    () =>
      new Plugin({
        key: slashKey,
        view: (view) => ({
          update: () => {
            const hit = detectSlash(view.state);
            if (!hit) {
              onChange({ active: false, query: "", from: 0, to: 0, left: 0, top: 0 });
              return;
            }
            const coords = view.coordsAtPos(hit.to);
            onChange({
              active: true,
              query: hit.query,
              from: hit.from,
              to: hit.to,
              left: coords.left,
              top: coords.bottom + 4,
            });
          },
          destroy: () => onChange({ active: false, query: "", from: 0, to: 0, left: 0, top: 0 }),
        }),
      }),
  );
}

export function createToolbarPlugin(onChange: (state: ToolbarState) => void) {
  return $prose(
    () =>
      new Plugin({
        key: toolbarKey,
        view: (view) => ({
          update: () => {
            const { from, to, empty } = view.state.selection;
            if (empty || to - from < 1) {
              onChange({ active: false, left: 0, top: 0 });
              return;
            }
            // Only for inline text selections, not node selections.
            if (view.state.selection.toJSON().type !== "text") {
              onChange({ active: false, left: 0, top: 0 });
              return;
            }
            const start = view.coordsAtPos(from);
            const end = view.coordsAtPos(to);
            onChange({
              active: true,
              left: (start.left + end.left) / 2,
              top: Math.max(8, start.top - 44),
            });
          },
          destroy: () => onChange({ active: false, left: 0, top: 0 }),
        }),
      }),
  );
}
