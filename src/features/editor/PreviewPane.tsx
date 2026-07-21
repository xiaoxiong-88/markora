import React, { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import rehypeKatex from "rehype-katex";
import { Copy, Check } from "lucide-react";
import { highlightCode } from "@/lib/shikiHighlighter";
import { renderMermaid } from "@/lib/mermaidRenderer";
import { resolveImageSrc } from "@/lib/imageResolver";
import { useSettingsStore } from "@/stores/settings";

function isDarkTheme(): boolean {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "dark" || theme === "high-contrast";
}

/** Copy button shared by code blocks. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy code"
      className="icon-btn absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

/** Fenced code block with Shiki highlighting (async, cached). */
export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void highlightCode(code, language, isDarkTheme()).then((h) => {
      if (alive) setHtml(h);
    });
    return () => {
      alive = false;
    };
  }, [code, language]);
  return (
    <div className="relative group">
      <CopyButton text={code} />
      {language && (
        <span className="absolute left-3 top-1.5 text-[11px] text-[var(--fg-muted)] select-none">
          {language}
        </span>
      )}
      {html ? (
        <div
          className="shiki-block [&_pre]:!bg-[var(--code-bg)] [&_pre]:!m-0 [&_pre]:p-3 [&_pre]:pt-6 [&_pre]:rounded-md [&_pre]:overflow-x-auto [&_code]:text-[0.86em]"
          // Shiki output is generated locally from escaped input; no user HTML.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

/** Mermaid diagram with per-block error containment. */
export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const el = ref.current;
    if (!el) return;
    void renderMermaid(code, isDarkTheme())
      .then((svg) => {
        if (alive) {
          el.innerHTML = svg;
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          el.innerHTML = "";
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      alive = false;
    };
  }, [code]);
  if (error) {
    return (
      <div className="mermaid-error" role="alert">
        Mermaid: {error}
        {"\n"}
        {code}
      </div>
    );
  }
  return <div ref={ref} className="mermaid-diagram my-3 flex justify-center" />;
}

interface MdImageProps {
  src?: string;
  alt?: string;
  documentDir: string | null;
  onZoom?: (src: string, alt: string) => void;
}

/** Image with local path resolution and a clear broken-state placeholder. */
export function MdImage({ src, alt, documentDir, onZoom }: MdImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveImageSrc(src ?? "", documentDir);
  if (failed) {
    return (
      <span className="image-broken" role="img" aria-label={`Broken image: ${src}`}>
        ⚠ {alt || "image"} — {src}
      </span>
    );
  }
  return (
    <img
      src={resolved}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
      onClick={() => onZoom?.(resolved, alt ?? "")}
      className={onZoom ? "cursor-zoom-in" : undefined}
    />
  );
}

export interface MarkdownViewProps {
  markdown: string;
  documentDir: string | null;
  onImageZoom?: (src: string, alt: string) => void;
  onNavigateSourceLine?: (line: number) => void;
}

type HastPosition = { start: { line: number }; end: { line: number } } | undefined;

function sourceLineOf(node: unknown): number | undefined {
  const position = (node as { position?: HastPosition })?.position;
  return position?.start.line;
}

/**
 * Shared Markdown renderer for split preview and reading mode.
 * Raw HTML is intentionally NOT enabled: Markdown-embedded HTML renders as
 * text, which is the sanitization strategy (see docs/SECURITY.md).
 */
export const MarkdownView = memo(function MarkdownView({
  markdown,
  documentDir,
  onImageZoom,
  onNavigateSourceLine,
}: MarkdownViewProps) {
  const settings = useSettingsStore((s) => s.settings);
  const remarkPlugins = [
    remarkGfm,
    ...(settings.frontMatter ? [remarkFrontmatter] : []),
    ...(settings.math ? [remarkMath] : []),
  ];
  const rehypePlugins = settings.math ? [rehypeKatex] : [];

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={{
        h1: withSourceLine("h1", onNavigateSourceLine),
        h2: withSourceLine("h2", onNavigateSourceLine),
        h3: withSourceLine("h3", onNavigateSourceLine),
        h4: withSourceLine("h4", onNavigateSourceLine),
        h5: withSourceLine("h5", onNavigateSourceLine),
        h6: withSourceLine("h6", onNavigateSourceLine),
        p: withSourceLine("p", onNavigateSourceLine),
        pre({ children }) {
          return <>{children}</>;
        },
        code(props) {
          const { className, children, node } = props as {
            className?: string;
            children?: React.ReactNode;
            node?: unknown;
          };
          const code = String(children ?? "").replace(/\n$/, "");
          const match = /language-(\w+)/.exec(className ?? "");
          const isBlock = code.includes("\n") || match;
          if (!isBlock) {
            return <code className={className}>{children}</code>;
          }
          const language = match?.[1] ?? "";
          if (language === "mermaid" && settings.mermaid) {
            return (
              <div data-sourceline={sourceLineOf(node)}>
                <MermaidBlock code={code} />
              </div>
            );
          }
          return (
            <div data-sourceline={sourceLineOf(node)}>
              <CodeBlock language={language} code={code} />
            </div>
          );
        },
        img({ src, alt }) {
          return (
            <MdImage src={typeof src === "string" ? src : ""} alt={alt} documentDir={documentDir} onZoom={onImageZoom} />
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href && /^https?:\/\//i.test(href)) {
                  void import("@tauri-apps/plugin-opener").then((m) =>
                    m.openUrl(href).catch(() => {}),
                  );
                } else if (href?.startsWith("#")) {
                  document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              {children}
            </a>
          );
        },
        table({ children, node }) {
          return (
            <div data-sourceline={sourceLineOf(node)} className="overflow-x-auto">
              <table>{children}</table>
            </div>
          );
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
});

/**
 * Attach a stable source-line anchor so scroll sync / outline jumps work.
 * Each wrapper is typed against react-markdown's `Components` map for its tag
 * so it slots into the `components` prop without type friction.
 */
function withSourceLine(
  Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p",
  onNavigate?: (line: number) => void,
): React.FC<ExtraProps & React.HTMLAttributes<HTMLElement>> {
  return (props) => {
    const { node, children, ...rest } = props;
    const line = sourceLineOf(node);
    return React.createElement(
      Tag,
      {
        ...rest,
        "data-sourceline": line,
        onClick:
          onNavigate && line != null && Tag.startsWith("h")
            ? () => onNavigate(line)
            : undefined,
      } as React.HTMLAttributes<HTMLElement>,
      children,
    );
  };
}

/** Full preview pane with debounced rendering. */
export function PreviewPane({
  markdown,
  documentDir,
  debounceMs = 250,
  onNavigateSourceLine,
  onImageZoom,
  scrollRef,
}: {
  markdown: string;
  documentDir: string | null;
  debounceMs?: number;
  onNavigateSourceLine?: (line: number) => void;
  onImageZoom?: (src: string, alt: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
}) {
  const [rendered, setRendered] = useState(markdown);
  useEffect(() => {
    const timer = setTimeout(() => setRendered(markdown), debounceMs);
    return () => clearTimeout(timer);
  }, [markdown, debounceMs]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto" aria-label="Markdown preview">
      <div className="markdown-body">
        <MarkdownView
          markdown={rendered}
          documentDir={documentDir}
          onNavigateSourceLine={onNavigateSourceLine}
          onImageZoom={onImageZoom}
        />
      </div>
    </div>
  );
}
