import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightSpecialChars,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, openSearchPanel, searchKeymap } from "@codemirror/search";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tags } from "@lezer/highlight";
import { useSettingsStore } from "@/stores/settings";
import { registerEditor, type EditorHandle } from "./editorRegistry";

/** Theme-driven highlight style so source mode follows app themes. */
const markoraHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.6em", fontWeight: "700", color: "var(--fg-primary)" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "700", color: "var(--fg-primary)" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "650", color: "var(--fg-primary)" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: "650" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--fg-muted)" },
  { tag: [tags.link, tags.url], color: "var(--accent)" },
  { tag: [tags.monospace], fontFamily: "var(--font-mono)", color: "var(--accent)" },
  { tag: [tags.quote], color: "var(--fg-secondary)", fontStyle: "italic" },
  { tag: [tags.processingInstruction, tags.punctuation], color: "var(--fg-muted)" },
  { tag: [tags.meta, tags.comment], color: "var(--fg-muted)" },
  { tag: [tags.keyword], color: "var(--accent)" },
  { tag: [tags.string], color: "var(--fg-secondary)" },
]);

export interface SourceEditorProps {
  documentId: string;
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  onCursorLine?: (line: number) => void;
  onScrollLine?: (line: number) => void;
  onScrollRatio?: (ratio: number) => void;
  onPasteFiles?: (files: File[]) => void;
  onDropFiles?: (files: File[]) => void;
}

/**
 * CodeMirror 6 source editor. The view is created once per mount and lives
 * until the document's mode changes or the tab is closed — never per
 * keystroke. External content changes (conflict resolution) flow through
 * the registered handle's `setMarkdown`.
 */
export function SourceEditor({
  documentId,
  initialMarkdown,
  onChange,
  onCursorLine,
  onScrollLine,
  onScrollRatio,
  onPasteFiles,
  onDropFiles,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const callbacksRef = useRef({ onChange, onCursorLine, onScrollLine, onScrollRatio });
  callbacksRef.current = { onChange, onCursorLine, onScrollLine, onScrollRatio };
  const fileHandlersRef = useRef({ onPasteFiles, onDropFiles });
  fileHandlersRef.current = { onPasteFiles, onDropFiles };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const settings = useSettingsStore.getState().settings;

    const extensions: Extension[] = [
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(markoraHighlight),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightSelectionMatches(),
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: true }),
      EditorState.tabSize.of(settings.tabSize),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          callbacksRef.current.onChange(update.state.doc.toString());
        }
        if (update.selectionSet && callbacksRef.current.onCursorLine) {
          const line = update.state.doc.lineAt(update.state.selection.main.head);
          callbacksRef.current.onCursorLine(line.number);
        }
      }),
      EditorView.domEventHandlers({
        paste(event) {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (files.length > 0 && fileHandlersRef.current.onPasteFiles) {
            event.preventDefault();
            fileHandlersRef.current.onPasteFiles(files);
          }
        },
        drop(event) {
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (files.length > 0 && fileHandlersRef.current.onDropFiles) {
            event.preventDefault();
            fileHandlersRef.current.onDropFiles(files);
          }
        },
      }),
    ];
    if (settings.lineNumbers) {
      extensions.push(lineNumbers(), highlightActiveLineGutter(), foldGutter());
    }
    if (settings.wordWrap) {
      extensions.push(EditorView.lineWrapping);
    }
    if (settings.autoPair) {
      extensions.push(closeBrackets());
    }

    const view = new EditorView({
      state: EditorState.create({ doc: initialMarkdown, extensions }),
      parent: container,
    });
    viewRef.current = view;

    const handle: EditorHandle = {
      getMarkdown: () => view.state.doc.toString(),
      setMarkdown: (markdown) => {
        if (view.state.doc.toString() === markdown) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: markdown },
        });
      },
      scrollToLine: (line) => {
        const clamped = Math.max(1, Math.min(line, view.state.doc.lines));
        const pos = view.state.doc.line(clamped).from;
        view.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "center" }),
        });
        view.focus();
      },
      getCursorLine: () => view.state.doc.lineAt(view.state.selection.main.head).number,
      insertMarkdown: (text) => {
        view.dispatch(view.state.replaceSelection(text));
        view.focus();
      },
      wrapSelection: (open, close) => {
        const { from, to } = view.state.selection.main;
        const text = view.state.sliceDoc(from, to);
        view.dispatch({
          changes: { from, to, insert: open + text + close },
          selection:
            from === to
              ? { anchor: from + open.length }
              : { anchor: from + open.length, head: to + open.length },
        });
        view.focus();
      },
      focus: () => view.focus(),
    };
    const unregister = registerEditor(documentId, handle);

    const onScroll = () => {
      const scroller = view.scrollDOM;
      const max = scroller.scrollHeight - scroller.clientHeight;
      callbacksRef.current.onScrollRatio?.(max > 0 ? scroller.scrollTop / max : 0);
      // report the top visible line for scroll-sync
      if (callbacksRef.current.onScrollLine) {
        const pos = view.posAtCoords({ x: 20, y: scroller.getBoundingClientRect().top + 8 });
        if (pos != null) {
          callbacksRef.current.onScrollLine(view.state.doc.lineAt(pos).number);
        }
      }
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });

    // "Find in document" command → open CodeMirror's search panel.
    const onFind = () => openSearchPanel(view);
    document.addEventListener("markora:find", onFind);

    return () => {
      document.removeEventListener("markora:find", onFind);
      view.scrollDOM.removeEventListener("scroll", onScroll);
      unregister();
      view.destroy();
      viewRef.current = null;
    };
    // The editor is intentionally (re)created only when the document id
    // changes — content updates flow through the handle, never via re-mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" role="textbox" aria-multiline="true" aria-label="Markdown source editor" />;
}

export function openSourceSearch() {
  document.dispatchEvent(new CustomEvent("markora:find"));
}
