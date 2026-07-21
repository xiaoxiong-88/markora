/**
 * CJK-aware document statistics. Chinese/Japanese characters each count as
 * one "word"; Latin runs count as words separated by whitespace.
 */

export interface DocumentStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  paragraphs: number;
  readingMinutes: number;
}

const CJK =
  /[㐀-䶿一-鿿豈-﫿぀-ヿ가-힯]/;

/** Strip constructs that should not count toward readable text. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n?/, "") // front matter
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^\s*[-*+>]\s+/gm, "")
    .replace(/[*_~|]/g, "");
}

export function countWords(text: string): number {
  let words = 0;
  let inLatin = false;
  for (const ch of text) {
    if (CJK.test(ch)) {
      words += 1;
      inLatin = false;
    } else if (/[\p{L}\p{N}'’-]/u.test(ch)) {
      if (!inLatin) {
        words += 1;
        inLatin = true;
      }
    } else {
      inLatin = false;
    }
  }
  return words;
}

export function computeStats(markdown: string): DocumentStats {
  const text = stripMarkdown(markdown);
  const characters = [...text].filter((c) => c !== "\n").length;
  const charactersNoSpaces = [...text].filter((c) => !/\s/.test(c)).length;
  const words = countWords(text);
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^---/.test(p)).length;
  // ~400 chars/min CJK, ~200 words/min Latin; blend by content
  const readingMinutes = Math.max(1, Math.round(words / 300)) || (words > 0 ? 1 : 0);
  return { characters, charactersNoSpaces, words, paragraphs, readingMinutes };
}
