/**
 * Shiki syntax highlighting for Milkdown code blocks, implemented as a plain
 * ProseMirror plugin. Token colors are applied as inline decorations; results
 * are cached so highlighting is computed once per (theme, language, code).
 */
import { $prose } from "@milkdown/utils";
import { Plugin, PluginKey } from "@milkdown/prose/state";
import { Decoration, DecorationSet } from "@milkdown/prose/view";
import type { Node as PMNode } from "@milkdown/prose/model";
import { getHighlighter, supportedLanguage, SHIKI_THEMES } from "@/lib/shikiHighlighter";
import type { BundledLanguage } from "shiki";

interface FlatToken {
  offset: number;
  content: string;
  color?: string;
}

const shikiKey = new PluginKey<DecorationSet>("markora-shiki");

/** theme|lang|code → tokens (null = highlight failed / plain). */
const tokenCache = new Map<string, FlatToken[] | null>();
const pending = new Set<string>();
const CACHE_LIMIT = 300;

function currentTheme(): string {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "dark" || theme === "high-contrast" ? SHIKI_THEMES.dark : SHIKI_THEMES.light;
}

function cacheKey(theme: string, lang: string, code: string): string {
  return `${theme}|${lang}|${code}`;
}

function requestTokens(theme: string, lang: string, code: string, onDone: () => void) {
  const key = cacheKey(theme, lang, code);
  if (tokenCache.has(key) || pending.has(key)) return;
  pending.add(key);
  void getHighlighter()
    .then((highlighter) =>
      highlighter.codeToTokens(code, { lang: lang as BundledLanguage, theme }),
    )
    .then((result) => {
      const tokens: FlatToken[] = [];
      for (const line of result.tokens) {
        for (const token of line) {
          tokens.push({ offset: token.offset, content: token.content, color: token.color });
        }
      }
      if (tokenCache.size >= CACHE_LIMIT) {
        tokenCache.delete(tokenCache.keys().next().value as string);
      }
      tokenCache.set(key, tokens);
    })
    .catch(() => {
      tokenCache.set(key, null);
    })
    .finally(() => {
      pending.delete(key);
      onDone();
    });
}

interface ScanResult {
  deco: DecorationSet;
  /** Blocks whose tokens are not cached yet: [theme, lang, code]. */
  missing: Array<[string, string, string]>;
}

function scanDoc(doc: PMNode): ScanResult {
  const theme = currentTheme();
  const decorations: Decoration[] = [];
  const missing: Array<[string, string, string]> = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") return true;
    const lang = supportedLanguage(String(node.attrs.language ?? ""));
    const code = node.textContent;
    if (lang === "text" || !code) return false;
    const tokens = tokenCache.get(cacheKey(theme, lang, code));
    if (tokens === undefined) {
      missing.push([theme, lang, code]);
      return false;
    }
    if (tokens) {
      // Code content starts at pos + 1 (inside the code_block node).
      for (const token of tokens) {
        if (!token.color) continue;
        const from = pos + 1 + token.offset;
        decorations.push(
          Decoration.inline(from, from + token.content.length, { style: `color:${token.color}` }),
        );
      }
    }
    return false;
  });
  return { deco: DecorationSet.create(doc, decorations), missing };
}

export function createShikiHighlightPlugin() {
  return $prose(
    () =>
      new Plugin<DecorationSet>({
        key: shikiKey,
        state: {
          init: (_, state) => scanDoc(state.doc).deco,
          apply: (tr, old, _oldState, newState) => {
            if (!tr.docChanged && !tr.getMeta(shikiKey)) return old;
            return scanDoc(newState.doc).deco;
          },
        },
        props: {
          decorations: (state) => shikiKey.getState(state),
        },
        view: (view) => {
          // Kick off async highlighting for uncached blocks, then force a
          // re-decoration pass once tokens arrive.
          const schedule = () => {
            for (const [theme, lang, code] of scanDoc(view.state.doc).missing) {
              requestTokens(theme, lang, code, () => {
                if (!view.isDestroyed) {
                  view.dispatch(view.state.tr.setMeta(shikiKey, true));
                }
              });
            }
          };
          // Re-highlight when the app theme flips.
          const observer = new MutationObserver(schedule);
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
          });
          schedule();
          return {
            update: schedule,
            destroy: () => observer.disconnect(),
          };
        },
      }),
  );
}
