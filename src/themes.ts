import { STOPWORDS } from "./data/stopwords.js";

export function extractThemes(
  texts: string[],
  query: string,
  topN = 8,
): { term: string; count: number }[] {
  const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
  const counts = new Map<string, number>();

  const bump = (term: string) => {
    if (queryTerms.has(term) || term.split(" ").every((word) => queryTerms.has(word))) return;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  };

  for (const text of texts) {
    const tokens = (text.toLowerCase().match(/[a-z][a-z0-9'+-]*/g) ?? [])
      .filter((token) => !STOPWORDS.has(token));

    for (let i = 0; i < tokens.length; i++) {
      bump(tokens[i]);
      if (tokens[i + 1]) bump(`${tokens[i]} ${tokens[i + 1]}`);
    }
  }

  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, topN);
}
