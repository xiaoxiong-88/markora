/**
 * Shared Shiki highlighter singleton. Created once, reused everywhere
 * (preview, reader, export) to avoid repeated WASM/grammar initialization.
 */
import { createHighlighter, type Highlighter } from "shiki";

const LANGS = [
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "json",
  "html",
  "css",
  "python",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "bash",
  "shell",
  "sql",
  "yaml",
  "toml",
  "xml",
  "markdown",
  "diff",
  "dockerfile",
  "lua",
  "ruby",
  "php",
  "swift",
  "kotlin",
];

export const SHIKI_THEMES = { light: "github-light", dark: "github-dark" } as const;

let highlighterPromise: Promise<Highlighter> | null = null;
const htmlCache = new Map<string, string>();
const CACHE_LIMIT = 300;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
      langs: LANGS,
    });
  }
  return highlighterPromise;
}

export function supportedLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return LANGS.includes(normalized) ? normalized : "text";
}

function escapeHtml(code: string): string {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Highlight `code`; falls back to plain escaped text for unknown grammars. */
export async function highlightCode(
  code: string,
  lang: string,
  dark: boolean,
): Promise<string> {
  const language = supportedLanguage(lang);
  const theme = dark ? SHIKI_THEMES.dark : SHIKI_THEMES.light;
  const key = `${theme}|${language}|${code}`;
  const cached = htmlCache.get(key);
  if (cached) return cached;
  let html: string;
  try {
    const highlighter = await getHighlighter();
    html = highlighter.codeToHtml(code, { lang: language === "text" ? "text" : language, theme });
  } catch {
    html = `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
  if (htmlCache.size >= CACHE_LIMIT) {
    htmlCache.delete(htmlCache.keys().next().value as string);
  }
  htmlCache.set(key, html);
  return html;
}
