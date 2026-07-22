import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, defaultValueCtx, editorViewCtx, editorViewOptionsCtx, parserCtx, rootCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { clipboard } from "@milkdown/plugin-clipboard";
import { math } from "@milkdown/plugin-math";
import { diagram } from "@milkdown/plugin-diagram";
import { getMarkdown, replaceAll } from "@milkdown/utils";
import { Slice } from "@milkdown/prose/model";
import { TextSelection } from "@milkdown/prose/state";
import { useSettingsStore } from "@/stores/settings";
import { getLocale, t } from "@/i18n";
import { registerEditor, type EditorHandle } from "./editorRegistry";
import {
  createSlashPlugin,
  createToolbarPlugin,
  type SlashState,
  type ToolbarState,
} from "./milkdown/plugins";
import { createShikiHighlightPlugin } from "./milkdown/shikiHighlight";
import { SLASH_ITEMS } from "./milkdown/items";

export interface WysiwygEditorProps {
  documentId: string;
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  onCursorLine?: (line: number) => void;
  onPasteFiles?: (files: File[]) => void;
  onDropFiles?: (files: File[]) => void;
}

/**
 * Milkdown WYSIWYG editor. Created once per mount; content flows out via the
 * listener plugin and in via the registered handle (`replaceAll`), so the
 * editor is never re-created per keystroke.
 */
export function WysiwygEditor({
  documentId,
  initialMarkdown,
  onChange,
  onCursorLine,
  onPasteFiles,
  onDropFiles,
}: WysiwygEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const callbacksRef = useRef({ onChange, onCursorLine });
  callbacksRef.current = { onChange, onCursorLine };
  const fileHandlersRef = useRef({ onPasteFiles, onDropFiles });
  fileHandlersRef.current = { onPasteFiles, onDropFiles };
  const [slash, setSlash] = useState<SlashState>({ active: false, query: "", from: 0, to: 0, left: 0, top: 0 });
  const [toolbar, setToolbar] = useState<ToolbarState>({ active: false, left: 0, top: 0 });
  const [slashIndex, setSlashIndex] = useState(0);

  const insertSnippet = useCallback((snippet: string, from: number, to: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const parser = ctx.get(parserCtx);
      const doc = parser(snippet);
      const tr = view.state.tr.delete(from, to);
      if (doc) {
        tr.replaceSelection(new Slice(doc.content, 0, 0));
      }
      view.dispatch(tr.scrollIntoView());
      view.focus();
    });
  }, []);

  const applyInlineCommand = useCallback((kind: "bold" | "italic" | "strike" | "code" | "link" | "quote" | "heading") => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state, dispatch } = view;
      const { from, to } = state.selection;
      const text = state.doc.textBetween(from, to, " ");
      const wraps: Record<string, [string, string]> = {
        bold: ["**", "**"],
        italic: ["*", "*"],
        strike: ["~~", "~~"],
        code: ["`", "`"],
        link: ["[", "](https://)"],
      };
      if (kind === "quote" || kind === "heading") {
        const lineStart = state.doc.resolve(from).start();
        const prefix = kind === "quote" ? "> " : "# ";
        dispatch(state.tr.insertText(prefix, lineStart).scrollIntoView());
        view.focus();
        return;
      }
      const [open, close] = wraps[kind];
      const tr = state.tr.insertText(open + text + close, from, to);
      // place cursor inside the wrapper when nothing was selected
      if (from === to) {
        const pos = from + open.length;
        tr.setSelection(TextSelection.create(tr.doc, pos));
      }
      dispatch(tr.scrollIntoView());
      view.focus();
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let destroyed = false;
    const settings = useSettingsStore.getState().settings;

    const slashPlugin = createSlashPlugin((s) => {
      setSlash(s);
      setSlashIndex(0);
    });
    const toolbarPlugin = createToolbarPlugin(setToolbar);

    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, initialMarkdown);
        ctx.set(editorViewOptionsCtx, {
          attributes: {
            class: "markdown-body milkdown-body",
            spellcheck: settings.spellcheck ? "true" : "false",
          },
          handleDOMEvents: {
            paste: (_view, event) => {
              const files = Array.from(event.clipboardData?.files ?? []);
              if (files.length > 0 && fileHandlersRef.current.onPasteFiles) {
                event.preventDefault();
                fileHandlersRef.current.onPasteFiles(files);
                return true;
              }
              return false;
            },
            drop: (_view, event) => {
              const dt = event.dataTransfer;
              const files = Array.from(dt?.files ?? []);
              if (files.length > 0 && fileHandlersRef.current.onDropFiles) {
                event.preventDefault();
                fileHandlersRef.current.onDropFiles(files);
                return true;
              }
              return false;
            },
          },
        });
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prev) => {
          if (markdown !== prev) {
            callbacksRef.current.onChange(markdown);
          }
        });
        ctx.get(listenerCtx).selectionUpdated((_ctx) => {
          const cb = callbacksRef.current.onCursorLine;
          if (!cb || !editorRef.current) return;
          editorRef.current.action((c) => {
            const view = c.get(editorViewCtx);
            const pos = view.state.selection.from;
            const dom = view.domAtPos(pos);
            const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
            const line = el?.closest("[data-sourceline]")?.getAttribute("data-sourceline");
            if (line) cb(Number(line));
          });
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(clipboard)
      .use(math)
      .use(diagram)
      .use(slashPlugin)
      .use(toolbarPlugin)
      .use(createShikiHighlightPlugin());

    editor
      .create()
      .then((created) => {
        if (destroyed) {
          void created.destroy();
          return;
        }
        editorRef.current = created;
        const handle: EditorHandle = {
          getMarkdown: () => {
            try {
              return editorRef.current?.action(getMarkdown()) ?? null;
            } catch {
              return null;
            }
          },
          setMarkdown: (markdown) => {
            editorRef.current?.action(replaceAll(markdown));
          },
          insertMarkdown: (text) => {
            editorRef.current?.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const parser = ctx.get(parserCtx);
              const doc = parser(text);
              const tr = view.state.tr;
              if (doc) {
                tr.replaceSelection(new Slice(doc.content, 0, 0));
              } else {
                tr.insertText(text);
              }
              view.dispatch(tr.scrollIntoView());
              view.focus();
            });
          },
          wrapSelection: (open, close) => {
            editorRef.current?.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const { state } = view;
              const { from, to } = state.selection;
              const text = state.doc.textBetween(from, to, " ");
              const tr = state.tr.insertText(open + text + close, from, to);
              if (from === to) {
                tr.setSelection(TextSelection.create(tr.doc, from + open.length));
              }
              view.dispatch(tr.scrollIntoView());
              view.focus();
            });
          },
          focus: () => {
            editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus());
          },
        };
        registerEditor(documentId, handle);
      })
      .catch(() => {
        // Editor creation failure must not take down the app shell.
      });

    return () => {
      destroyed = true;
      const instance = editorRef.current;
      editorRef.current = null;
      if (instance) void instance.destroy();
    };
    // Recreated only when the document id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const filteredSlash = SLASH_ITEMS.filter((item) => {
    if (!slash.query) return true;
    const q = slash.query.toLowerCase();
    return (
      item.labelEn.toLowerCase().includes(q) ||
      item.labelZh.includes(q) ||
      item.keywords.includes(q)
    );
  }).slice(0, 8);

  const applySlash = useCallback(
    (index: number) => {
      const item = filteredSlash[index];
      if (!item || !slash.active) return;
      insertSnippet(item.snippet ?? "", slash.from, slash.to);
      setSlash({ ...slash, active: false });
    },
    [filteredSlash, slash, insertSnippet],
  );

  useEffect(() => {
    if (!slash.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, filteredSlash.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        applySlash(slashIndex);
      } else if (e.key === "Escape") {
        setSlash((s) => ({ ...s, active: false }));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [slash.active, slashIndex, filteredSlash.length, applySlash]);

  const zh = getLocale() === "zh-CN";

  return (
    <div className="milkdown-host relative" data-editor-id={documentId}>
      <div ref={containerRef} aria-label="WYSIWYG markdown editor" />
      {toolbar.active && (
        <div
          role="toolbar"
          aria-label="Formatting"
          className="fixed z-40 flex items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] px-1 py-1 shadow-[var(--shadow)]"
          style={{ left: toolbar.left, top: toolbar.top, transform: "translateX(-50%)" }}
        >
          <ToolbarButton label="B" title={`${zh ? "粗体" : "Bold"} (⌘B)`} onClick={() => applyInlineCommand("bold")} strong />
          <ToolbarButton label="I" title={`${zh ? "斜体" : "Italic"} (⌘I)`} onClick={() => applyInlineCommand("italic")} italic />
          <ToolbarButton label="S" title={zh ? "删除线" : "Strikethrough"} onClick={() => applyInlineCommand("strike")} strike />
          <ToolbarButton label="</>" title={zh ? "行内代码" : "Inline code"} onClick={() => applyInlineCommand("code")} />
          <ToolbarButton label="🔗" title={zh ? "链接" : "Link"} onClick={() => applyInlineCommand("link")} />
          <ToolbarButton label="H" title={zh ? "标题" : "Heading"} onClick={() => applyInlineCommand("heading")} />
          <ToolbarButton label="❝" title={zh ? "引用" : "Quote"} onClick={() => applyInlineCommand("quote")} />
        </div>
      )}
      {slash.active && filteredSlash.length > 0 && (
        <div
          role="listbox"
          aria-label={t().palette.placeholder}
          className="fixed z-40 w-64 rounded-md border border-[var(--border)] bg-[var(--bg-secondary)] py-1 shadow-[var(--shadow)]"
          style={{ left: slash.left, top: slash.top }}
        >
          {filteredSlash.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={i === slashIndex}
              className={`flex w-full items-center px-3 py-1.5 text-left text-sm ${
                i === slashIndex ? "bg-[var(--bg-tertiary)]" : ""
              }`}
              onMouseEnter={() => setSlashIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                applySlash(i);
              }}
            >
              {zh ? item.labelZh : item.labelEn}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  onClick,
  strong,
  italic,
  strike,
}: {
  label: string;
  title: string;
  onClick: () => void;
  strong?: boolean;
  italic?: boolean;
  strike?: boolean;
}) {
  return (
    <button
      type="button"
      className="icon-btn text-[13px]"
      style={{
        fontWeight: strong ? 700 : undefined,
        fontStyle: italic ? "italic" : undefined,
        textDecoration: strike ? "line-through" : undefined,
      }}
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {label}
    </button>
  );
}
