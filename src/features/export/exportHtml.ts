/**
 * HTML export: unified pipeline (CommonMark + GFM + front matter + KaTeX)
 * followed by async post-processing for Shiki code highlighting and Mermaid
 * diagrams. Raw HTML from Markdown is NOT passed through — it stays escaped,
 * which is the export sanitization strategy.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import katexCss from "katex/dist/katex.min.css?raw";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { backend } from "@/services/backend";
import { highlightCode, SHIKI_THEMES } from "@/lib/shikiHighlighter";
import { renderMermaid } from "@/lib/mermaidRenderer";
import { useDocumentsStore } from "@/stores/documents";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { flushDocument } from "@/features/editor/modeSwitch";
import { t } from "@/i18n";

/** Markdown → body HTML fragment (synchronous). */
export async function markdownToBodyHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Replace fenced code blocks with Shiki-highlighted HTML (Mermaid → SVG). */
export async function enhanceCodeBlocks(html: string, dark: boolean): Promise<string> {
  const pattern = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g;
  const replacements: { from: string; to: string }[] = [];
  for (const match of html.matchAll(pattern)) {
    const [full, lang, rawCode] = match;
    const code = decodeEntities(rawCode).replace(/\n$/, "");
    try {
      const to =
        lang === "mermaid"
          ? `<div class="mermaid">${await renderMermaid(code, dark)}</div>`
          : await highlightCode(code, lang, dark);
      replacements.push({ from: full, to });
    } catch {
      replacements.push({
        from: full,
        to: `<pre class="render-error"><code>${rawCode}</code></pre>`,
      });
    }
  }
  let out = html;
  for (const r of replacements) {
    out = out.replace(r.from, r.to);
  }
  return out;
}

const EXPORT_CSS = `
:root { color-scheme: light; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #1f2329; margin: 0; }
main { max-width: 760px; margin: 0 auto; padding: 40px 32px 80px; line-height: 1.7; font-size: 16px; }
h1,h2,h3,h4 { line-height: 1.35; margin: 1.2em 0 0.5em; }
a { color: #3b6fd4; text-decoration: none; }
code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: .88em; background: #f3f4f6; border-radius: 4px; padding: .15em .35em; }
pre { background: #f6f8fa; border-radius: 6px; padding: 12px 14px; overflow-x: auto; font-size: .86em; }
pre code { background: none; padding: 0; }
blockquote { margin: .8em 0; padding: .1em 0 .1em 14px; border-left: 3px solid #e3e4e8; color: #4b5160; }
table { border-collapse: collapse; margin: .8em 0; }
th, td { border: 1px solid #e3e4e8; padding: 6px 12px; }
th { background: #f6f6f7; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid #e3e4e8; margin: 1.6em 0; }
.shiki { background: #f6f8fa !important; }
.mermaid { display: flex; justify-content: center; margin: 12px 0; }
@media print { main { max-width: none; } pre, blockquote, table { page-break-inside: avoid; } }
`;

export interface ExportOptions {
  title: string;
  dark?: boolean;
  extraCss?: string;
}

/** Build a complete standalone HTML document for export/print. */
export async function buildExportHtml(markdown: string, options: ExportOptions): Promise<string> {
  const body = await markdownToBodyHtml(markdown);
  const enhanced = await enhanceCodeBlocks(body, options.dark ?? false);
  const theme = options.dark ? SHIKI_THEMES.dark : SHIKI_THEMES.light;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="Markora" />
<title>${escapeHtml(options.title)}</title>
<style>${EXPORT_CSS}</style>
<style>${katexCss}</style>
${options.extraCss ? `<style>${options.extraCss}</style>` : ""}
<!-- shiki theme: ${theme} -->
</head>
<body><main class="markdown-body">${enhanced}</main></body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Export the active document to a standalone HTML file via save dialog. */
export async function exportActiveToHtml(): Promise<boolean> {
  const strings = t();
  const store = useDocumentsStore.getState();
  const doc = store.getActive();
  if (!doc) return false;
  flushDocument(doc.id);
  const current = useDocumentsStore.getState().documents[doc.id];
  if (!current) return false;
  const target = await saveDialog({
    defaultPath: current.displayName.replace(/\.[^.]*$/, "") + ".html",
    filters: [{ name: "HTML", extensions: ["html"] }],
  });
  if (!target) return false;
  try {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const html = await buildExportHtml(current.markdown, {
      title: current.displayName.replace(/\.[^.]*$/, ""),
      dark,
    });
    await backend.writeFileAtomic(target, html, { lineEnding: "lf", ensureFinalNewline: false });
    useUiStore.getState().toast(strings.toast.exported, "success");
    return true;
  } catch (err) {
    useUiStore.getState().toast(`${strings.toast.exportFailed}: ${String(err)}`, "error");
    return false;
  }
}

/** Print the active document through the system print dialog (→ PDF). */
export function printActive(): void {
  const store = useDocumentsStore.getState();
  const doc = store.getActive();
  if (!doc) return;
  flushDocument(doc.id);
  // Ensure the reader-style body is what prints; print CSS hides the chrome.
  const settings = useSettingsStore.getState();
  const prevMode = doc.mode;
  if (doc.mode !== "reader") {
    useDocumentsStore.getState().setMode(doc.id, "reader");
    setTimeout(() => {
      window.print();
      settings.update({});
      useDocumentsStore.getState().setMode(doc.id, prevMode);
    }, 350);
  } else {
    window.print();
  }
}
