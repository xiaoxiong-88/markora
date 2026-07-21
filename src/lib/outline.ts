import type { Heading } from "@/types";

/**
 * Parse Markdown headings into an outline. Fenced code blocks and front
 * matter are skipped so `#` inside code never produces phantom headings.
 * Duplicate texts get stable numeric suffixes (GitHub style).
 */
export function parseOutline(markdown: string): Heading[] {
  const lines = markdown.split("\n");
  const headings: Heading[] = [];
  const slugCount = new Map<string, number>();
  let inFence = false;
  let fenceMarker = "";
  let inFrontMatter = false;

  lines.forEach((raw, index) => {
    const line = raw;
    if (index === 0 && line.trim() === "---") {
      inFrontMatter = true;
      return;
    }
    if (inFrontMatter) {
      if (line.trim() === "---" || line.trim() === "...") inFrontMatter = false;
      return;
    }
    const fence = line.match(/^\s*(```+|~~~+)/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1].startsWith(fenceMarker!.repeat(3).slice(0, 3))) {
        inFence = false;
        fenceMarker = "";
      }
      return;
    }
    if (inFence) return;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      const text = m[2]
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .trim();
      const slug = uniqueSlug(slugify(text), slugCount);
      headings.push({ level: m[1].length, text, line: index, slug });
      return;
    }
    // Setext headings (=== / ---) — only when previous line is plain text
    if (/^\s*=+\s*$/.test(line) || /^\s*-+\s*$/.test(line)) {
      const prev = lines[index - 1];
      if (
        prev &&
        prev.trim() !== "" &&
        !/^\s*(#{|[-*+>]|```)/.test(prev) &&
        headings.every((h) => h.line !== index - 1)
      ) {
        const text = prev.trim().replace(/[*_`~]/g, "");
        const slug = uniqueSlug(slugify(text), slugCount);
        headings.push({
          level: line.trim().startsWith("=") ? 1 : 2,
          text,
          line: index - 1,
          slug,
        });
      }
    }
  });
  return headings;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-");
}

function uniqueSlug(base: string, counts: Map<string, number>): string {
  const n = counts.get(base) ?? 0;
  counts.set(base, n + 1);
  return n === 0 ? base : `${base}-${n}`;
}

/** Heading active at a given source line (last heading at or before it). */
export function activeHeadingAt(headings: Heading[], line: number): Heading | null {
  let current: Heading | null = null;
  for (const h of headings) {
    if (h.line <= line) current = h;
    else break;
  }
  return current;
}
