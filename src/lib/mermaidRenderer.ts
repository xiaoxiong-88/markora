/**
 * Mermaid rendering with a single global initialization. Diagrams render
 * one at a time; failures are reported per-diagram and never break the
 * surrounding document. `securityLevel: "strict"` keeps diagrams from
 * embedding interactive HTML/JS.
 */
import mermaid from "mermaid";

let currentTheme: string | null = null;
let counter = 0;

export function ensureMermaid(dark: boolean): void {
  const theme = dark ? "dark" : "default";
  if (currentTheme === theme) return;
  currentTheme = theme;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme,
    fontFamily: "inherit",
  });
}

export async function renderMermaid(code: string, dark: boolean): Promise<string> {
  ensureMermaid(dark);
  counter += 1;
  const id = `mermaid-${Date.now().toString(36)}-${counter}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}
