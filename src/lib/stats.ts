/** Text statistics for the status bar. Chinese/Japanese/Korean characters
 * each count as one word (no space-based tokenization for CJK). */

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  paragraphs: number;
  /** Rounded-up minutes at ~200 latin wpm / 300 CJK chars per minute. */
  readingTimeMinutes: number;
}

// CJK unified ideographs, hiragana/katakana, hangul syllables.
const CJK_RE = /[\u2e80-\u9fff\uf900-\ufaff\uac00-\ud7af]/gu;
const LATIN_WORD_RE = /[A-Za-z0-9]+(?:['_-][A-Za-z0-9]+)*/g;

export function computeStats(markdown: string): TextStats {
  const characters = markdown.length;
  const charactersNoSpaces = markdown.replace(/\s/g, "").length;

  const cjkCount = (markdown.match(CJK_RE) ?? []).length;
  const latinWords = (markdown.match(LATIN_WORD_RE) ?? []).length;
  const words = cjkCount + latinWords;

  const paragraphs = markdown
    .split(/\n[ \t]*\n/)
    .filter((block) => block.trim().length > 0).length;

  const minutes = latinWords / 200 + cjkCount / 300;
  const readingTimeMinutes = words === 0 ? 0 : Math.max(1, Math.ceil(minutes));

  return { characters, charactersNoSpaces, words, paragraphs, readingTimeMinutes };
}
