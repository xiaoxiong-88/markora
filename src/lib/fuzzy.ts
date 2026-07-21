/** Subsequence-based fuzzy matching for quick open / command palette. */

export interface FuzzyResult<T> {
  item: T;
  score: number;
  /** Indices of matched characters, for highlighting. */
  indices: number[];
}

export function fuzzyMatch(query: string, candidate: string): { score: number; indices: number[] } | null {
  if (!query) return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let qi = 0;
  let lastMatch = -2;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      indices.push(ci);
      // bonus for consecutive matches and matches after separators
      if (ci === lastMatch + 1) score += 5;
      if (ci === 0 || /[\s\-_./\\]/.test(c[ci - 1])) score += 3;
      score += 1;
      lastMatch = ci;
      qi++;
    }
  }
  if (qi < q.length) return null;
  // prefer shorter candidates and earlier matches
  score -= candidate.length * 0.01 + (indices[0] ?? 0) * 0.05;
  return { score, indices };
}

export function fuzzyFilter<T>(
  query: string,
  items: T[],
  key: (item: T) => string,
  limit = 50,
): FuzzyResult<T>[] {
  const results: FuzzyResult<T>[] = [];
  for (const item of items) {
    const m = fuzzyMatch(query, key(item));
    if (m) results.push({ item, score: m.score, indices: m.indices });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
